"""
Repository Context Retriever for SentinelOps.
Fetches actual repository file contents, relevant tests, configurations,
and dependency files based on structured failure metadata.

Guarantees:
1. Never provides random blindly truncated file chunks.
2. Retrieves the actual target file and focused surrounding lines identified in tracebacks.
3. Retrieves associated unit test files, package manifests (requirements.txt, package.json),
   and build configurations (Dockerfile).
4. Produces a canonical structured context dictionary for Diagnoser and FixSuggester.
"""

import logging
import os
import re
from typing import Any, Callable

from services.github_service import github_service

logger = logging.getLogger("sentinelops.repo_context_retriever")


class RepoContextRetriever:
    """
    Retrieves and structures actual repository contents relevant to a CI failure.
    """

    CATEGORY_STRATEGY_MAP = {
        "DEPENDENCY": "inspect dependency manifests",
        "TEST_FAILURE": "inspect failing test + implementation",
        "SYNTAX_ERROR": "inspect exact source location",
        "IMPORT_ERROR": "inspect imports + dependency files",
        "TYPE_ERROR": "inspect types + function signatures",
        "BUILD_FAILURE": "inspect build configuration",
        "DOCKER_FAILURE": "inspect Dockerfile + build context",
        "LINT_FAILURE": "inspect lint configuration + source",
        "GITHUB_ACTION_FAILURE": "inspect workflow YAML",
        "DATABASE_FAILURE": "inspect migrations + schema",
        "DEPLOYMENT_FAILURE": "inspect deployment configuration",
    }

    BUILD_CONFIG_FILES = [
        "requirements.txt",
        "pyproject.toml",
        "setup.py",
        "package.json",
        "package-lock.json",
        "Dockerfile",
        "docker-compose.yml",
        "Makefile",
        "pom.xml",
        "build.gradle",
        "tsconfig.json",
        "alembic.ini",
    ]

    def __init__(self):
        pass

    def determine_strategy(self, failure_info: dict[str, Any]) -> str:
        """
        Determines the specialized investigation and repair strategy based on the failure category.
        Requirement 20: Specialized repair strategies for all 11 failure categories.
        """
        raw_cat = (
            failure_info.get("failure_category")
            or failure_info.get("category")
            or ""
        ).upper().strip()

        # Map legacy or synonym categories to canonical strategy enum
        legacy_map = {
            "DEPENDENCY_ERROR": "DEPENDENCY",
            "SYNTAX_OR_LINT_ERROR": "SYNTAX_ERROR",
            "BUILD_ERROR": "BUILD_FAILURE",
            "FLAKY_TEST": "TEST_FAILURE",
            "INFRASTRUCTURE_FAILURE": "DEPLOYMENT_FAILURE",
            "CONFIGURATION": "GITHUB_ACTION_FAILURE",
            "DATABASE": "DATABASE_FAILURE",
            "DEPLOYMENT": "DEPLOYMENT_FAILURE",
            "SECURITY": "LINT_FAILURE",
        }
        if raw_cat in legacy_map:
            return legacy_map[raw_cat]
        if raw_cat in self.CATEGORY_STRATEGY_MAP:
            return raw_cat

        # Heuristic determination based on error_type, error_message, command
        err_type = (failure_info.get("error_type") or "").lower()
        err_type_clean = err_type.replace("_", "").lower()
        err_msg = (failure_info.get("error_message") or "").lower()
        cmd = (failure_info.get("command") or "").lower()
        step = (failure_info.get("step") or failure_info.get("failed_step") or "").lower()
        target_file = (failure_info.get("file") or "").lower()

        if "docker" in err_type_clean or "dockerfile" in err_msg or "docker" in cmd:
            return "DOCKER_FAILURE"
        if "modulenotfound" in err_type_clean or "no module named" in err_msg or "eresolve" in err_msg or "npm err! code" in err_msg:
            return "DEPENDENCY"
        if "importerror" in err_type_clean or "cannot import name" in err_msg:
            return "IMPORT_ERROR"
        if "syntaxerror" in err_type_clean or "invalid syntax" in err_msg:
            return "SYNTAX_ERROR"
        if "typeerror" in err_type_clean or "type" in err_type_clean or "ts" in err_type or "type error" in err_msg:
            return "TYPE_ERROR"
        if "assertionerror" in err_type_clean or "failed" in err_type_clean or "pytest" in cmd or "test" in step:
            return "TEST_FAILURE"
        if "flake8" in cmd or "eslint" in cmd or "lint" in step or "lint" in err_type_clean:
            return "LINT_FAILURE"
        if ".github/workflows" in target_file or "workflow" in err_msg or "yaml" in err_msg or "action" in err_type_clean:
            return "GITHUB_ACTION_FAILURE"
        if "operationalerror" in err_type_clean or "migration" in err_msg or "alembic" in err_msg or "database" in err_type_clean:
            return "DATABASE_FAILURE"
        if "health check" in err_msg or "502" in err_msg or "deploy" in step or "deploy" in cmd:
            return "DEPLOYMENT_FAILURE"
        if "npm run build" in cmd or "build" in step or "compilation" in err_msg or "build" in err_type_clean:
            return "BUILD_FAILURE"

        return "BUILD_FAILURE"

    def retrieve_context(
        self,
        failure_info: dict[str, Any],
        repo: str = "SentinelOps",
        ref: str | None = None,
        file_provider: Callable[[str], str | None] | None = None,
        expanded: bool = False,
    ) -> dict[str, Any]:
        """
        Builds structured repository context around the failure using category-specialized strategy.
        Uses file_provider if supplied, otherwise queries github_service.get_file_content.
        Supports expanded=True for Confidence Gate deeper evidence retrieval.
        """
        strategy = self.determine_strategy(failure_info)
        strategy_desc = self.CATEGORY_STRATEGY_MAP.get(strategy, "inspect source code")
        logger.info("Executing specialized investigation strategy: %s (%s)", strategy, strategy_desc)

        def fetch_file(path: str) -> str | None:
            clean_path = path.strip().replace("\\", "/").lstrip("/")
            if file_provider:
                content = file_provider(clean_path)
                if content is not None:
                    return content

            # Fallback to github_service
            try:
                ok, res = github_service.get_file_content(repo, clean_path, ref=ref)
                if ok and isinstance(res, dict):
                    return res.get("decoded_text") or ""
            except Exception as e:
                logger.debug("Failed to fetch %s from GitHub: %s", clean_path, e)
            return None

        # 1. Target file retrieval (SYNTAX_ERROR, TEST_FAILURE, IMPORT_ERROR, TYPE_ERROR)
        target_file_path = failure_info.get("file")
        target_file_obj: dict[str, Any] = {}
        if target_file_path:
            content = fetch_file(target_file_path)
            if content is not None:
                target_file_obj = {
                    "path": target_file_path,
                    "content": content,
                    "line": failure_info.get("line"),
                }

        # 2. Associated test files (TEST_FAILURE strategy)
        tests: list[dict[str, Any]] = []
        test_file_path = failure_info.get("test_file")
        candidates = []
        if test_file_path:
            candidates.append(test_file_path)
        elif target_file_path:
            base_name = os.path.basename(target_file_path)
            name_no_ext = os.path.splitext(base_name)[0]
            candidates.extend([
                f"tests/test_{name_no_ext}.py",
                f"tests/{name_no_ext}_test.py",
                f"test_{name_no_ext}.py",
                f"tests/{name_no_ext}.test.ts",
                f"tests/{name_no_ext}.test.js",
            ])
        if expanded:
            candidates.extend(["tests/conftest.py", "tests/setup.py", "tests/test_main.py"])

        max_tests = 4 if expanded else 2
        for c_path in candidates:
            c_content = fetch_file(c_path)
            if c_content is not None and not any(t["path"] == c_path for t in tests):
                tests.append({
                    "path": c_path,
                    "content": c_content,
                    "failed_test": failure_info.get("failed_test"),
                })
                if len(tests) >= max_tests:
                    break

        # 3. Strategy-specific Build, Config, and Manifest files
        configuration: list[dict[str, Any]] = []
        build_files: list[dict[str, Any]] = []
        workflow_files: list[dict[str, Any]] = []

        relevant_configs = []
        if strategy == "DEPENDENCY":
            relevant_configs.extend(["requirements.txt", "pyproject.toml", "package.json", "setup.py", "Pipfile", "package-lock.json"])
        elif strategy == "IMPORT_ERROR":
            relevant_configs.extend(["requirements.txt", "pyproject.toml", "package.json", "setup.py"])
        elif strategy == "BUILD_FAILURE":
            relevant_configs.extend(["package.json", "tsconfig.json", "Makefile", "pom.xml", "build.gradle", "pyproject.toml", "setup.py"])
        elif strategy == "DOCKER_FAILURE":
            relevant_configs.extend(["Dockerfile", ".dockerignore", "docker-compose.yml", "requirements.txt", "package.json"])
        elif strategy == "LINT_FAILURE":
            relevant_configs.extend([".flake8", "setup.cfg", "pyproject.toml", ".eslintrc.json", ".eslintrc.js", "ruff.toml"])
        elif strategy == "TYPE_ERROR":
            relevant_configs.extend(["pyproject.toml", "mypy.ini", "tsconfig.json"])
        elif strategy == "DATABASE_FAILURE":
            relevant_configs.extend(["alembic.ini", "schema.sql", "models.py", "prisma/schema.prisma", "requirements.txt"])
        elif strategy == "DEPLOYMENT_FAILURE":
            relevant_configs.extend(["deploy.yml", "Dockerfile", "docker-compose.yml", "k8s/deployment.yaml", "serverless.yml"])
        elif strategy == "GITHUB_ACTION_FAILURE":
            # Will be retrieved under workflow_files
            relevant_configs.extend([])
        else:
            # Default / TEST_FAILURE / SYNTAX_ERROR
            relevant_configs.extend(["requirements.txt", "pyproject.toml", "package.json"])

        if expanded:
            relevant_configs.extend(["requirements.txt", "pyproject.toml", "package.json", "Dockerfile"])

        # Fetch configurations
        for cfg in set(relevant_configs):
            cfg_content = fetch_file(cfg)
            if cfg_content is not None:
                item = {"path": cfg, "content": cfg_content}
                if cfg in ["Dockerfile", "docker-compose.yml", "Makefile", ".dockerignore"]:
                    build_files.append(item)
                else:
                    configuration.append(item)

        # Retrieve workflow YAML if relevant or mentioned
        wf_path = failure_info.get("file") if (failure_info.get("file") or "").startswith(".github/workflows") else None
        wf_candidates = [wf_path] if wf_path else [".github/workflows/sentinelops-ci.yml", ".github/workflows/ci.yml", ".github/workflows/deploy.yml"]
        if strategy == "GITHUB_ACTION_FAILURE" or expanded:
            for wfc in wf_candidates:
                if wfc:
                    wfc_content = fetch_file(wfc)
                    if wfc_content is not None and not any(w["path"] == wfc for w in workflow_files):
                        workflow_files.append({"path": wfc, "content": wfc_content})

        # 4. Related files / imports (IMPORT_ERROR, TYPE_ERROR, TEST_FAILURE)
        related_files: list[dict[str, Any]] = []
        if target_file_obj and target_file_obj.get("content"):
            target_content = target_file_obj["content"]
            # Look for local imports e.g. from services.auth import ...
            import_matches = re.findall(r"(?:from|import)\s+([a-zA-Z0-9_.]+)", target_content)
            max_related = 4 if expanded else 2
            for imp in import_matches:
                rel_path = imp.replace(".", "/") + ".py"
                if rel_path != target_file_path and not rel_path.startswith("os") and not rel_path.startswith("sys"):
                    r_content = fetch_file(rel_path)
                    if r_content is not None:
                        related_files.append({"path": rel_path, "content": r_content})
                        if len(related_files) >= max_related:
                            break

        return {
            "strategy": strategy,
            "strategy_description": strategy_desc,
            "failure": failure_info,
            "target_file": target_file_obj,
            "related_files": related_files,
            "tests": tests,
            "configuration": configuration,
            "build_files": build_files,
            "workflow_files": workflow_files,
            "expanded": expanded,
        }

    def format_context_for_prompt(self, structured_context: dict[str, Any]) -> str:
        """
        Formats structured repository context into high-signal prompt sections
        for Diagnoser and FixSuggester agents.
        """
        sections = []

        # Strategy Header
        strategy = structured_context.get("strategy")
        strategy_desc = structured_context.get("strategy_description")
        if strategy:
            sections.append(f"=== SPECIALIZED INVESTIGATION STRATEGY: {strategy} ({strategy_desc}) ===")

        # Target file
        tf = structured_context.get("target_file", {})
        if tf and tf.get("path") and tf.get("content"):
            line_info = f" (Failure at line {tf.get('line')})" if tf.get("line") else ""
            sections.append(
                f"=== PRIMARY TARGET FILE: {tf['path']}{line_info} ===\n"
                f"{tf['content']}\n"
            )

        # Tests
        for t in structured_context.get("tests", []):
            test_info = f" (Failed test: {t.get('failed_test')})" if t.get("failed_test") else ""
            sections.append(
                f"=== RELEVANT TEST: {t['path']}{test_info} ===\n"
                f"{t['content']}\n"
            )

        # Configurations & Manifests
        for c in structured_context.get("configuration", []):
            sections.append(
                f"=== CONFIGURATION / DEPENDENCIES: {c['path']} ===\n"
                f"{c['content']}\n"
            )

        # Build files
        for b in structured_context.get("build_files", []):
            sections.append(
                f"=== BUILD FILE: {b['path']} ===\n"
                f"{b['content']}\n"
            )

        # Related files
        for r in structured_context.get("related_files", []):
            sections.append(
                f"=== RELATED MODULE: {r['path']} ===\n"
                f"{r['content']}\n"
            )

        # Workflow files
        for w in structured_context.get("workflow_files", []):
            sections.append(
                f"=== GITHUB ACTIONS WORKFLOW: {w['path']} ===\n"
                f"{w['content']}\n"
            )

        return "\n\n".join(sections) if sections else "No repository files retrieved."


# Singleton repository context retriever instance
repo_context_retriever = RepoContextRetriever()

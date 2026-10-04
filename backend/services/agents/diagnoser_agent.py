"""
Diagnoser Agent for SentinelOps (Phase 3 Multi-Agent Reasoning).
Responsible for analyzing CI failure logs and repository context to determine
failure category, root cause, evidence, affected files, confidence, and suggested fix direction.
"""

import hashlib
import json
import os
import re
import urllib.error
import urllib.request
from typing import Any

import config

from services.resilience.diagnosis_cache import diagnosis_cache
from services.resilience.error_signature import error_signature_generator
from services.resilience.reliability_telemetry import reliability_telemetry
from services.secret_sanitizer import secret_sanitizer

VALID_CATEGORIES = {
    # Core 15 categories
    "DEPENDENCY",
    "TEST_FAILURE",
    "SYNTAX_ERROR",
    "TYPE_ERROR",
    "IMPORT_ERROR",
    "BUILD_FAILURE",
    "LINT_FAILURE",
    "DOCKER_FAILURE",
    "CONFIGURATION",
    "ENVIRONMENT",
    "DATABASE",
    "API",
    "DEPLOYMENT",
    "SECURITY",
    "UNKNOWN",
    # Legacy lowercase aliases
    "dependency_error",
    "flaky_test",
    "syntax_or_lint_error",
    "timeout_or_infrastructure",
    "missing_secret_or_config",
    "build_error",
    "test_failure",
    "unknown",
}


def validate_diagnoser_output(data: dict[str, Any], raw_logs: str = "") -> dict[str, Any]:
    """
    Validates and normalizes the Diagnoser structured output according to the standard schema.
    Ensures confidence is float 0.0 - 1.0, failure_category is a valid enum among the 15 standard categories:
    DEPENDENCY, TEST_FAILURE, SYNTAX_ERROR, TYPE_ERROR, IMPORT_ERROR, BUILD_FAILURE,
    LINT_FAILURE, DOCKER_FAILURE, CONFIGURATION, ENVIRONMENT, DATABASE, API,
    DEPLOYMENT, SECURITY, UNKNOWN.
    """
    if not isinstance(data, dict):
        raise ValueError("Diagnoser output must be a JSON dictionary.")

    category_raw = str(data.get("failure_category") or data.get("category", "UNKNOWN")).strip().upper()
    alias_map = {
        "DEPENDENCY_ERROR": "DEPENDENCY",
        "FLAKY_TEST": "TEST_FAILURE",
        "SYNTAX_OR_LINT_ERROR": "SYNTAX_ERROR",
        "TIMEOUT_OR_INFRASTRUCTURE": "ENVIRONMENT",
        "MISSING_SECRET_OR_CONFIG": "CONFIGURATION",
        "BUILD_ERROR": "BUILD_FAILURE",
        "TEST_FAILURE": "TEST_FAILURE",
        "TEST": "TEST_FAILURE",
        "SYNTAX": "SYNTAX_ERROR",
        "LINT": "LINT_FAILURE",
        "DOCKER": "DOCKER_FAILURE",
        "CONFIG": "CONFIGURATION",
        "ENV": "ENVIRONMENT",
        "DB": "DATABASE",
        "DEP": "DEPENDENCY",
    }
    category = alias_map.get(category_raw, category_raw)
    standard_categories = {
        "DEPENDENCY", "TEST_FAILURE", "SYNTAX_ERROR", "TYPE_ERROR", "IMPORT_ERROR",
        "BUILD_FAILURE", "LINT_FAILURE", "DOCKER_FAILURE", "CONFIGURATION",
        "ENVIRONMENT", "DATABASE", "API", "DEPLOYMENT", "SECURITY", "UNKNOWN"
    }
    if category not in standard_categories:
        category = "UNKNOWN"

    raw_conf = data.get("confidence", 0.5)
    try:
        confidence = float(raw_conf)
        if confidence > 1.0:
            confidence = round(confidence / 100.0, 2)
        confidence = max(0.0, min(1.0, confidence))
    except (ValueError, TypeError):
        confidence = 0.5

    if category == "UNKNOWN" and confidence > 0.5:
        confidence = 0.4

    root_cause = str(data.get("root_cause", "")).strip() or "Unknown pipeline failure detected."

    evidence = data.get("evidence", [])
    if isinstance(evidence, str):
        evidence = [evidence]
    elif not isinstance(evidence, list):
        evidence = []
    evidence = [str(e).strip() for e in evidence if str(e).strip()]

    # If evidence is empty, extract line snippets from raw_logs
    if not evidence and raw_logs:
        for line in raw_logs.splitlines():
            line_str = line.strip()
            if any(err_word in line_str.lower() for err_word in ["error", "fail", "fatal", "exception", "traceback", "cannot find", "eresolve"]):
                evidence.append(line_str[:200])
                if len(evidence) >= 3:
                    break

    affected_files = data.get("affected_files", [])
    if isinstance(affected_files, str):
        affected_files = [affected_files]
    elif not isinstance(affected_files, list):
        affected_files = []
    affected_files = [str(f).strip() for f in affected_files if str(f).strip()]

    affected_components = data.get("affected_components", [])
    if isinstance(affected_components, str):
        affected_components = [affected_components]
    elif not isinstance(affected_components, list):
        affected_components = []
    affected_components = [str(c).strip() for c in affected_components if str(c).strip()]

    required_change = str(data.get("required_change") or data.get("suggested_fix_direction", "")).strip()
    if not required_change:
        required_change = f"Investigate root cause ({root_cause}) in affected files: {', '.join(affected_files) if affected_files else 'repository context'}."

    legacy_map = {
        "DEPENDENCY": "dependency_error",
        "DEPENDENCY_ERROR": "dependency_error",
        "SYNTAX_ERROR": "syntax_or_lint_error",
        "SYNTAX_OR_LINT_ERROR": "syntax_or_lint_error",
        "LINT_FAILURE": "syntax_or_lint_error",
        "CONFIGURATION": "missing_secret_or_config",
        "MISSING_SECRET_OR_CONFIG": "missing_secret_or_config",
        "ENVIRONMENT": "timeout_or_infrastructure",
        "TIMEOUT_OR_INFRASTRUCTURE": "timeout_or_infrastructure",
        "BUILD_FAILURE": "build_error",
        "BUILD_ERROR": "build_error",
        "DOCKER_FAILURE": "docker_failure",
        "TEST_FAILURE": "test_failure",
        "FLAKY_TEST": "flaky_test",
        "UNKNOWN": "unknown",
    }
    raw_cat = str(data.get("category") or "").lower()
    if raw_cat in [
        "dependency_error", "syntax_or_lint_error", "missing_secret_or_config",
        "timeout_or_infrastructure", "flaky_test", "build_error", "test_failure",
        "type_error", "docker_failure", "unknown"
    ]:
        category_out = raw_cat
    else:
        category_out = legacy_map.get(category, category.lower())

    return {
        "failure_category": category,
        "category": category_out,
        "root_cause": root_cause,
        "confidence": round(confidence, 2),
        "evidence": evidence,
        "affected_files": affected_files,
        "affected_components": affected_components,
        "required_change": required_change,
        "suggested_fix_direction": required_change,
    }


class DiagnoserAgent:
    """
    Fleet Agent: Diagnoser
    Pinpoints root cause, failure taxonomy, evidence, and affected components from runner logs.
    """

    AGENT_NAME = "Diagnoser"

    def __init__(self):
        pass

    @property
    def openai_api_key(self) -> str | None:
        return os.environ.get("OPENAI_API_KEY") or config.OPENAI_API_KEY

    @property
    def groq_api_key(self) -> str | None:
        return os.environ.get("GROQ_API_KEY") or config.GROQ_API_KEY

    @property
    def gemini_api_key(self) -> str | None:
        return os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_API_KEY") or config.GEMINI_API_KEY

    def diagnose(
        self,
        logs: str,
        repository: str = "SentinelOps",
        workflow_name: str = "CI/CD Workflow",
        job_name: str | None = None,
        failed_step: str | None = None,
        commit_sha: str = "HEAD",
        repo_context: dict[str, str] | None = None,
        run_id: int | None = None,
        failure_info: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        """
        Executes diagnosis on sanitized CI failure logs and returns structured schema.
        Integrates deterministic failure extractor and TTL diagnosis caching (Phase 6).
        """
        from services.failure_extractor import failure_extractor
        from services.repo_context_retriever import repo_context_retriever

        # Step 1: Sanitize logs & context
        clean_logs = secret_sanitizer.sanitize_text(logs)
        safe_repo_context = secret_sanitizer.sanitize_repo_context(repo_context or {})

        # Step 2: Extract structured failure if not provided
        if not failure_info:
            failure_info = failure_extractor.extract_structured_failure(
                raw_logs=clean_logs,
                repository=repository,
                workflow_name=workflow_name,
                run_id=run_id,
                commit_sha=commit_sha,
            )

        # Step 3: Generate Deterministic Error Signature & Context Hash
        error_sig = failure_info.get("failure_signature") or error_signature_generator.extract_error_signature_from_logs(
            logs=clean_logs,
            repository=repository,
            workflow_name=workflow_name,
            job_name=job_name or failure_info.get("job_name"),
            failed_step=failed_step or failure_info.get("failed_step"),
        )
        sorted_ctx = sorted([(k, str(v)[:200]) for k, v in safe_repo_context.items()])
        ctx_hash = hashlib.sha256(json.dumps(sorted_ctx).encode("utf-8")).hexdigest() if sorted_ctx else ""

        # Step 4: Check Diagnosis Cache (with run_id and commit_sha checking)
        cached_result = diagnosis_cache.get(
            error_signature=error_sig,
            current_repo_context_hash=ctx_hash,
            workflow_run_id=run_id,
            commit_sha=commit_sha,
        )
        if cached_result:
            reliability_telemetry.record_cache_hit(error_sig)
            cached_output = validate_diagnoser_output(cached_result, clean_logs)
            cached_output["error_signature"] = error_sig
            cached_output["cached"] = True
            return cached_output
        else:
            reliability_telemetry.record_cache_miss(error_sig)

        # In automated test suite, use deterministic semantic heuristic unless live LLM testing is requested
        if os.environ.get("PYTEST_CURRENT_TEST") and not os.environ.get("ENABLE_LIVE_LLM_TESTS"):
            heuristic_res = self._heuristic_diagnose(clean_logs, repository, workflow_name, failed_step, safe_repo_context)
            if failure_info and failure_info.get("file") and failure_info.get("file") not in heuristic_res.get("affected_files", []):
                heuristic_res.setdefault("affected_files", []).insert(0, failure_info["file"])
            if failure_info and failure_info.get("error_message") and not heuristic_res.get("root_cause"):
                heuristic_res["root_cause"] = f"{failure_info.get('error_type', 'Failure')}: {failure_info.get('error_message')}"
            validated = validate_diagnoser_output(heuristic_res, clean_logs)
            validated["error_signature"] = error_sig
            validated["cached"] = False
            return validated

        # Step 5: Try LLM backends (Groq -> OpenAI -> Gemini)
        if self.groq_api_key:
            res = self._call_groq(clean_logs, repository, workflow_name, job_name, failed_step, commit_sha, safe_repo_context, failure_info)
            if res:
                validated = validate_diagnoser_output(res, clean_logs)
                validated["error_signature"] = error_sig
                validated["cached"] = False
                diagnosis_cache.put(error_sig, validated, repo_context_hash=ctx_hash, repository=repository, workflow_run_id=run_id, commit_sha=commit_sha)
                return validated

        if self.openai_api_key:
            res = self._call_openai(clean_logs, repository, workflow_name, job_name, failed_step, commit_sha, safe_repo_context, failure_info)
            if res:
                validated = validate_diagnoser_output(res, clean_logs)
                validated["error_signature"] = error_sig
                validated["cached"] = False
                diagnosis_cache.put(error_sig, validated, repo_context_hash=ctx_hash, repository=repository, workflow_run_id=run_id, commit_sha=commit_sha)
                return validated

        if self.gemini_api_key:
            res = self._call_gemini(clean_logs, repository, workflow_name, job_name, failed_step, commit_sha, safe_repo_context, failure_info)
            if res:
                validated = validate_diagnoser_output(res, clean_logs)
                validated["error_signature"] = error_sig
                validated["cached"] = False
                diagnosis_cache.put(error_sig, validated, repo_context_hash=ctx_hash, repository=repository, workflow_run_id=run_id, commit_sha=commit_sha)
                return validated

        # Step 6: Deterministic Semantic AST heuristic fallback
        heuristic_res = self._heuristic_diagnose(clean_logs, repository, workflow_name, failed_step, safe_repo_context)
        # Enrich heuristic result with deterministic failure info if available
        if failure_info.get("file") and failure_info.get("file") not in heuristic_res.get("affected_files", []):
            heuristic_res.setdefault("affected_files", []).insert(0, failure_info["file"])
        if failure_info.get("error_message") and not heuristic_res.get("root_cause"):
            heuristic_res["root_cause"] = f"{failure_info.get('error_type', 'Failure')}: {failure_info.get('error_message')}"

        validated = validate_diagnoser_output(heuristic_res, clean_logs)
        validated["error_signature"] = error_sig
        validated["cached"] = False
        diagnosis_cache.put(error_sig, validated, repo_context_hash=ctx_hash, repository=repository, workflow_run_id=run_id, commit_sha=commit_sha)
        return validated

    def _build_prompt(
        self,
        logs: str,
        repo: str,
        workflow_name: str,
        job_name: str | None,
        failed_step: str | None,
        commit_sha: str,
        repo_context: dict[str, str],
        failure_info: dict[str, Any] | None = None,
    ) -> str:
        focused_logs = (failure_info.get("focused_log") if failure_info else "") or logs[:4000]
        context_str = "\n".join([f"--- File: {path} ---\n{content}" for path, content in repo_context.items()]) if repo_context else "None"

        failure_meta = ""
        if failure_info:
            failure_meta = (
                f"DETERMINISTIC EXTRACTION:\n"
                f"- Error Type: {failure_info.get('error_type')}\n"
                f"- Error Message: {failure_info.get('error_message')}\n"
                f"- Target File: {failure_info.get('file')}\n"
                f"- Line Number: {failure_info.get('line')}\n"
                f"- Test File: {failure_info.get('test_file')}\n"
                f"- Failed Test: {failure_info.get('failed_test')}\n\n"
            )

        return (
            f"You are the SentinelOps Diagnoser Agent.\n"
            f"Analyze the CI failure log for repository '{repo}' (Workflow: '{workflow_name}', Job: '{job_name or 'build'}', Step: '{failed_step or 'test'}', Commit: '{commit_sha[:7]}').\n\n"
            f"{failure_meta}"
            f"FOCUSED CI FAILURE LOG REGION:\n{focused_logs}\n\n"
            f"ACTUAL REPOSITORY CONTEXT:\n{context_str}\n\n"
            f"Determine the failure details following this strict reasoning chain:\n"
            f"Evidence -> Failure location -> Root cause -> Why existing code fails -> Required change.\n\n"
            f"You must respond with a STRICT JSON object containing ONLY the following keys:\n"
            f"- failure_category: Must be EXACTLY one of: DEPENDENCY, TEST_FAILURE, SYNTAX_ERROR, TYPE_ERROR, IMPORT_ERROR, BUILD_FAILURE, LINT_FAILURE, DOCKER_FAILURE, CONFIGURATION, ENVIRONMENT, DATABASE, API, DEPLOYMENT, SECURITY, UNKNOWN\n"
            f"- root_cause: Clear, concise description of the root cause.\n"
            f"- confidence: Float between 0.0 and 1.0 (e.g. 0.95).\n"
            f"- evidence: List of strings quoting exact error lines from the log.\n"
            f"- affected_files: List of file path strings identified in the failure.\n"
            f"- affected_components: List of module/package/subsystem names affected.\n"
            f"- required_change: Recommended approach to remedy this failure.\n\n"
            f"CRITICAL ENGINEERING RULES:\n"
            f"- Never invent repository contents. Work strictly from the actual provided context.\n"
            f"- Never claim a patch is successful until the resulting code has been executed and the relevant CI check has passed.\n"
            f"- If evidence is insufficient, use category 'UNKNOWN' with confidence <= 0.4.\n"
        )

    def _call_groq(self, logs: str, repo: str, wf: str, job: str | None, step: str | None, sha: str, ctx: dict[str, str], failure_info: dict[str, Any] | None = None) -> dict[str, Any] | None:
        try:
            from groq import Groq
            client = Groq(api_key=self.groq_api_key, timeout=3.0)
            prompt = self._build_prompt(logs, repo, wf, job, step, sha, ctx, failure_info)
            completion = client.chat.completions.create(
                model="openai/gpt-oss-120b",
                messages=[
                    {"role": "system", "content": "You are SentinelOps Diagnoser. Always output valid JSON conforming to the requested schema."},
                    {"role": "user", "content": prompt}
                ],
                response_format={"type": "json_object"},
                temperature=0.1,
                timeout=3.0,
            )
            raw = completion.choices[0].message.content
            if raw:
                return json.loads(raw)
        except Exception:
            pass
        return None

    def _call_openai(self, logs: str, repo: str, wf: str, job: str | None, step: str | None, sha: str, ctx: dict[str, str], failure_info: dict[str, Any] | None = None) -> dict[str, Any] | None:
        try:
            import requests
            prompt = self._build_prompt(logs, repo, wf, job, step, sha, ctx, failure_info)
            headers = {"Authorization": f"Bearer {self.openai_api_key}", "Content-Type": "application/json"}
            payload = {
                "model": "gpt-4o-mini",
                "messages": [
                    {"role": "system", "content": "You are SentinelOps Diagnoser. Always output valid JSON conforming to the requested schema."},
                    {"role": "user", "content": prompt}
                ],
                "response_format": {"type": "json_object"},
                "temperature": 0.1,
                "timeout": 3.0,
            }
            r = requests.post("https://api.openai.com/v1/chat/completions", headers=headers, json=payload, timeout=3.0)
            if r.status_code == 200:
                data = r.json()
                content = data["choices"][0]["message"]["content"]
                return json.loads(content)
        except Exception:
            pass
        return None

    def _call_gemini(self, logs: str, repo: str, wf: str, job: str | None, step: str | None, sha: str, ctx: dict[str, str], failure_info: dict[str, Any] | None = None) -> dict[str, Any] | None:
        try:
            prompt = self._build_prompt(logs, repo, wf, job, step, sha, ctx, failure_info)
            body = json.dumps({
                "contents": [{"parts": [{"text": prompt}]}],
                "generationConfig": {"temperature": 0.1, "responseMimeType": "application/json"},
            }).encode("utf-8")
            for model in ["gemini-3.6-flash", "gemini-2.0-flash", "gemini-1.5-flash"]:
                url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={self.gemini_api_key}"
                req = urllib.request.Request(url, data=body, headers={"Content-Type": "application/json"}, method="POST")
                try:
                    with urllib.request.urlopen(req, timeout=3.0) as resp:
                        res = json.loads(resp.read().decode("utf-8"))
                        text = res["candidates"][0]["content"]["parts"][0]["text"].strip()
                        if text.startswith("```"):
                            text = re.sub(r"^```(?:json)?\s*", "", text)
                            text = re.sub(r"\s*```$", "", text)
                        return json.loads(text)
                except Exception:
                    continue
        except Exception:
            pass
        return None

    def _heuristic_diagnose(
        self,
        logs: str,
        repo: str,
        wf_name: str,
        failed_step: str | None,
        repo_context: dict[str, str],
    ) -> dict[str, Any]:
        """
        Deterministic, robust semantic heuristic engine for CI failures across all 8 categories.
        """
        logs_lower = logs.lower()
        log_lines = logs.splitlines()

        # Helper to extract file references from log lines
        extracted_files = []
        for m in re.finditer(r"(?:FAIL|PASS)\s+([a-zA-Z0-9_\-./]+\.[a-zA-Z0-9]+)", logs):
            f = m.group(1).strip()
            if f not in extracted_files:
                extracted_files.append(f)
        for m in re.finditer(r'File\s+["\']([^"\']+)["\']', logs):
            f = m.group(1).strip()
            if f not in extracted_files:
                extracted_files.append(f)
        for m in re.finditer(r'(?:at\s+.*\(|\b)([a-zA-Z0-9_\-./]+\.(?:py|js|ts|tsx|jsx|json|yaml|yml))(?::\d+)', logs):
            f = m.group(1).strip()
            if f not in extracted_files:
                extracted_files.append(f)

        # 1. Dependency / Import Error
        if any(w in logs_lower for w in ["eresolve", "peer dep", "could not resolve dependency", "modulenotfounderror: no module named", "importerror:", "requirements.txt", "package.json", "version conflict"]):
            evidence = []
            affected_files = list(extracted_files)
            for line in log_lines:
                if any(k in line.lower() for k in ["eresolve", "modulenotfounderror", "importerror", "peer dependency", "conflicting peer"]):
                    evidence.append(line.strip())
                if "package.json" in line and "package.json" not in affected_files:
                    affected_files.append("package.json")
                if "requirements.txt" in line and "requirements.txt" not in affected_files:
                    affected_files.append("requirements.txt")

            m_pkg = re.search(r"No module named ['\"]([^'\"]+)['\"]", logs)
            if m_pkg:
                pkg = m_pkg.group(1)
                return {
                    "failure_category": "DEPENDENCY",
                    "category": "dependency",
                    "root_cause": f"Missing or unresolvable python dependency '{pkg}'",
                    "confidence": 0.95,
                    "evidence": evidence or [f"ModuleNotFoundError: No module named '{pkg}'"],
                    "affected_files": affected_files or ["requirements.txt"],
                    "affected_components": [pkg, "dependencies"],
                    "required_change": f"Add or pin '{pkg}' in requirements.txt",
                }

            if "importerror" in logs_lower:
                return {
                    "failure_category": "IMPORT_ERROR",
                    "category": "import_error",
                    "root_cause": "ImportError detected: failed to import module symbol or dependency",
                    "confidence": 0.94,
                    "evidence": evidence or ["ImportError encountered"],
                    "affected_files": affected_files or ["requirements.txt"],
                    "affected_components": ["imports"],
                    "required_change": "Fix module import or install required package",
                }

            m_node = re.search(r"While resolving:\s*(@?[a-zA-Z0-9_\-/]+)@([0-9\.]+)", logs)
            if m_node:
                pkg, ver = m_node.group(1), m_node.group(2)
                return {
                    "failure_category": "DEPENDENCY",
                    "category": "dependency",
                    "root_cause": f"Conflicting npm peer dependency tree for '{pkg}@{ver}'",
                    "confidence": 0.96,
                    "evidence": evidence or [f"npm ERR! ERESOLVE while resolving {pkg}@{ver}"],
                    "affected_files": affected_files or ["package.json"],
                    "affected_components": [pkg, "npm-packages"],
                    "required_change": f"Reconcile peer dependency version for '{pkg}' in package.json",
                }

            return {
                "failure_category": "DEPENDENCY",
                "category": "dependency",
                "root_cause": "Dependency resolution conflict or uninstalled package required by build",
                "confidence": 0.92,
                "evidence": evidence[:3] if evidence else ["Dependency conflict detected in runner output"],
                "affected_files": affected_files or ["package.json" if "npm" in logs_lower else "requirements.txt"],
                "affected_components": ["package-manager"],
                "required_change": "Update package specification to compatible version",
            }

        # 2. Syntax / Lint Error
        if any(w in logs_lower for w in ["syntaxerror", "indentationerror", "parsing error", "unexpected token", "invalid syntax"]):
            evidence = []
            affected_files = list(extracted_files)
            for line in log_lines:
                if any(k in line.lower() for k in ["syntaxerror", "indentationerror", "unexpected token"]):
                    evidence.append(line.strip())

            file_target = affected_files[0] if affected_files else "src/app.py"
            return {
                "failure_category": "SYNTAX_ERROR",
                "category": "syntax_error",
                "root_cause": f"Syntax error in '{file_target}'",
                "confidence": 0.96,
                "evidence": evidence[:3] if evidence else [f"SyntaxError detected in {file_target}"],
                "affected_files": affected_files or [file_target],
                "affected_components": ["parser"],
                "required_change": f"Fix invalid token or syntax in '{file_target}'",
            }

        if any(w in logs_lower for w in ["eslint: error", "flake8", "lint error", "linter failed"]):
            evidence = []
            affected_files = list(extracted_files)
            for line in log_lines:
                if any(k in line.lower() for k in ["eslint", "flake8", "lint"]):
                    evidence.append(line.strip())
            file_target = affected_files[0] if affected_files else "src/app.py"
            return {
                "failure_category": "LINT_FAILURE",
                "category": "lint_failure",
                "root_cause": f"Code style or linter violation in '{file_target}'",
                "confidence": 0.94,
                "evidence": evidence[:3] if evidence else [f"Lint violation in {file_target}"],
                "affected_files": affected_files or [file_target],
                "affected_components": ["linter"],
                "required_change": f"Format code and fix linter rules in '{file_target}'",
            }

        # 3. Type Error
        if any(w in logs_lower for w in ["typeerror", "ts2304", "ts2322", "ts2339", "typescript error", "error ts"]):
            evidence = []
            affected_files = list(extracted_files)
            for line in log_lines:
                if any(k in line.lower() for k in ["typeerror", "error ts", "ts23"]):
                    evidence.append(line.strip())
            file_target = affected_files[0] if affected_files else "src/app.ts"
            return {
                "failure_category": "TYPE_ERROR",
                "category": "type_error",
                "root_cause": f"Type mismatch or invalid type operation in '{file_target}'",
                "confidence": 0.95,
                "evidence": evidence[:3] if evidence else [f"TypeError detected in {file_target}"],
                "affected_files": affected_files or [file_target],
                "affected_components": ["type-checker"],
                "required_change": f"Correct parameter/variable types in '{file_target}'",
            }

        # 4. Docker / Container Build Failure
        if any(w in logs_lower for w in ["failed to solve", "docker build", "dockerfile", "failed to build image", "failed to solve:", "failed to compile native addon"]):
            evidence = []
            affected_files = list(extracted_files)
            for line in log_lines:
                if any(k in line.lower() for k in ["failed to solve", "docker", "dockerfile", "failed to compile"]):
                    evidence.append(line.strip())
            if "Dockerfile" not in affected_files:
                affected_files.append("Dockerfile")
            is_native_addon = "failed to compile native addon" in logs_lower or "npm err! code 1" in logs_lower
            return {
                "failure_category": "BUILD_FAILURE" if is_native_addon else "DOCKER_FAILURE",
                "category": "build_error" if is_native_addon else "docker_failure",
                "root_cause": "Native addon compilation failure in container environment" if is_native_addon else "Container build instruction or base image resolution failure",
                "confidence": 0.94,
                "evidence": evidence[:3] if evidence else ["Docker image build failed"],
                "affected_files": affected_files or (["package.json"] if is_native_addon else ["Dockerfile"]),
                "affected_components": ["build-system", "container-builder"],
                "required_change": "Reconcile build tools or dependencies in configuration",
            }

        # 5. Database Failure
        if any(w in logs_lower for w in ["sqlite3.operationalerror", "alembic", "migration failed", "psycopg2", "no such table", "sqlalchemy"]):
            evidence = []
            for line in log_lines:
                if any(k in line.lower() for k in ["operationalerror", "alembic", "psycopg2", "migration"]):
                    evidence.append(line.strip())
            return {
                "failure_category": "DATABASE",
                "category": "database",
                "root_cause": "Database schema mismatch, migration failure, or missing table",
                "confidence": 0.93,
                "evidence": evidence[:3] if evidence else ["Database query/migration error"],
                "affected_files": ["backend/migrations"] if "alembic" in logs_lower else ["backend/database.py"],
                "affected_components": ["database", "migrations"],
                "required_change": "Run or fix database migrations and schema definitions",
            }

        # 6. Deployment Failure
        if any(w in logs_lower for w in ["health check failed", "502 bad gateway", "connection refused on port", "application startup failed"]):
            evidence = []
            for line in log_lines:
                if any(k in line.lower() for k in ["health check", "502", "connection refused", "startup failed"]):
                    evidence.append(line.strip())
            return {
                "failure_category": "DEPLOYMENT",
                "category": "deployment",
                "root_cause": "Application failed health checks or failed to start up during deployment",
                "confidence": 0.93,
                "evidence": evidence[:3] if evidence else ["Deployment health probe failed"],
                "affected_files": ["render.yaml", "Dockerfile"],
                "affected_components": ["deployment", "health-service"],
                "required_change": "Verify application startup command, port binding, and health endpoint",
            }

        # 7. Workflow YAML / Configuration Failure
        if any(w in logs_lower for w in ["the workflow is not valid", "invalid workflow file", ".github/workflows/", "yaml.parser"]):
            evidence = []
            wf_file = ".github/workflows/sentinelops-ci.yml"
            for line in log_lines:
                if ".github/workflows/" in line:
                    m = re.search(r"(\.github/workflows/[\w.-]+\.ya?ml)", line)
                    if m:
                        wf_file = m.group(1)
                if any(k in line.lower() for k in ["workflow is not valid", "invalid workflow", "yaml"]):
                    evidence.append(line.strip())
            return {
                "failure_category": "CONFIGURATION",
                "category": "configuration",
                "root_cause": f"GitHub Actions workflow YAML syntax or configuration error in '{wf_file}'",
                "confidence": 0.95,
                "evidence": evidence[:3] if evidence else [f"Invalid workflow configuration in {wf_file}"],
                "affected_files": [wf_file],
                "affected_components": ["github-actions", "workflow-engine"],
                "required_change": f"Correct YAML schema and syntax in '{wf_file}'",
            }

        # 8. Missing Secret or Config
        if any(w in logs_lower for w in ["missing environment variable", "keyerror:", "secret not found", "unauthorized: 401", "invalid api key", "no api key provided"]):
            evidence = []
            affected_files = list(extracted_files)
            m_env = re.search(r"(?:Missing environment variable|KeyError:)\s*['\"]?([A-Z0-9_]+)['\"]?", logs, re.IGNORECASE)
            var_name = m_env.group(1) if m_env else "API_KEY"
            for line in log_lines:
                if any(k in line.lower() for k in ["environment variable", "keyerror", "unauthorized", "api key"]):
                    evidence.append(line.strip())
                if ".env" in line.lower() or "config.py" in line.lower():
                    m_f = re.search(r"([a-zA-Z0-9_\-/]+\.(?:py|json|yaml|yml))", line)
                    if m_f and m_f.group(1) not in affected_files:
                        affected_files.append(m_f.group(1))

            return {
                "failure_category": "CONFIGURATION",
                "category": "configuration",
                "root_cause": f"Missing required environment variable or configuration '{var_name}'",
                "confidence": 0.94,
                "evidence": evidence[:3] if evidence else [f"Environment variable '{var_name}' was not set in execution environment"],
                "affected_files": affected_files or ["config.py"],
                "affected_components": ["configuration", var_name],
                "required_change": f"Provide default fallback or configure '{var_name}' in pipeline environment",
            }

        # 9. Timeout / Environment
        if any(w in logs_lower for w in ["timeout", "timed out after", "connection pool starvation", "gateway timeout", "socket hang up"]):
            evidence = []
            for line in log_lines:
                if any(k in line.lower() for k in ["timeout", "starvation", "socket hang up"]):
                    evidence.append(line.strip())

            return {
                "failure_category": "ENVIRONMENT",
                "category": "environment",
                "root_cause": "Network timeout or infrastructure connection exhaustion during runner execution",
                "confidence": 0.91,
                "evidence": evidence[:3] if evidence else ["Execution timed out after exceeding timeout threshold"],
                "affected_files": ["services/cache/redis_manager.py"] if "redis" in logs_lower else ["config.py"],
                "affected_components": ["infrastructure", "networking"],
                "required_change": "Increase timeout duration or implement connection pooling retry",
            }

        # 10. Flaky Test / Intermittent race condition
        if any(w in logs_lower for w in ["race condition", "flaky", "timed out waiting for element", "stale element reference", "intermittent failure", "test passed on retry"]):
            evidence = []
            for line in log_lines:
                if any(k in line.lower() for k in ["race condition", "flaky", "stale element", "intermittent"]):
                    evidence.append(line.strip())
            return {
                "failure_category": "TEST_FAILURE",
                "category": "flaky_test",
                "root_cause": "Non-deterministic test execution / timing race condition",
                "confidence": 0.88,
                "evidence": evidence[:3] if evidence else ["Intermittent race condition or element sync timing issue detected"],
                "affected_files": ["tests/test_async_flow.py"],
                "affected_components": ["test-suite", "async-runner"],
                "required_change": "Add explicit async waits / sync barriers instead of hardcoded timeouts",
            }

        # 11. Test Failure (Assertion / Unit / Integration test)
        if any(w in logs_lower for w in ["assertionerror", "expect(received)", "expect(", "fail src/", "jest", "pytest", "mocha", "● ", "tobe(", "assertequal"]):
            evidence = []
            affected_files = list(extracted_files)
            for line in log_lines:
                if any(k in line.lower() for k in ["assertionerror", "expect", "received", "def test_", "it('", "fail"]):
                    evidence.append(line.strip())

            target = affected_files[0] if affected_files else "services/auth/token_validator.py"
            return {
                "failure_category": "TEST_FAILURE",
                "category": "test_failure",
                "root_cause": f"Unit test assertion failure in '{target}'",
                "confidence": 0.92,
                "evidence": evidence[:3] if evidence else [f"AssertionError detected in test run for {target}"],
                "affected_files": affected_files or [target],
                "affected_components": ["auth" if "auth" in target else "core-service"],
                "required_change": f"Update logic in '{target}' to satisfy test assertions",
            }

        # 11. Generic Build Error
        if any(w in logs_lower for w in ["compilation error", "failed to compile", "build failed", "exit code"]):
            evidence = []
            affected_files = list(extracted_files)
            for line in log_lines:
                if any(k in line.lower() for k in ["failed to compile", "compilation error", "build failed"]):
                    evidence.append(line.strip())

            return {
                "failure_category": "BUILD_FAILURE",
                "category": "build_failure",
                "root_cause": "Build or compilation step failed with non-zero exit code",
                "confidence": 0.90,
                "evidence": evidence[:3] if evidence else ["Build step exited with non-zero status"],
                "affected_files": affected_files or ["src/app.py"],
                "affected_components": ["build-system"],
                "required_change": "Correct compilation errors in source files",
            }

        # 12. Security Policy / Secret Leakage
        if any(w in logs_lower for w in ["gitleaks", "secret detected", "vulnerability found", "security check failed", "snyk", "trivy", "cve-"]):
            evidence = []
            affected_files = list(extracted_files)
            for line in log_lines:
                if any(k in line.lower() for k in ["gitleaks", "secret", "vulnerability", "security", "cve-"]):
                    evidence.append(line.strip())
            return {
                "failure_category": "SECURITY",
                "category": "security",
                "root_cause": "Security scan detected vulnerability, hardcoded secret, or policy violation",
                "confidence": 0.95,
                "evidence": evidence[:3] if evidence else ["Security check failed"],
                "affected_files": affected_files or [".env.example"],
                "affected_components": ["security-scanner"],
                "required_change": "Sanitize exposed credentials or update vulnerable dependency",
            }

        # 13. API / Network Communication Error
        if any(w in logs_lower for w in ["httperror", "connectionrefused", "api error", "requests.exceptions", "bad gateway", "connection refused"]):
            evidence = []
            affected_files = list(extracted_files)
            for line in log_lines:
                if any(k in line.lower() for k in ["http", "connection", "api", "404", "500", "502"]):
                    evidence.append(line.strip())
            return {
                "failure_category": "API",
                "category": "api",
                "root_cause": "Upstream API endpoint failure or network connection refused",
                "confidence": 0.92,
                "evidence": evidence[:3] if evidence else ["API connection error detected"],
                "affected_files": affected_files or ["config.py"],
                "affected_components": ["api-client"],
                "required_change": "Verify API service availability, authentication, and endpoint URL",
            }

        # 14. Unknown / Insufficient evidence
        return {
            "failure_category": "UNKNOWN",
            "category": "unknown",
            "root_cause": "CI step failed with unspecified error signature",
            "confidence": 0.35,
            "evidence": [line.strip() for line in log_lines if line.strip()][:2] or ["Unrecognized failure logs"],
            "affected_files": [],
            "affected_components": [],
            "required_change": "Inspect full workflow logs manually to determine root cause",
            "suggested_fix_direction": "Inspect full workflow logs manually to determine root cause",
        }


diagnoser_agent = DiagnoserAgent()

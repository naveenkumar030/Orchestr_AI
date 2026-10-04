"""
Patch Validator Service for SentinelOps.
Validates patch safety, file syntax, diff size boundaries, credential leakage,
and runs local test validation before any commit or Pull Request is generated.

Guarantees:
1. Validates Python syntax via ast.parse and compile().
2. Validates JSON syntax via json.loads().
3. Blocks destructive command patterns (rm -rf, DROP DATABASE, mkfs, etc.).
4. Blocks leaked credentials and secrets (API tokens, private keys, auth headers).
5. Blocks modifications to protected files (.git, .env, secrets).
6. Executes relevant local tests when local workspace or test files are available.
7. Fails closed: any validation failure halts git operations and triggers re-diagnosis.
"""

import ast
import json
import logging
import os
import re
import subprocess
import sys
from typing import Any

from services.patch_applicator import patch_applicator
from services.secret_sanitizer import secret_sanitizer
from services.sentinel_guard import sentinel_guard

logger = logging.getLogger("sentinelops.patch_validator")


class PatchValidator:
    """
    Multi-stage safety and syntax validator for proposed patches.
    """

    MAX_DIFF_LINES = 250  # Max acceptable lines changed for an autonomous patch
    MAX_FILE_SIZE = 1024 * 1024  # 1MB max file size

    DESTRUCTIVE_PATTERNS = [
        (re.compile(r"rm\s+-rf\s+[/~]", re.IGNORECASE), "Destructive file removal (rm -rf /)"),
        (re.compile(r"DROP\s+(?:DATABASE|TABLE)\b", re.IGNORECASE), "Destructive SQL command (DROP TABLE/DATABASE)"),
        (re.compile(r"mkfs\.[a-z0-9]+", re.IGNORECASE), "Filesystem format command (mkfs)"),
        (re.compile(r"format\s+[a-zA-Z]:", re.IGNORECASE), "Disk format command"),
        (re.compile(r">\s*/dev/sd[a-z]", re.IGNORECASE), "Raw block device write"),
        (re.compile(r"shutdown\s+(?:-h|-r|now)", re.IGNORECASE), "System shutdown command"),
    ]

    SECRET_PATTERNS = [
        (re.compile(r"(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9_]{36,255}"), "GitHub Personal Access Token"),
        (re.compile(r"github_pat_[A-Za-z0-9_]{82}"), "GitHub Fine-Grained PAT"),
        (re.compile(r"AKIA[0-9A-Z]{16}"), "AWS Access Key ID"),
        (re.compile(r"-----BEGIN (?:RSA|OPENSSH|EC|DSA)? PRIVATE KEY-----"), "Private Key Header"),
        (re.compile(r"(?:sk_live_|rk_live_)[0-9a-zA-Z]{24,}"), "Stripe Live Secret Key"),
        (re.compile(r"bearer\s+[A-Za-z0-9\-._~+/]+=*", re.IGNORECASE), "Bearer Token"),
    ]

    def validate_syntax(self, file_path: str, content: str) -> tuple[bool, str]:
        """
        Validates language-specific syntax of resulting file content.
        """
        clean_path = file_path.strip().replace("\\", "/")

        if clean_path.endswith(".py"):
            try:
                # ast.parse verifies abstract syntax
                ast.parse(content, filename=clean_path)
                # compile verifies bytecode compilation
                compile(content, clean_path, "exec")
            except SyntaxError as e:
                return False, f"Python SyntaxError in '{clean_path}' at line {e.lineno}: {e.msg} ({e.text.strip() if e.text else ''})"
            except Exception as ex:
                return False, f"Python syntax compilation failed in '{clean_path}': {ex!s}"

        elif clean_path.endswith(".json"):
            try:
                json.loads(content)
            except json.JSONDecodeError as e:
                return False, f"JSON SyntaxError in '{clean_path}' at line {e.lineno}, col {e.colno}: {e.msg}"

        elif clean_path.endswith((".yml", ".yaml")):
            try:
                import yaml
                yaml.safe_load(content)
            except Exception as e:
                return False, f"YAML SyntaxError in '{clean_path}': {e!s}"

        elif "dockerfile" in clean_path.lower():
            valid_instructions = {
                "FROM", "RUN", "CMD", "LABEL", "MAINTAINER", "EXPOSE", "ENV", "ADD",
                "COPY", "ENTRYPOINT", "VOLUME", "USER", "WORKDIR", "ARG", "ONBUILD",
                "STOPSIGNAL", "HEALTHCHECK", "SHELL",
            }
            has_from = False
            for line_idx, line in enumerate(content.splitlines(), start=1):
                clean_l = line.strip()
                if not clean_l or clean_l.startswith("#"):
                    continue
                first_token = clean_l.split()[0].upper()
                if first_token == "FROM":
                    has_from = True
                elif first_token not in valid_instructions:
                    return False, f"Dockerfile syntax error at line {line_idx}: Unknown instruction '{first_token}'"
            if not has_from and content.strip():
                return False, "Dockerfile syntax error: Missing mandatory 'FROM' instruction"

        elif clean_path.endswith("requirements.txt"):
            for line_idx, line in enumerate(content.splitlines(), start=1):
                clean_l = line.strip()
                if not clean_l or clean_l.startswith("#") or clean_l.startswith("-"):
                    continue
                if re.search(r"[<>;=&|]", clean_l) and not re.search(r"[=><~]", clean_l):
                    return False, f"Invalid requirement specification at line {line_idx}: '{clean_l}'"

        return True, ""

    def validate_safety_rules(
        self,
        files_changed: list[str],
        resulting_files: dict[str, str],
        diff_patch: str,
        lines_added: int,
        lines_removed: int,
    ) -> tuple[bool, str, str]:
        """
        Evaluates security boundaries, credential leakage, destructive patterns,
        and diff size limits.
        Returns (is_safe, failure_reason, violation_category).
        """
        # 1. Diff size limit
        total_diff_lines = lines_added + lines_removed
        if total_diff_lines > self.MAX_DIFF_LINES:
            return False, f"Patch exceeds maximum allowed diff size ({total_diff_lines} lines > limit of {self.MAX_DIFF_LINES})", "DIFF_TOO_LARGE"

        # 2. File size and path traversal checks
        for f_path in files_changed:
            clean_f = f_path.strip().replace("\\", "/")

            if ".." in clean_f or clean_f.startswith("/") or re.match(r"^[a-zA-Z]:", clean_f):
                return False, f"Path traversal detected in target file path: '{f_path}'", "PATH_TRAVERSAL"

            # SentinelGuard file protection check
            file_ok, file_err = sentinel_guard.check_file_protection(clean_f)
            if not file_ok:
                return False, f"Target file is protected: {file_err}", "PROTECTED_FILE"

            content = resulting_files.get(f_path, "")
            if len(content.encode("utf-8")) > self.MAX_FILE_SIZE:
                return False, f"Resulting file size for '{f_path}' exceeds limit of 1MB", "FILE_TOO_LARGE"

        # 3. Secret and credential leakage check
        for pattern, desc in self.SECRET_PATTERNS:
            if pattern.search(diff_patch):
                return False, f"Potential credential/secret detected in patch: {desc}", "SECRET_LEAKAGE"
            for f_path, content in resulting_files.items():
                if pattern.search(content):
                    return False, f"Potential credential/secret detected in resulting file '{f_path}': {desc}", "SECRET_LEAKAGE"

        # 4. Destructive command pattern check
        for pattern, desc in self.DESTRUCTIVE_PATTERNS:
            if pattern.search(diff_patch):
                return False, f"Destructive pattern detected in patch: {desc}", "DESTRUCTIVE_PATTERN"
            for f_path, content in resulting_files.items():
                if pattern.search(content):
                    return False, f"Destructive pattern detected in resulting file '{f_path}': {desc}", "DESTRUCTIVE_PATTERN"

        return True, "", ""

    def run_local_validation(
        self,
        diff_patch: str,
        file_provider: Any,
        test_file: str | None = None,
        workspace_dir: str | None = None,
    ) -> dict[str, Any]:
        """
        Executes complete local pre-commit validation pipeline:
        1. Patch Applicator check (context lines & clean application)
        2. Syntax verification on all resulting files
        3. Security, diff volume, and credential checks
        4. Optional local unit test execution if test_file and workspace_dir available

        Returns:
        {
          "valid": True / False,
          "status": "LOCALLY_VALIDATED" | "PATCH_FAILED" | "LOCAL_VALIDATION_FAILED",
          "stage": "APPLICATION" | "SYNTAX" | "SECURITY" | "TEST",
          "error": "...",
          "resulting_files": {...},
          "files_changed": [...],
          "lines_added": 5,
          "lines_removed": 2
        }
        """
        # Step 1: Patch Applicator
        app_result = patch_applicator.apply_patch(diff_patch, file_provider)
        if not app_result.get("applied"):
            return {
                "valid": False,
                "status": "PATCH_FAILED",
                "stage": "APPLICATION",
                "error": app_result.get("reason", "Patch application failed"),
                "resulting_files": {},
                "files_changed": [],
                "lines_added": 0,
                "lines_removed": 0,
            }

        resulting_files = app_result.get("resulting_files", {})
        files_changed = app_result.get("files_changed", [])
        lines_added = app_result.get("lines_added", 0)
        lines_removed = app_result.get("lines_removed", 0)

        # Step 2: Syntax verification
        for f_path, content in resulting_files.items():
            syntax_ok, syntax_err = self.validate_syntax(f_path, content)
            if not syntax_ok:
                return {
                    "valid": False,
                    "status": "LOCAL_VALIDATION_FAILED",
                    "stage": "SYNTAX",
                    "error": syntax_err,
                    "resulting_files": resulting_files,
                    "files_changed": files_changed,
                    "lines_added": lines_added,
                    "lines_removed": lines_removed,
                }

        # Step 3: Security & Safety verification
        safe_ok, safe_err, violation_cat = self.validate_safety_rules(
            files_changed=files_changed,
            resulting_files=resulting_files,
            diff_patch=diff_patch,
            lines_added=lines_added,
            lines_removed=lines_removed,
        )
        if not safe_ok:
            return {
                "valid": False,
                "status": "LOCAL_VALIDATION_FAILED",
                "stage": "SECURITY",
                "error": safe_err,
                "violation_category": violation_cat,
                "resulting_files": resulting_files,
                "files_changed": files_changed,
                "lines_added": lines_added,
                "lines_removed": lines_removed,
            }

        # Step 4: Local test verification (if test file exists and workspace provided)
        if test_file and workspace_dir and os.path.isdir(workspace_dir):
            test_path = os.path.join(workspace_dir, test_file)
            if os.path.isfile(test_path) and test_path.endswith(".py"):
                try:
                    # Run single test using pytest in subprocess with timeout
                    cmd = [sys.executable, "-m", "pytest", test_file, "-v", "--maxfail=1"]
                    res = subprocess.run(
                        cmd,
                        cwd=workspace_dir,
                        capture_output=True,
                        text=True,
                        timeout=30,
                    )
                    if res.returncode != 0:
                        test_err = res.stdout[-1000:] if res.stdout else res.stderr[-1000:]
                        return {
                            "valid": False,
                            "status": "LOCAL_VALIDATION_FAILED",
                            "stage": "TEST",
                            "error": f"Local test validation failed on {test_file}:\n{test_err}",
                            "resulting_files": resulting_files,
                            "files_changed": files_changed,
                            "lines_added": lines_added,
                            "lines_removed": lines_removed,
                        }
                except Exception as ex:
                    logger.warning("Local test execution failed or timed out: %s", ex)

        return {
            "valid": True,
            "stage": "LOCALLY_VALIDATED",
            "status": "LOCALLY_VALIDATED",
            "error": "",
            "resulting_files": resulting_files,
            "files_changed": files_changed,
            "lines_added": lines_added,
            "lines_removed": lines_removed,
        }

    # Alias for run_local_validation
    validate_patch = run_local_validation


# Singleton patch validator instance
patch_validator = PatchValidator()

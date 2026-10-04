"""
Failure Extractor Service for SentinelOps.
Converts raw GitHub Actions workflow run data, jobs, steps, and execution logs
into structured, deterministic failure metadata.

Guarantees:
1. Deterministic parsing first: regex, tracebacks, test runners, and package managers.
2. Pinpoints exact exception type, error message, stack trace, target file, and line number.
3. Intelligent log extraction: preserves focused context (lines before/after error anchor)
   without blind truncation like [:1500].
4. Computes deterministic failure signatures for deduplication and cache indexing.
"""

import logging
import os
import re
from typing import Any

logger = logging.getLogger("sentinelops.failure_extractor")


class FailureExtractor:
    """
    Deterministic failure parser and structured failure metadata extractor.
    """

    # Primary error indicator patterns to locate the core failure region in logs
    ERROR_ANCHOR_PATTERNS = [
        re.compile(r"Traceback \(most recent call last\):", re.IGNORECASE),
        re.compile(r"^(?:E\s+|FAIL:\s+|AssertionError:|SyntaxError:|ModuleNotFoundError:|ImportError:|TypeError:|NameError:|AttributeError:|IndentationError:|ValueError:|KeyError:)", re.MULTILINE),
        re.compile(r"FAILED\s+[\w/\\.-]+::\w+", re.MULTILINE),
        re.compile(r"npm\s+ERR!\s+", re.IGNORECASE),
        re.compile(r"ERROR:\s+failed to solve:", re.IGNORECASE),
        re.compile(r"(?:error|fatal):\s+", re.IGNORECASE),
        re.compile(r"(?:Process completed with exit code|exit code:?|exited with code)\s+[1-9]\d*", re.IGNORECASE),
        re.compile(r"\b(?:Exception|Error|FAILED|FAIL)\b", re.IGNORECASE),
        re.compile(r"TS\d+:", re.IGNORECASE),
        re.compile(r"(?:docker|build|test|lint|dependency)\b.*(?:error|fail)", re.IGNORECASE),
    ]

    def __init__(self):
        pass

    def extract_failure(
        self,
        run_id: int | None = None,
        repo: str = "SentinelOps",
        raw_log: str = "",
        workflow_data: dict[str, Any] | None = None,
        jobs_data: dict[str, Any] | list[dict[str, Any]] | None = None,
        workflow_name: str = "CI/CD Workflow",
        branch: str = "main",
        commit_sha: str = "HEAD",
    ) -> dict[str, Any]:
        """Convenience wrapper for extract_structured_failure."""
        return self.extract_structured_failure(
            workflow_run=workflow_data,
            jobs_data=jobs_data,
            raw_logs=raw_log,
            repository=repo,
            workflow_name=workflow_name,
            run_id=run_id,
            branch=branch,
            commit_sha=commit_sha,
        )

    def extract_structured_failure(
        self,
        workflow_run: dict[str, Any] | None = None,
        jobs_data: dict[str, Any] | list[dict[str, Any]] | None = None,
        raw_logs: str = "",
        repository: str = "SentinelOps",
        workflow_name: str = "CI/CD Workflow",
        run_id: int | None = None,
        branch: str = "main",
        commit_sha: str = "HEAD",
    ) -> dict[str, Any]:
        """
        Parses all available GitHub metadata and execution logs into a canonical
        structured failure record.
        """
        # Step 1: Detect deterministic job and step failures
        failed_jobs, failed_steps = self.extract_failed_jobs_and_steps(jobs_data)

        # Basic metadata
        effective_run_id = (
            run_id
            or (workflow_run.get("id") if isinstance(workflow_run, dict) else None)
            or (workflow_run.get("run_id") if isinstance(workflow_run, dict) else None)
            or 0
        )
        effective_wf_name = (
            workflow_name
            or (workflow_run.get("name") if isinstance(workflow_run, dict) else None)
            or "CI/CD Workflow"
        )
        effective_branch = (
            branch
            or (workflow_run.get("head_branch") if isinstance(workflow_run, dict) else None)
            or "main"
        )
        effective_commit = (
            commit_sha
            or (workflow_run.get("head_sha") if isinstance(workflow_run, dict) else None)
            or "HEAD"
        )

        job_id = failed_jobs[0]["id"] if failed_jobs else None
        job_name = failed_jobs[0]["name"] if failed_jobs else None
        step_name = failed_steps[0]["step_name"] if failed_steps else None

        # Step 2: Deterministic log parsing
        parsed_log_details = self.parse_log_details(raw_logs)

        # Step 3: Extract focused logs window without truncating the actual error
        focused_log = self.extract_focused_logs(raw_logs, context_lines=50)

        # Determine target file, line, test_file, error_type, error_message
        error_type = parsed_log_details.get("error_type") or "WorkflowExecutionError"
        error_message = parsed_log_details.get("error_message") or (
            f"Step '{step_name}' failed in job '{job_name}'" if step_name else "Execution failed with non-zero exit code"
        )
        file_path = parsed_log_details.get("file")
        line_num = parsed_log_details.get("line")
        test_file = parsed_log_details.get("test_file")
        failed_test = parsed_log_details.get("failed_test")
        stack_trace = parsed_log_details.get("stack_trace") or ""
        failed_cmd = parsed_log_details.get("failed_command")
        exit_code = parsed_log_details.get("exit_code", 1)

        # Infer command from step or parsed details
        if not failed_cmd:
            if step_name:
                s_lower = step_name.lower()
                if "pytest" in s_lower or "python test" in s_lower:
                    failed_cmd = "pytest"
                elif "npm test" in s_lower or "jest" in s_lower:
                    failed_cmd = "npm test"
                elif "npm run build" in s_lower or "build" in s_lower:
                    failed_cmd = "npm run build"
                elif "docker build" in s_lower:
                    failed_cmd = "docker build"
                elif "lint" in s_lower or "flake8" in s_lower:
                    failed_cmd = "flake8"
                else:
                    failed_cmd = step_name
            else:
                failed_cmd = "pytest"

        # Step 4: Build deterministic failure signature
        if file_path and line_num:
            sig = f"{error_type}|{file_path}:{line_num}"
        elif test_file and failed_test:
            sig = f"{error_type}|{test_file}::{failed_test}"
        elif file_path:
            sig = f"{error_type}|{file_path}"
        elif step_name:
            sig = f"{error_type}|{job_name or 'job'}:{step_name}"
        else:
            clean_err = re.sub(r"\s+", " ", error_message[:60]).strip()
            sig = f"{error_type}|{clean_err}"

        # Determine workflow failure boolean
        conclusion = (workflow_run.get("conclusion") if isinstance(workflow_run, dict) else None) or "failure"
        workflow_failed = bool(
            conclusion in ["failure", "cancelled", "timed_out", "action_required", "startup_failure"]
            or len(failed_jobs) > 0
            or len(failed_steps) > 0
            or bool(parsed_log_details.get("error_type"))
        )

        return {
            "status": (workflow_run.get("status") if isinstance(workflow_run, dict) else None) or "completed",
            "conclusion": conclusion,
            "workflow": effective_wf_name,
            "workflow_name": effective_wf_name,
            "workflow_failed": workflow_failed,
            "run_id": effective_run_id,
            "repository": repository,
            "branch": effective_branch,
            "commit_sha": effective_commit,
            "job_id": job_id,
            "job": job_name or (f"job-{job_id}" if job_id else "CI"),
            "job_name": job_name,
            "step": step_name or "Execution",
            "failed_step": step_name,
            "failed_jobs": failed_jobs,
            "failed_steps": failed_steps,
            "error_type": error_type,
            "error_message": error_message,
            "stack_trace": stack_trace,
            "file": file_path,
            "line": line_num,
            "test_file": test_file,
            "failed_test": failed_test,
            "command": failed_cmd,
            "failed_command": failed_cmd,
            "exit_code": exit_code,
            "missing_module": parsed_log_details.get("missing_module"),
            "failure_signature": sig,
            "focused_log": focused_log,
            "raw_log": raw_logs,
            "logs": focused_log or raw_logs,
        }

    def extract_failed_jobs_and_steps(
        self,
        jobs_data: dict[str, Any] | list[dict[str, Any]] | None,
    ) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
        """
        Deterministically extracts failed jobs and failed steps from GitHub API jobs payload.
        Supports: failure, cancelled, timed_out, action_required, startup_failure.
        """
        failed_jobs: list[dict[str, Any]] = []
        failed_steps: list[dict[str, Any]] = []

        if not jobs_data:
            return failed_jobs, failed_steps

        raw_jobs = []
        if isinstance(jobs_data, dict):
            raw_jobs = jobs_data.get("jobs", [])
        elif isinstance(jobs_data, list):
            raw_jobs = jobs_data

        failing_conclusions = {"failure", "cancelled", "timed_out", "action_required", "startup_failure"}

        for j in raw_jobs:
            if not isinstance(j, dict):
                continue

            j_concl = (j.get("conclusion") or "").lower()
            j_status = (j.get("status") or "").lower()
            j_id = j.get("id")
            j_name = j.get("name", f"job-{j_id}")

            job_failed = (j_concl in failing_conclusions)

            # Check steps
            j_steps = j.get("steps", [])
            j_failed_steps = []
            for s in j_steps:
                if not isinstance(s, dict):
                    continue
                s_concl = (s.get("conclusion") or "").lower()
                s_name = s.get("name", "unnamed step")
                s_num = s.get("number", 0)
                if s_concl in failing_conclusions:
                    step_entry = {
                        "job_id": j_id,
                        "job_name": j_name,
                        "step_number": s_num,
                        "step_name": s_name,
                        "conclusion": s_concl,
                    }
                    failed_steps.append(step_entry)
                    j_failed_steps.append(step_entry)
                    job_failed = True

            if job_failed:
                failed_jobs.append({
                    "id": j_id,
                    "name": j_name,
                    "status": j_status,
                    "conclusion": j_concl or "failure",
                    "failed_steps": j_failed_steps,
                })

        return failed_jobs, failed_steps

    def parse_log_details(self, raw_logs: str) -> dict[str, Any]:
        """
        Parses raw execution logs to extract specific failure information:
        - Python tracebacks, pytest failures, SyntaxError, ModuleNotFoundError, AttributeError, etc.
        - Node/NPM failures, Jest failures, ESLint, TypeScript
        - Docker failures
        - GitHub Actions YAML configuration errors
        - Database migration/connection errors
        - Deployment health check / startup errors
        - Exit codes and commands
        """
        if not raw_logs or not isinstance(raw_logs, str):
            return {}

        details: dict[str, Any] = {}

        # 1. Check for Python Traceback
        tb_match = re.search(r"Traceback \(most recent call last\):([\s\S]+?)(?=\n[A-Z][a-zA-Z0-9_]*(?:Error|Exception):|\Z)", raw_logs)
        if tb_match:
            details["stack_trace"] = tb_match.group(0).strip()
            # Find the last file/line in traceback (usually where error occurred)
            file_matches = list(re.finditer(r'File "([^"]+)", line (\d+)(?:, in (\w+))?', tb_match.group(0)))
            if file_matches:
                chosen = file_matches[-1]
                stdlib_names = {"os.py", "sys.py", "subprocess.py", "threading.py", "socket.py", "http/client.py", "urllib/request.py", "json/decoder.py"}
                for fm in reversed(file_matches):
                    fpath = fm.group(1).replace("\\", "/").strip()
                    fpath_lower = fpath.lower()
                    base = os.path.basename(fpath_lower)
                    is_system = (
                        "site-packages" in fpath_lower
                        or "/lib/" in fpath_lower
                        or "\\lib\\" in fpath_lower
                        or fpath_lower.startswith("<")
                        or base in stdlib_names
                        or "python3" in fpath_lower
                    )
                    if not is_system:
                        chosen = fm
                        break
                details["file"] = chosen.group(1).replace("\\", "/")
                details["line"] = int(chosen.group(2))

        # 2. Check for Python Exception line
        # e.g. "AssertionError: Expected 200 but received 500" or "ModuleNotFoundError: No module named 'jwt'"
        exc_match = re.search(r"\n(?:E\s+)?([A-Za-z0-9_]*(?:Error|Exception)):\s*([^\n]+)", raw_logs)
        if exc_match:
            details["error_type"] = exc_match.group(1)
            details["error_message"] = exc_match.group(2).strip()

        # 3. Check for Pytest test failure lines
        # e.g. "FAILED tests/test_auth.py::test_jwt_expiry - AssertionError: ..."
        pytest_failed_match = re.search(r"FAILED\s+([\w/\\.-]+)::([^\s-]+)(?:\s+-\s+([^\n]+))?", raw_logs)
        if pytest_failed_match:
            details["test_file"] = pytest_failed_match.group(1).replace("\\", "/")
            details["failed_test"] = pytest_failed_match.group(2)
            if not details.get("file"):
                tf = details["test_file"]
                src_cand = None
                if tf.startswith("tests/test_"):
                    src_cand = tf.replace("tests/test_", "")
                elif tf.startswith("tests/"):
                    src_cand = tf.replace("tests/", "").replace("_test.", ".")
                elif tf.startswith("test_"):
                    src_cand = tf.replace("test_", "")
                details["file"] = src_cand or tf
            if pytest_failed_match.group(3) and not details.get("error_message"):
                details["error_message"] = pytest_failed_match.group(3).strip()

        # Check for pytest line failure like "services/auth/token_validator.py:48: AssertionError"
        all_pytest_locs = list(re.finditer(r"\n([\w/\\.-]+\.(?:py|ts|js)):(\d+):\s*([A-Za-z0-9_]*(?:Error|Exception))", raw_logs))
        if all_pytest_locs:
            chosen_loc = all_pytest_locs[-1]
            for pl in all_pytest_locs:
                f_cand = pl.group(1).replace("\\", "/")
                if not f_cand.startswith("tests/") and not f_cand.startswith("test_") and "/test" not in f_cand:
                    chosen_loc = pl
                    break
            details["file"] = chosen_loc.group(1).replace("\\", "/")
            details["line"] = int(chosen_loc.group(2))
            if not details.get("error_type"):
                details["error_type"] = chosen_loc.group(3)
            for pl in all_pytest_locs:
                f_cand = pl.group(1).replace("\\", "/")
                if f_cand.startswith("tests/") or f_cand.startswith("test_") or "/test" in f_cand:
                    details["test_file"] = f_cand
                    break

        # 4. Check for Python SyntaxError details
        syntax_match = re.search(r'File "([^"]+)", line (\d+)\s*\n([^\n]+)\n\s*\^\s*\nSyntaxError:\s*([^\n]+)', raw_logs)
        if syntax_match:
            details["file"] = syntax_match.group(1).replace("\\", "/")
            details["line"] = int(syntax_match.group(2))
            details["error_type"] = "SyntaxError"
            details["error_message"] = syntax_match.group(4).strip()
            details["faulty_code_line"] = syntax_match.group(3).strip()

        # 5. Check for ModuleNotFoundError & ImportError
        mod_match = re.search(r"ModuleNotFoundError:\s*No module named '([^']+)'", raw_logs)
        if mod_match:
            details["error_type"] = "ModuleNotFoundError"
            details["missing_module"] = mod_match.group(1)
            details["error_message"] = f"No module named '{mod_match.group(1)}'"
        else:
            imp_match = re.search(r"ImportError:\s*(?:cannot import name '[^']+' from '([^']+)'|([^\n]+))", raw_logs)
            if imp_match:
                details["error_type"] = "ImportError"
                details["error_message"] = imp_match.group(0).strip()
                if imp_match.group(1):
                    details["missing_module"] = imp_match.group(1)

        # Check for AttributeError / NameError / TypeError
        for exc_name in ["AttributeError", "NameError", "TypeError"]:
            match = re.search(rf"{exc_name}:\s*([^\n]+)", raw_logs)
            if match and not details.get("error_type"):
                details["error_type"] = exc_name
                details["error_message"] = match.group(1).strip()

        # 6. Check for Node / NPM ERESOLVE or peer dependency error
        npm_code_match = re.search(r"npm ERR! code\s+([A-Z0-9_]+)", raw_logs)
        if npm_code_match:
            details["error_type"] = f"npm_{npm_code_match.group(1)}"
            npm_msg_match = re.search(r"npm ERR!\s+(?:code\s+[^\n]+\n)?npm ERR!\s+([^\n]+)", raw_logs)
            if npm_msg_match:
                details["error_message"] = npm_msg_match.group(1).strip()
            if not details.get("file"):
                details["file"] = "package.json"

        # 7. Check for Jest / Mocha test failure
        jest_match = re.search(r"●\s+([^\n]+)\n\s+([^\n]+)", raw_logs)
        if jest_match and not details.get("error_message"):
            details["error_type"] = "TestFailure"
            details["error_message"] = f"{jest_match.group(1).strip()} - {jest_match.group(2).strip()}"

        # 8. Check for Docker build errors
        docker_match = re.search(r"ERROR:\s*(?:failed to solve|failed to build):\s*([^\n]+)", raw_logs)
        if docker_match:
            details["error_type"] = "DOCKER_FAILURE"
            details["error_message"] = docker_match.group(1).strip()
            if not details.get("file"):
                details["file"] = "Dockerfile"
        elif "failed to solve" in raw_logs.lower() or ("docker build" in raw_logs.lower() and "error" in raw_logs.lower()):
            if not details.get("error_type") or details.get("error_type") == "WorkflowExecutionError":
                details["error_type"] = "DOCKER_FAILURE"
                details["file"] = "Dockerfile"

        # 9. Check for TypeScript / ESLint / Node build errors
        ts_match = re.search(r"([\w/\\.-]+\.(?:ts|tsx|js|jsx))\s*\((\d+),(\d+)\):\s*error\s*(TS\d+):\s*([^\n]+)", raw_logs)
        if ts_match:
            details["file"] = ts_match.group(1).replace("\\", "/")
            details["line"] = int(ts_match.group(2))
            details["error_type"] = "TYPE_ERROR"
            details["error_message"] = f"error {ts_match.group(4)}: {ts_match.group(5).strip()}"
        else:
            eslint_match = re.search(r"([\w/\\.-]+\.(?:ts|tsx|js|jsx)):(\d+):(\d+):\s*([^\n]+?)\s+\[Error/[^\]]+\]", raw_logs)
            if eslint_match:
                details["file"] = eslint_match.group(1).replace("\\", "/")
                details["line"] = int(eslint_match.group(2))
                details["error_type"] = "LINT_FAILURE"
                details["error_message"] = eslint_match.group(4).strip()

        # 10. Check for GitHub Actions Workflow YAML configuration errors
        wf_file_match = re.search(r"(?:\.github/workflows/([\w.-]+\.ya?ml))(?:#L(\d+))?", raw_logs)
        if wf_file_match or "invalid workflow file" in raw_logs.lower() or "the workflow is not valid" in raw_logs.lower() or "yaml syntax" in raw_logs.lower():
            details["error_type"] = "CONFIGURATION"
            if wf_file_match:
                details["file"] = f".github/workflows/{wf_file_match.group(1)}"
                if wf_file_match.group(2):
                    details["line"] = int(wf_file_match.group(2))
            else:
                details["file"] = ".github/workflows/ci.yml"
            err_line_match = re.search(r"(?:Invalid workflow file|The workflow is not valid|error in your yaml syntax)[^\n]*", raw_logs, re.IGNORECASE)
            details["error_message"] = err_line_match.group(0).strip() if err_line_match else "Workflow YAML configuration error"

        # 11. Check for Database migration / connection / SQL errors
        db_match = re.search(r"(?:sqlite3\.OperationalError|alembic\.util\.exc\.[A-Za-z0-9_]+|psycopg2\.Error|sqlalchemy\.exc\.[A-Za-z0-9_]+|django\.db\.utils\.[A-Za-z0-9_]+):\s*([^\n]+)", raw_logs)
        if db_match:
            details["error_type"] = "DATABASE"
            details["error_message"] = db_match.group(1).strip()

        # 12. Check for Deployment health check / connection errors
        deploy_match = re.search(r"(?:Health check failed|502 Bad Gateway|Connection refused on port|Application startup failed|Failed to start server):\s*([^\n]*)", raw_logs, re.IGNORECASE)
        if deploy_match:
            if not details.get("error_type") or details.get("error_type") == "WorkflowExecutionError":
                details["error_type"] = "DEPLOYMENT"
                details["error_message"] = deploy_match.group(0).strip()

        # 13. Check for Security policy / secret scanning errors
        sec_match = re.search(r"(?:gitleaks|secret detected|vulnerability found|security check failed|CVE-\d+-\d+|snyk found|trivy):\s*([^\n]*)", raw_logs, re.IGNORECASE)
        if sec_match:
            details["error_type"] = "SECURITY"
            details["error_message"] = sec_match.group(0).strip()

        # 14. Check for API / Network communication errors
        api_match = re.search(r"(?:HTTPError:\s*5\d\d|requests\.exceptions\.[A-Za-z]+|urllib\.error\.HTTPError:\s*HTTP Error\s*[45]\d\d|ConnectionRefusedError):\s*([^\n]*)", raw_logs, re.IGNORECASE)
        if api_match and not details.get("error_type"):
            details["error_type"] = "API"
            details["error_message"] = api_match.group(0).strip()

        # 15. Check for generic exit code failures
        exit_code_match = re.search(r"(?:Process completed with exit code|exit code:?|exited with code)\s+([0-9]+)", raw_logs, re.IGNORECASE)
        if exit_code_match:
            details["exit_code"] = int(exit_code_match.group(1))

        # Check for command that failed
        run_cmd_match = re.search(r"(?:Run\s+|Running\s+`?)([a-zA-Z0-9_./\\ -]+)", raw_logs)
        if run_cmd_match:
            cmd = run_cmd_match.group(1).strip()
            if not cmd.startswith("actions/"):
                details["failed_command"] = cmd

        return details

    def extract_focused_logs(self, raw_logs: str, context_lines: int = 50) -> str:
        """
        Extracts an intelligent focused window around the failure region.
        Never blindly truncates. Spans from the first major error anchor
        through the failure conclusion, preserving all error lines and surrounding context.
        """
        if not raw_logs or not isinstance(raw_logs, str):
            return ""

        lines = raw_logs.splitlines()
        total_lines = len(lines)

        # If log is already small, return all of it
        if total_lines <= (context_lines * 2 + 10):
            return raw_logs

        # Find all anchor line indices
        anchor_indices: list[int] = []
        for idx, line in enumerate(lines):
            for pattern in self.ERROR_ANCHOR_PATTERNS:
                if pattern.search(line):
                    anchor_indices.append(idx)
                    break

        if not anchor_indices:
            # Fallback to the tail of the log
            start_idx = max(0, total_lines - context_lines * 2)
            end_idx = total_lines
        else:
            # Span from earliest anchor (e.g. traceback start) to latest nearby anchor (e.g. exit code)
            first_anchor = anchor_indices[0]
            last_anchor = anchor_indices[-1]

            # If anchor span is reasonable (within 200 lines), cover the whole span
            if last_anchor - first_anchor <= 200:
                start_idx = max(0, first_anchor - context_lines)
                end_idx = min(total_lines, last_anchor + context_lines)
            else:
                # Pick the cluster with the highest density of error patterns
                cluster_start = first_anchor
                for idx in reversed(anchor_indices):
                    # Check if this anchor looks like a fatal / exit code / exception anchor
                    line_text = lines[idx].lower()
                    if any(k in line_text for k in ["error:", "failed", "traceback", "exit code"]):
                        cluster_start = idx
                        break
                start_idx = max(0, cluster_start - context_lines)
                end_idx = min(total_lines, cluster_start + context_lines)

        window_lines = lines[start_idx:end_idx]
        header = f"--- [Focused Failure Region: lines {start_idx + 1} to {end_idx} of {total_lines}] ---\n"
        return header + "\n".join(window_lines)


# Singleton failure extractor instance
failure_extractor = FailureExtractor()

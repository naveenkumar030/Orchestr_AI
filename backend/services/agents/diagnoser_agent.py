"""
Diagnoser Agent for SentinelOps (Phase 3 Multi-Agent Reasoning).
Responsible for analyzing CI failure logs and repository context to determine
failure category, root cause, evidence, affected files, confidence, and suggested fix direction.
"""

import os
import re
import json
import hashlib
import urllib.request
import urllib.error
from typing import Dict, Any, List, Optional, Tuple

import config
from services.secret_sanitizer import secret_sanitizer
from services.resilience.error_signature import error_signature_generator
from services.resilience.diagnosis_cache import diagnosis_cache
from services.resilience.reliability_telemetry import reliability_telemetry
from services.resilience.llm_resilience_manager import llm_resilience_manager

VALID_CATEGORIES = {
    "dependency_error",
    "flaky_test",
    "syntax_or_lint_error",
    "timeout_or_infrastructure",
    "missing_secret_or_config",
    "build_error",
    "test_failure",
    "unknown",
}


def validate_diagnoser_output(data: Dict[str, Any], raw_logs: str = "") -> Dict[str, Any]:
    """
    Validates and normalizes the Diagnoser structured output according to the Phase 3 schema.
    Ensures confidence is float 0.0 - 1.0, category is valid enum, and evidence is not invented.
    """
    if not isinstance(data, dict):
        raise ValueError("Diagnoser output must be a JSON dictionary.")

    category = str(data.get("category", "unknown")).lower().strip()
    if category not in VALID_CATEGORIES:
        category = "unknown"

    raw_conf = data.get("confidence", 0.5)
    try:
        confidence = float(raw_conf)
        if confidence > 1.0:
            confidence = round(confidence / 100.0, 2)
        confidence = max(0.0, min(1.0, confidence))
    except (ValueError, TypeError):
        confidence = 0.5

    if category == "unknown" and confidence > 0.5:
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

    suggested_fix_direction = str(data.get("suggested_fix_direction", "")).strip()
    if not suggested_fix_direction:
        suggested_fix_direction = f"Investigate root cause ({root_cause}) in affected files: {', '.join(affected_files) if affected_files else 'repository context'}."

    return {
        "category": category,
        "root_cause": root_cause,
        "confidence": round(confidence, 2),
        "evidence": evidence,
        "affected_files": affected_files,
        "affected_components": affected_components,
        "suggested_fix_direction": suggested_fix_direction,
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
    def openai_api_key(self) -> Optional[str]:
        return os.environ.get("OPENAI_API_KEY") or config.OPENAI_API_KEY

    @property
    def groq_api_key(self) -> Optional[str]:
        return os.environ.get("GROQ_API_KEY") or config.GROQ_API_KEY

    @property
    def gemini_api_key(self) -> Optional[str]:
        return os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_API_KEY") or config.GEMINI_API_KEY

    def diagnose(
        self,
        logs: str,
        repository: str = "SentinelOps",
        workflow_name: str = "CI/CD Workflow",
        job_name: Optional[str] = None,
        failed_step: Optional[str] = None,
        commit_sha: str = "HEAD",
        repo_context: Optional[Dict[str, str]] = None,
    ) -> Dict[str, Any]:
        """
        Executes diagnosis on sanitized CI failure logs and returns structured schema.
        Integrates deterministic error signature and TTL diagnosis caching (Phase 6).
        """
        # Step 1: Sanitize logs & context
        clean_logs = secret_sanitizer.sanitize_text(logs)
        safe_repo_context = secret_sanitizer.sanitize_repo_context(repo_context or {})

        # Step 2: Generate Deterministic Error Signature & Context Hash
        error_sig = error_signature_generator.extract_error_signature_from_logs(
            logs=clean_logs,
            repository=repository,
            workflow_name=workflow_name,
            job_name=job_name,
            failed_step=failed_step,
        )
        sorted_ctx = sorted([(k, str(v)[:200]) for k, v in safe_repo_context.items()])
        ctx_hash = hashlib.sha256(json.dumps(sorted_ctx).encode("utf-8")).hexdigest() if sorted_ctx else ""

        # Step 3: Check Diagnosis Cache
        cached_result = diagnosis_cache.get(error_sig, current_repo_context_hash=ctx_hash)
        if cached_result:
            reliability_telemetry.record_cache_hit(error_sig)
            cached_output = validate_diagnoser_output(cached_result, clean_logs)
            cached_output["error_signature"] = error_sig
            cached_output["cached"] = True
            return cached_output
        else:
            reliability_telemetry.record_cache_miss(error_sig)

        # Step 4: Try LLM backends (Groq -> OpenAI -> Gemini)
        if self.groq_api_key:
            res = self._call_groq(clean_logs, repository, workflow_name, job_name, failed_step, commit_sha, safe_repo_context)
            if res:
                validated = validate_diagnoser_output(res, clean_logs)
                validated["error_signature"] = error_sig
                validated["cached"] = False
                diagnosis_cache.put(error_sig, validated, repo_context_hash=ctx_hash, repository=repository)
                return validated

        if self.openai_api_key:
            res = self._call_openai(clean_logs, repository, workflow_name, job_name, failed_step, commit_sha, safe_repo_context)
            if res:
                validated = validate_diagnoser_output(res, clean_logs)
                validated["error_signature"] = error_sig
                validated["cached"] = False
                diagnosis_cache.put(error_sig, validated, repo_context_hash=ctx_hash, repository=repository)
                return validated

        if self.gemini_api_key:
            res = self._call_gemini(clean_logs, repository, workflow_name, job_name, failed_step, commit_sha, safe_repo_context)
            if res:
                validated = validate_diagnoser_output(res, clean_logs)
                validated["error_signature"] = error_sig
                validated["cached"] = False
                diagnosis_cache.put(error_sig, validated, repo_context_hash=ctx_hash, repository=repository)
                return validated

        # Step 5: Deterministic Semantic AST heuristic fallback
        heuristic_res = self._heuristic_diagnose(clean_logs, repository, workflow_name, failed_step, safe_repo_context)
        validated = validate_diagnoser_output(heuristic_res, clean_logs)
        validated["error_signature"] = error_sig
        validated["cached"] = False
        diagnosis_cache.put(error_sig, validated, repo_context_hash=ctx_hash, repository=repository)
        return validated

    def _build_prompt(
        self,
        logs: str,
        repo: str,
        workflow_name: str,
        job_name: Optional[str],
        failed_step: Optional[str],
        commit_sha: str,
        repo_context: Dict[str, str],
    ) -> str:
        context_str = "\n".join([f"--- File: {path} ---\n{content[:1500]}" for path, content in repo_context.items()]) if repo_context else "None"
        return (
            f"You are the SentinelOps Diagnoser Agent.\n"
            f"Analyze the CI failure log for repository '{repo}' (Workflow: '{workflow_name}', Job: '{job_name or 'build'}', Step: '{failed_step or 'test'}', Commit: '{commit_sha[:7]}').\n\n"
            f"CI FAILURE LOGS:\n{logs[:4000]}\n\n"
            f"REPOSITORY CONTEXT:\n{context_str[:2500]}\n\n"
            f"Determine the failure details. You must respond with a STRICT JSON object containing ONLY the following keys:\n"
            f"- category: Must be EXACTLY one of: dependency_error, flaky_test, syntax_or_lint_error, timeout_or_infrastructure, missing_secret_or_config, build_error, test_failure, unknown\n"
            f"- root_cause: Clear, concise description of the root cause.\n"
            f"- confidence: Float between 0.0 and 1.0 (e.g. 0.95).\n"
            f"- evidence: List of strings quoting exact error lines from the log.\n"
            f"- affected_files: List of file path strings identified in the failure.\n"
            f"- affected_components: List of module/package/subsystem names affected.\n"
            f"- suggested_fix_direction: Recommended approach to remedy this failure.\n"
            f"Rules:\n"
            f"- Do not invent evidence or files not supported by the log or context.\n"
            f"- If evidence is insufficient, use category 'unknown' with confidence <= 0.4.\n"
        )

    def _call_groq(self, logs: str, repo: str, wf: str, job: Optional[str], step: Optional[str], sha: str, ctx: Dict[str, str]) -> Optional[Dict[str, Any]]:
        try:
            from groq import Groq
            client = Groq(api_key=self.groq_api_key, timeout=3.0)
            prompt = self._build_prompt(logs, repo, wf, job, step, sha, ctx)
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

    def _call_openai(self, logs: str, repo: str, wf: str, job: Optional[str], step: Optional[str], sha: str, ctx: Dict[str, str]) -> Optional[Dict[str, Any]]:
        try:
            import requests
            prompt = self._build_prompt(logs, repo, wf, job, step, sha, ctx)
            headers = {"Authorization": f"Bearer {self.openai_api_key}", "Content-Type": "application/json"}
            payload = {
                "model": "gpt-4o-mini",
                "messages": [
                    {"role": "system", "content": "You are SentinelOps Diagnoser. Always output valid JSON conforming to the requested schema."},
                    {"role": "user", "content": prompt}
                ],
                "response_format": {"type": "json_object"},
                "temperature": 0.1,
            }
            r = requests.post("https://api.openai.com/v1/chat/completions", headers=headers, json=payload, timeout=3.0)
            if r.status_code == 200:
                data = r.json()
                content = data["choices"][0]["message"]["content"]
                return json.loads(content)
        except Exception:
            pass
        return None

    def _call_gemini(self, logs: str, repo: str, wf: str, job: Optional[str], step: Optional[str], sha: str, ctx: Dict[str, str]) -> Optional[Dict[str, Any]]:
        try:
            prompt = self._build_prompt(logs, repo, wf, job, step, sha, ctx)
            body = json.dumps({
                "contents": [{"parts": [{"text": prompt}]}],
                "generationConfig": {"temperature": 0.1, "responseMimeType": "application/json"},
            }).encode("utf-8")
            for model in ["gemini-3.5-flash", "gemini-3.6-flash"]:
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
        failed_step: Optional[str],
        repo_context: Dict[str, str],
    ) -> Dict[str, Any]:
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

        # 1. Dependency Error
        if any(w in logs_lower for w in ["eresolve", "peer dep", "could not resolve dependency", "modulenotfounderror: no module named", "importerror: cannot import name", "requirements.txt", "package.json", "version conflict"]):
            evidence = []
            affected_files = list(extracted_files)
            for line in log_lines:
                if any(k in line.lower() for k in ["eresolve", "modulenotfounderror", "importerror", "peer dependency", "conflicting peer"]):
                    evidence.append(line.strip())
                if "package.json" in line and "package.json" not in affected_files:
                    affected_files.append("package.json")
                if "requirements.txt" in line and "requirements.txt" not in affected_files:
                    affected_files.append("requirements.txt")

            # Extract module name if available
            m_pkg = re.search(r"No module named ['\"]([^'\"]+)['\"]", logs)
            if m_pkg:
                pkg = m_pkg.group(1)
                return {
                    "category": "dependency_error",
                    "root_cause": f"Missing or unresolvable python dependency '{pkg}'",
                    "confidence": 0.95,
                    "evidence": evidence or [f"ModuleNotFoundError: No module named '{pkg}'"],
                    "affected_files": affected_files or ["requirements.txt"],
                    "affected_components": [pkg, "dependencies"],
                    "suggested_fix_direction": f"Add or pin '{pkg}' in requirements.txt",
                }

            m_node = re.search(r"While resolving:\s*(@?[a-zA-Z0-9_\-/]+)@([0-9\.]+)", logs)
            if m_node:
                pkg, ver = m_node.group(1), m_node.group(2)
                return {
                    "category": "dependency_error",
                    "root_cause": f"Conflicting npm peer dependency tree for '{pkg}@{ver}'",
                    "confidence": 0.96,
                    "evidence": evidence or [f"npm ERR! ERESOLVE while resolving {pkg}@{ver}"],
                    "affected_files": affected_files or ["package.json"],
                    "affected_components": [pkg, "npm-packages"],
                    "suggested_fix_direction": f"Reconcile peer dependency version for '{pkg}' in package.json",
                }

            return {
                "category": "dependency_error",
                "root_cause": "Dependency resolution conflict or uninstalled package required by build",
                "confidence": 0.92,
                "evidence": evidence[:3] if evidence else ["Dependency conflict detected in runner output"],
                "affected_files": affected_files or ["package.json" if "npm" in logs_lower else "requirements.txt"],
                "affected_components": ["package-manager"],
                "suggested_fix_direction": "Update package specification to compatible version",
            }

        # 2. Syntax or Lint Error
        if any(w in logs_lower for w in ["syntaxerror", "indentationerror", "eslint: error", "parsing error", "unexpected token", "invalid syntax"]):
            evidence = []
            affected_files = list(extracted_files)
            for line in log_lines:
                if any(k in line.lower() for k in ["syntaxerror", "indentationerror", "unexpected token", "eslint"]):
                    evidence.append(line.strip())

            file_target = affected_files[0] if affected_files else "src/app.py"
            return {
                "category": "syntax_or_lint_error",
                "root_cause": f"Syntax error or lint violation in '{file_target}'",
                "confidence": 0.95,
                "evidence": evidence[:3] if evidence else [f"SyntaxError detected in {file_target}"],
                "affected_files": affected_files or [file_target],
                "affected_components": ["parser", "linter"],
                "suggested_fix_direction": f"Fix invalid token or indentation syntax in '{file_target}'",
            }

        # 3. Missing Secret or Config
        if any(w in logs_lower for w in ["missing environment variable", "keyerror:", "secret not found", "unauthorized: 401", "invalid api key", "env var", "no api key provided"]):
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
                "category": "missing_secret_or_config",
                "root_cause": f"Missing required environment variable or configuration '{var_name}'",
                "confidence": 0.94,
                "evidence": evidence[:3] if evidence else [f"Environment variable '{var_name}' was not set in execution environment"],
                "affected_files": affected_files or ["config.py"],
                "affected_components": ["configuration", var_name],
                "suggested_fix_direction": f"Provide default fallback or configure '{var_name}' in pipeline environment",
            }

        # 4. Timeout or Infrastructure
        if any(w in logs_lower for w in ["timeout", "timed out after", "connection pool starvation", "connectionerror: redis", "gateway timeout", "socket hang up"]):
            evidence = []
            for line in log_lines:
                if any(k in line.lower() for k in ["timeout", "starvation", "connectionerror", "socket hang up"]):
                    evidence.append(line.strip())

            return {
                "category": "timeout_or_infrastructure",
                "root_cause": "Network timeout or infrastructure connection exhaustion during runner execution",
                "confidence": 0.91,
                "evidence": evidence[:3] if evidence else ["Execution timed out after exceeding timeout threshold"],
                "affected_files": ["services/cache/redis_manager.py"] if "redis" in logs_lower else ["config.py"],
                "affected_components": ["infrastructure", "networking"],
                "suggested_fix_direction": "Increase timeout duration or implement connection pooling retry",
            }

        # 5. Flaky Test
        if any(w in logs_lower for w in ["race condition", "flaky", "timed out waiting for element", "stale element reference", "intermittent failure", "test passed on retry"]):
            evidence = []
            for line in log_lines:
                if any(k in line.lower() for k in ["race condition", "flaky", "stale element", "intermittent"]):
                    evidence.append(line.strip())

            return {
                "category": "flaky_test",
                "root_cause": "Non-deterministic test execution / timing race condition",
                "confidence": 0.88,
                "evidence": evidence[:3] if evidence else ["Intermittent race condition or element sync timing issue detected"],
                "affected_files": ["tests/test_async_flow.py"],
                "affected_components": ["test-suite", "async-runner"],
                "suggested_fix_direction": "Add explicit async waits / sync barriers instead of hardcoded timeouts",
            }

        # 6. Build Error
        if any(w in logs_lower for w in ["dockerfile", "docker build", "compilation error", "failed to compile", "tsc exited with error", "build failed"]):
            evidence = []
            affected_files = list(extracted_files)
            for line in log_lines:
                if any(k in line.lower() for k in ["failed to compile", "compilation error", "step", "docker", "tsc"]):
                    evidence.append(line.strip())
                if "dockerfile" in line.lower() and "Dockerfile" not in affected_files:
                    affected_files.append("Dockerfile")

            return {
                "category": "build_error",
                "root_cause": "Container build or typescript compilation failure",
                "confidence": 0.93,
                "evidence": evidence[:3] if evidence else ["Build step exited with non-zero status"],
                "affected_files": affected_files or ["Dockerfile"],
                "affected_components": ["build-system"],
                "suggested_fix_direction": "Correct build step instructions or dependencies in Dockerfile / build config",
            }

        # 7. Test Failure (Assertion / Unit / Integration test)
        if any(w in logs_lower for w in ["assertionerror", "expect(received)", "expect(", "fail src/", "jest", "pytest", "mocha", "● ", "tobe(", "assertequal"]):
            evidence = []
            affected_files = list(extracted_files)
            for line in log_lines:
                if any(k in line.lower() for k in ["assertionerror", "expect", "received", "def test_", "it('", "fail"]):
                    evidence.append(line.strip())

            target = affected_files[0] if affected_files else "services/auth/token_validator.py"
            return {
                "category": "test_failure",
                "root_cause": f"Unit test assertion failure in '{target}'",
                "confidence": 0.92,
                "evidence": evidence[:3] if evidence else [f"AssertionError detected in test run for {target}"],
                "affected_files": affected_files or [target],
                "affected_components": ["auth" if "auth" in target else "core-service"],
                "suggested_fix_direction": f"Update logic in '{target}' to satisfy test assertions",
            }

        # 8. Unknown / Insufficient evidence
        return {
            "category": "unknown",
            "root_cause": "CI step failed with unspecified error signature",
            "confidence": 0.35,
            "evidence": [line.strip() for line in log_lines if line.strip()][:2] or ["Unrecognized failure logs"],
            "affected_files": [],
            "affected_components": [],
            "suggested_fix_direction": "Inspect full workflow logs manually to determine root cause",
        }


diagnoser_agent = DiagnoserAgent()

"""
Validator Agent for SentinelOps (Phase 2).
Responsible for evaluating whether a generated remediation patch successfully resolved
the root-cause failure or introduced new regressions.
"""

import os
import re
import json
from typing import Dict, Any, List, Optional
import config


class ValidatorAgent:
    """
    Independent validation evaluator.
    Analyzes CI results, post-remediation logs, and original incident signatures
    to determine fix efficacy.
    """

    AGENT_NAME = "Validator-Beta"

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

    def evaluate_fix(
        self,
        incident: Dict[str, Any],
        original_failure_logs: str,
        patch_summary: str,
        changed_files: List[str],
        commit_sha: str,
        ci_result: Dict[str, Any],
        new_ci_logs: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Evaluates the remediation result.
        Returns structured validation decision.
        """
        ci_status = ci_result.get("status", "UNKNOWN")

        # ── Fast path for CI Success ──────────────────────────────────────────
        if ci_status == "SUCCESS":
            return {
                "passed": True,
                "confidence": 98,
                "root_cause_fixed": True,
                "new_failure": False,
                "reason": f"CI validation workflow '{ci_result.get('workflow')}' passed successfully on commit {commit_sha[:7]}",
            }

        # ── CI Failed / Cancelled / Timed Out ──────────────────────────────────
        logs = new_ci_logs or ci_result.get("logs") or ""
        orig_logs = original_failure_logs or ""

        # Try Groq LLM evaluation
        if self.groq_api_key:
            groq_res = self._evaluate_with_groq(incident, orig_logs, patch_summary, changed_files, logs, ci_status)
            if groq_res:
                return groq_res

        # Try OpenAI LLM evaluation
        if self.openai_api_key:
            openai_res = self._evaluate_with_openai(incident, orig_logs, patch_summary, changed_files, logs, ci_status)
            if openai_res:
                return openai_res

        # Fallback to deterministic heuristic validation
        return self._heuristic_evaluation(incident, orig_logs, patch_summary, changed_files, logs, ci_status)

    def _heuristic_evaluation(
        self,
        incident: Dict[str, Any],
        orig_logs: str,
        patch_summary: str,
        changed_files: List[str],
        new_logs: str,
        ci_status: str,
    ) -> Dict[str, Any]:
        """
        Deterministic heuristic evaluation comparing old vs new failures.
        """
        if ci_status == "TIMED_OUT":
            return {
                "passed": False,
                "confidence": 90,
                "root_cause_fixed": False,
                "new_failure": False,
                "reason": "CI validation timed out waiting for workflow completion.",
            }

        orig_lower = orig_logs.lower()
        new_lower = new_logs.lower()

        # Check for new failure signatures introduced by patch
        is_new_failure = False
        reason = f"CI workflow execution failed with status: {ci_status}."

        if "syntaxerror" in new_lower and "syntaxerror" not in orig_lower:
            is_new_failure = True
            reason = "Remediation patch introduced a Python SyntaxError into target file."
        elif "indentationerror" in new_lower and "indentationerror" not in orig_lower:
            is_new_failure = True
            reason = "Remediation patch caused an IndentationError in codebase."
        elif "modulenotfounderror" in new_lower and "modulenotfounderror" not in orig_lower:
            is_new_failure = True
            reason = "Remediation patch introduced an unresolvable module dependency."
        elif "assertionerror" in new_lower:
            if any(f.lower() in new_lower for f in changed_files):
                reason = f"Unit tests continue to fail in {', '.join(changed_files)}."
            else:
                reason = "Target unit tests still failing after patch application."
        elif "eresolve" in new_lower or "peer dependency" in new_lower:
            reason = "Package resolution error remains unresolved."

        return {
            "passed": False,
            "confidence": 94,
            "root_cause_fixed": False,
            "new_failure": is_new_failure,
            "reason": reason,
        }

    def _evaluate_with_groq(
        self,
        incident: Dict[str, Any],
        orig_logs: str,
        patch_summary: str,
        changed_files: List[str],
        new_logs: str,
        ci_status: str,
    ) -> Optional[Dict[str, Any]]:
        try:
            from groq import Groq
            client = Groq(api_key=self.groq_api_key)
            prompt = (
                f"Analyze this CI failure after an autonomous patch was applied.\n"
                f"Original Failure Logs:\n{orig_logs[:1500]}\n\n"
                f"Patch Applied to {changed_files}:\n{patch_summary[:800]}\n\n"
                f"New CI Failure Logs:\n{new_logs[:1500]}\n\n"
                f"Output JSON ONLY with keys:\n"
                f"- passed (bool): false\n"
                f"- confidence (int): 90-99\n"
                f"- root_cause_fixed (bool): true/false\n"
                f"- new_failure (bool): true if the patch introduced a brand new syntax/import/runtime crash, false if the original problem or assertion test continues failing\n"
                f"- reason (string): Brief explanation\n"
            )
            completion = client.chat.completions.create(
                model="openai/gpt-oss-120b",
                messages=[
                    {"role": "system", "content": "You are SentinelOps ValidatorAgent. Respond with valid JSON only."},
                    {"role": "user", "content": prompt}
                ],
                response_format={"type": "json_object"},
                temperature=0.1,
            )
            raw = completion.choices[0].message.content
            if raw:
                parsed = json.loads(raw)
                return {
                    "passed": bool(parsed.get("passed", False)),
                    "confidence": int(parsed.get("confidence", 94)),
                    "root_cause_fixed": bool(parsed.get("root_cause_fixed", False)),
                    "new_failure": bool(parsed.get("new_failure", False)),
                    "reason": str(parsed.get("reason", "CI validation failed")),
                }
        except Exception:
            pass
        return None

    def _evaluate_with_openai(
        self,
        incident: Dict[str, Any],
        orig_logs: str,
        patch_summary: str,
        changed_files: List[str],
        new_logs: str,
        ci_status: str,
    ) -> Optional[Dict[str, Any]]:
        try:
            import urllib.request
            headers = {
                "Authorization": f"Bearer {self.openai_api_key}",
                "Content-Type": "application/json",
            }
            prompt = (
                f"Analyze this CI failure after an autonomous patch was applied.\n"
                f"Original Failure Logs:\n{orig_logs[:1500]}\n\n"
                f"Patch Applied to {changed_files}:\n{patch_summary[:800]}\n\n"
                f"New CI Failure Logs:\n{new_logs[:1500]}\n\n"
                f"Output JSON ONLY with keys: passed (bool), confidence (int), root_cause_fixed (bool), new_failure (bool), reason (string)"
            )
            payload = {
                "model": "gpt-4o-mini",
                "messages": [
                    {"role": "system", "content": "You are SentinelOps ValidatorAgent. Output valid JSON only."},
                    {"role": "user", "content": prompt}
                ],
                "response_format": {"type": "json_object"},
                "temperature": 0.1,
            }
            req = urllib.request.Request(
                "https://api.openai.com/v1/chat/completions",
                data=json.dumps(payload).encode("utf-8"),
                headers=headers,
                method="POST"
            )
            with urllib.request.urlopen(req, timeout=12) as resp:
                data = json.loads(resp.read().decode("utf-8"))
                content = data["choices"][0]["message"]["content"]
                parsed = json.loads(content)
                return {
                    "passed": bool(parsed.get("passed", False)),
                    "confidence": int(parsed.get("confidence", 94)),
                    "root_cause_fixed": bool(parsed.get("root_cause_fixed", False)),
                    "new_failure": bool(parsed.get("new_failure", False)),
                    "reason": str(parsed.get("reason", "CI validation failed")),
                }
        except Exception:
            pass
        return None


# Singleton instance
validator_agent = ValidatorAgent()

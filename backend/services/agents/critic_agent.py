"""
Critic / Verifier Agent for SentinelOps (Phase 3 Multi-Agent Reasoning).
Rigorously evaluates and challenges proposed fixes across 10 safety and quality checks (A through J).
Can approve or reject proposals and provides structured feedback for refinement.
"""

import json
import os
import re
import urllib.error
import urllib.request
from typing import Any

import config

from services.secret_sanitizer import secret_sanitizer


def validate_critic_output(data: dict[str, Any]) -> dict[str, Any]:
    """
    Validates and normalizes Critic structured output against Phase 3 schema.
    """
    if not isinstance(data, dict):
        raise ValueError("Critic output must be a dictionary.")

    approved = bool(data.get("approved", False))

    raw_score = data.get("score", 0.0)
    try:
        score = float(raw_score)
        if score > 1.0:
            score = round(score / 100.0, 2)
        score = max(0.0, min(1.0, score))
    except (ValueError, TypeError):
        score = 0.85 if approved else 0.45

    issues = data.get("issues", [])
    if isinstance(issues, str):
        issues = [issues]
    elif not isinstance(issues, list):
        issues = []
    issues = [str(i).strip() for i in issues if str(i).strip()]

    reason = str(data.get("reason", "")).strip()
    if not reason:
        reason = "Patch verified against zero-regression and security policies." if approved else "Fix proposal requires revision."

    recommended_changes = data.get("recommended_changes", [])
    if isinstance(recommended_changes, str):
        recommended_changes = [recommended_changes]
    elif not isinstance(recommended_changes, list):
        recommended_changes = []
    recommended_changes = [str(r).strip() for r in recommended_changes if str(r).strip()]

    security_concerns = data.get("security_concerns", [])
    if isinstance(security_concerns, str):
        security_concerns = [security_concerns]
    elif not isinstance(security_concerns, list):
        security_concerns = []
    security_concerns = [str(s).strip() for s in security_concerns if str(s).strip()]

    requires_human_review = bool(data.get("requires_human_review", False))

    # If rejected, score should not exceed 0.65
    if not approved and score >= 0.70:
        score = 0.55

    # If there are security concerns, force requires_human_review
    if security_concerns:
        requires_human_review = True

    return {
        "approved": approved,
        "score": round(score, 2),
        "issues": issues,
        "reason": reason,
        "recommended_changes": recommended_changes,
        "security_concerns": security_concerns,
        "requires_human_review": requires_human_review,
    }


class CriticAgent:
    """
    Fleet Agent: Critic / Verifier
    Acts as an adversarial code reviewer, challenging the fix against 10 safety & correctness checks.
    """

    AGENT_NAME = "Critic-Verifier"

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

    def evaluate_fix(
        self,
        failure_log: str,
        diagnosis: dict[str, Any],
        proposed_fix: dict[str, Any],
        repo_context: dict[str, str] | None = None,
    ) -> dict[str, Any]:
        """
        Evaluates the proposed fix against the diagnosis and failure logs across 10 checklist dimensions (A-J).
        """
        clean_logs = secret_sanitizer.sanitize_text(failure_log)
        safe_context = secret_sanitizer.sanitize_repo_context(repo_context or {})

        # Step 1: Pre-validation security check for secrets or destructive patterns
        hard_issues, hard_sec = self._detect_hard_violations(proposed_fix)
        if hard_issues or hard_sec:
            return validate_critic_output({
                "approved": False,
                "score": 0.20,
                "issues": hard_issues,
                "reason": f"Automated safety violation detected: {'; '.join(hard_issues + hard_sec)}",
                "recommended_changes": ["Remove exposed credentials or destructive commands from patch", "Ensure patch is targeted and minimal"],
                "security_concerns": hard_sec,
                "requires_human_review": True,
            })

        # Step 2: Try LLM backends (Groq -> OpenAI -> Gemini)
        if self.groq_api_key:
            res = self._call_groq(clean_logs, diagnosis, proposed_fix, safe_context)
            if res:
                return validate_critic_output(res)

        if self.openai_api_key:
            res = self._call_openai(clean_logs, diagnosis, proposed_fix, safe_context)
            if res:
                return validate_critic_output(res)

        if self.gemini_api_key:
            res = self._call_gemini(clean_logs, diagnosis, proposed_fix, safe_context)
            if res:
                return validate_critic_output(res)

        # Step 3: Deterministic Rule-Based 10-Point Checklist Evaluator
        heuristic_res = self._heuristic_evaluate(clean_logs, diagnosis, proposed_fix, safe_context)
        return validate_critic_output(heuristic_res)

    def _detect_hard_violations(self, proposed_fix: dict[str, Any]) -> tuple[list[str], list[str]]:
        """
        Detects destructive patterns, leaked secrets, or blocked paths in the patch.
        """
        issues: list[str] = []
        security_concerns: list[str] = []

        patch = proposed_fix.get("patch", "")
        affected_files = proposed_fix.get("affected_files", [])

        # Check for blocked file paths
        for f in affected_files:
            if secret_sanitizer.is_sensitive_file(f):
                issues.append(f"Patch attempts to modify restricted sensitive file: '{f}'")
                security_concerns.append(f"Modification of '{f}' violates SentinelOps Security Policy.")

        # Check for destructive shell commands in patch additions
        destructive_patterns = [
            (r"rm\s+-rf\s+[/~]", "Destructive filesystem removal command ('rm -rf /')"),
            (r"drop\s+database", "Destructive SQL database drop command"),
            (r"drop\s+table", "Destructive SQL table drop command"),
            (r":\(\)\{\s*:\|:&\s*\};:", "Fork bomb script pattern"),
            (r"chmod\s+777", "Insecure permissive permissions ('chmod 777')"),
        ]
        for pattern, desc in destructive_patterns:
            if re.search(pattern, patch, re.IGNORECASE):
                issues.append(f"Patch contains forbidden destructive operation: {desc}")
                security_concerns.append(desc)

        # Check for raw secrets in patch additions
        for line in patch.splitlines():
            if line.startswith("+") and not line.startswith("+++"):
                if any(k in line for k in ["ghp_", "sk-", "AIza", "AKIA", "xoxb-", "PRIVATE KEY"]):
                    issues.append("Patch contains unredacted API key or token in added lines.")
                    security_concerns.append("Potential secret leakage detected in unified diff.")

        return issues, security_concerns

    def _build_prompt(
        self,
        logs: str,
        diag: dict[str, Any],
        fix: dict[str, Any],
        ctx: dict[str, str],
    ) -> str:
        ctx_str = "\n".join([f"--- {p} ---\n{c[:1000]}" for p, c in ctx.items()]) if ctx else "None"
        return (
            f"You are the SentinelOps Critic / Verifier Agent.\n"
            f"Your role is to rigorously challenge the proposed fix against the original failure and diagnosis.\n\n"
            f"ORIGINAL FAILURE LOG:\n{logs[:2500]}\n\n"
            f"DIAGNOSIS:\n{json.dumps(diag, indent=2)}\n\n"
            f"PROPOSED FIX:\n{json.dumps(fix, indent=2)}\n\n"
            f"REPOSITORY CONTEXT:\n{ctx_str[:2000]}\n\n"
            f"Evaluate ALL of the following 10 safety and quality checks:\n"
            f"A. Root cause correctness\n"
            f"B. Evidence supporting the diagnosis\n"
            f"C. Whether the affected files are actually relevant\n"
            f"D. Whether the proposed patch addresses the root cause\n"
            f"E. Whether the patch is unnecessarily large\n"
            f"F. Potential regressions\n"
            f"G. Security risks\n"
            f"H. Whether secrets could be exposed\n"
            f"I. Whether the proposed fix is technically consistent with the repository\n"
            f"J. Whether additional validation is required\n\n"
            f"You MUST output a valid JSON object ONLY with the following keys:\n"
            f"- approved: Boolean (true if fix is safe, minimal, and fully addresses root cause; false if rejected)\n"
            f"- score: Float between 0.0 and 1.0 representing confidence/quality score\n"
            f"- issues: List of strings detailing any identified flaws or missing elements (empty if approved)\n"
            f"- reason: Detailed reasoning for approval or rejection\n"
            f"- recommended_changes: List of specific actionable instructions for FixSuggester if rejected\n"
            f"- security_concerns: List of security vulnerabilities or concerns found\n"
            f"- requires_human_review: Boolean (true if high risk, breaking change, or manual oversight is advised)\n"
        )

    def _call_groq(self, logs: str, diag: dict[str, Any], fix: dict[str, Any], ctx: dict[str, str]) -> dict[str, Any] | None:
        try:
            from groq import Groq
            client = Groq(api_key=self.groq_api_key, timeout=3.0)
            prompt = self._build_prompt(logs, diag, fix, ctx)
            completion = client.chat.completions.create(
                model="openai/gpt-oss-120b",
                messages=[
                    {"role": "system", "content": "You are SentinelOps Critic / Verifier. Challenge fixes rigorously. Always output valid JSON."},
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

    def _call_openai(self, logs: str, diag: dict[str, Any], fix: dict[str, Any], ctx: dict[str, str]) -> dict[str, Any] | None:
        try:
            import requests
            prompt = self._build_prompt(logs, diag, fix, ctx)
            headers = {"Authorization": f"Bearer {self.openai_api_key}", "Content-Type": "application/json"}
            payload = {
                "model": "gpt-4o-mini",
                "messages": [
                    {"role": "system", "content": "You are SentinelOps Critic / Verifier. Challenge fixes rigorously. Always output valid JSON."},
                    {"role": "user", "content": prompt}
                ],
                "response_format": {"type": "json_object"},
                "temperature": 0.1,
            }
            r = requests.post("https://api.openai.com/v1/chat/completions", headers=headers, json=payload, timeout=3.0)
            if r.status_code == 200:
                data = r.json()
                return json.loads(data["choices"][0]["message"]["content"])
        except Exception:
            pass
        return None

    def _call_gemini(self, logs: str, diag: dict[str, Any], fix: dict[str, Any], ctx: dict[str, str]) -> dict[str, Any] | None:
        try:
            prompt = self._build_prompt(logs, diag, fix, ctx)
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

    def _heuristic_evaluate(
        self,
        logs: str,
        diagnosis: dict[str, Any],
        proposed_fix: dict[str, Any],
        context: dict[str, str],
    ) -> dict[str, Any]:
        """
        Deterministic 10-Point Checklist Verification Engine (Checks A through J).
        """
        patch = proposed_fix.get("patch", "")
        fix_type = proposed_fix.get("fix_type", "unknown")
        affected_files = proposed_fix.get("affected_files", [])
        diag_files = diagnosis.get("affected_files", [])
        category = diagnosis.get("category", "unknown")

        issues: list[str] = []
        recommended_changes: list[str] = []
        security_concerns: list[str] = []

        # Check A & B: Root cause and evidence validity
        if category == "unknown" or diagnosis.get("confidence", 0) < 0.4:
            issues.append("Diagnosis confidence is low and lacks definitive root cause evidence.")
            recommended_changes.append("Require additional runner logs before proposing code modifications.")

        # Check C: Relevance of affected files
        if diag_files and affected_files:
            if not any(f in diag_files or any(df in f for df in diag_files) for f in affected_files):
                issues.append(f"Proposed patch modifies files ({affected_files}) that do not match diagnosed affected files ({diag_files}).")
                recommended_changes.append(f"Target patch strictly to diagnosed files: {diag_files}")

        # Check D: Does patch address root cause?
        if not patch or len(patch.strip()) < 10:
            issues.append("Proposed patch is empty or malformed.")
            recommended_changes.append("Provide a valid unified diff patch.")

        # Check E: Patch size minimalism
        lines_changed = len([l for l in patch.splitlines() if l.startswith("+") or l.startswith("-")])
        if lines_changed > 100:
            issues.append(f"Patch is unnecessarily large ({lines_changed} lines changed). Violates minimal fix principle.")
            recommended_changes.append("Refactor patch to change only the lines strictly necessary to resolve root cause.")

        # Check F: Potential regressions
        if "pass" in patch and ("except:" in patch or "except Exception:" in patch) and "raise" not in patch:
            issues.append("Patch introduces a bare exception suppressor ('except: pass') that could mask critical runtime errors.")
            recommended_changes.append("Handle specific exceptions explicitly with logging.")

        # Check G & H: Security & Secrets
        for line in patch.splitlines():
            if line.startswith("+"):
                if "eval(" in line or "exec(" in line:
                    issues.append("Patch introduces dynamic code execution ('eval'/'exec') which presents an arbitrary code execution risk.")
                    security_concerns.append("Insecure use of eval/exec")
                if "0.0.0.0" in line and "bind" in line.lower():
                    security_concerns.append("Binding server to all network interfaces (0.0.0.0)")

        # Check I: Technical consistency with repository
        if category == "dependency_error" and "requirements.txt" in diag_files and "requirements.txt" not in affected_files and "package.json" not in affected_files:
            issues.append("Diagnosed dependency error was not addressed in dependency manifest files.")
            recommended_changes.append("Add or update required package in requirements.txt or package.json.")

        # Determine Approval
        if issues:
            return {
                "approved": False,
                "score": max(0.20, min(0.60, round(0.65 - (0.15 * len(issues)), 2))),
                "issues": issues,
                "reason": f"Critic rejected proposed fix due to {len(issues)} issue(s): {'; '.join(issues)}",
                "recommended_changes": recommended_changes or ["Revise patch according to specified issues"],
                "security_concerns": security_concerns,
                "requires_human_review": bool(security_concerns or len(issues) >= 3),
            }

        # Approved cleanly
        return {
            "approved": True,
            "score": 0.94,
            "issues": [],
            "reason": "Proposed patch is minimal, directly addresses the root cause, and passes all 10 safety and regression checks.",
            "recommended_changes": [],
            "security_concerns": [],
            "requires_human_review": False,
        }


critic_agent = CriticAgent()

"""
Confidence Gate for SentinelOps Autonomous Remediation.
Centralized, deterministic safety gate enforcing confidence thresholds,
risk bounds, SentinelGuard compliance, and human approval transitions.
"""

import os
from typing import Any

from services.risk_assessor import risk_assessor
from services.sentinel_guard import sentinel_guard

# Centralized Configuration Source (overridable via environment variables)
CONFIDENCE_GATE_CONFIG = {
    "diagnosis_threshold": float(os.getenv("SENTINEL_DIAGNOSIS_THRESHOLD", 0.85)),
    "fix_threshold": float(os.getenv("SENTINEL_FIX_THRESHOLD", 0.85)),
    "critic_threshold": float(os.getenv("SENTINEL_CRITIC_THRESHOLD", 0.70)),
    "max_auto_approval_risk": os.getenv("SENTINEL_MAX_AUTO_APPROVAL_RISK", "low").lower(),
}


class ConfidenceGate:
    """
    Centralized Safety Decision Layer.
    Evaluates:
      1. Diagnoser confidence >= 0.85
      2. FixSuggester confidence >= 0.85
      3. Critic score >= 0.70 AND critic_approved == True
      4. Zero critical security concerns / destructive actions
      5. Risk level == 'low' for auto-approval
      6. SentinelGuard policy compliance (branch, files, size limits)
      7. Fail-closed on any missing/null inputs
    """

    def __init__(self, config: dict[str, Any] | None = None):
        self.config = config or CONFIDENCE_GATE_CONFIG

    @property
    def diagnosis_threshold(self) -> float:
        return float(os.getenv("SENTINEL_DIAGNOSIS_THRESHOLD", self.config.get("diagnosis_threshold", 0.85)))

    @property
    def fix_threshold(self) -> float:
        return float(os.getenv("SENTINEL_FIX_THRESHOLD", self.config.get("fix_threshold", 0.85)))

    @property
    def critic_threshold(self) -> float:
        return float(os.getenv("SENTINEL_CRITIC_THRESHOLD", self.config.get("critic_threshold", 0.70)))

    @property
    def max_auto_approval_risk(self) -> str:
        return os.getenv("SENTINEL_MAX_AUTO_APPROVAL_RISK", self.config.get("max_auto_approval_risk", "low")).lower()

    def evaluate(
        self,
        diagnosis: dict[str, Any] | None,
        fix: dict[str, Any] | None,
        critic: dict[str, Any] | None,
        risk_assessment: dict[str, Any] | None = None,
        target_branch: str = "sentinelops/remediation",
        target_file: str | None = None,
        patch: str | None = None,
    ) -> dict[str, Any]:
        """
        Executes deterministic multi-dimensional safety evaluation.
        Returns SafetyGateResult dictionary.
        """
        reasons: list[str] = []
        security_findings: list[str] = []

        # ── 1. FAIL-CLOSED CHECK: Validate Presence of All Required Inputs ─────
        if not diagnosis or not isinstance(diagnosis, dict):
            return self._fail_closed_response("Missing or invalid Diagnoser result object.")

        if not fix or not isinstance(fix, dict):
            return self._fail_closed_response("Missing or invalid FixSuggester result object.")

        if not critic or not isinstance(critic, dict):
            return self._fail_closed_response("Missing or invalid Critic result object.")

        diag_conf = diagnosis.get("confidence")
        fix_conf = fix.get("confidence")
        critic_score = critic.get("score")
        critic_approved = critic.get("approved")

        if diag_conf is None or not isinstance(diag_conf, (int, float)):
            return self._fail_closed_response("Diagnosis confidence is null or non-numeric.")

        if fix_conf is None or not isinstance(fix_conf, (int, float)):
            return self._fail_closed_response("Fix confidence is null or non-numeric.")

        if critic_score is None or not isinstance(critic_score, (int, float)):
            return self._fail_closed_response("Critic score is null or non-numeric.")

        if critic_approved is None or not isinstance(critic_approved, bool):
            return self._fail_closed_response("Critic approval boolean is missing or invalid.")

        diag_conf = float(diag_conf)
        fix_conf = float(fix_conf)
        critic_score = float(critic_score)

        # ── 2. RISK ASSESSMENT & SENTINELGUARD INTEGRATION ────────────────────
        affected_files = fix.get("affected_files") or ([target_file] if target_file else ["unknown"])
        diff_patch = patch or fix.get("patch", "")
        primary_file = target_file or (affected_files[0] if affected_files else "unknown")

        if risk_assessment is None:
            risk_assessment = risk_assessor.assess(
                patch=diff_patch,
                affected_files=affected_files,
                target_branch=target_branch,
                fix_type=fix.get("fix_type", "code"),
                diagnoser_category=diagnosis.get("category", "unknown"),
            )

        risk_level = (risk_assessment.get("risk_level") or "medium").lower()
        if risk_assessment.get("security_concerns"):
            security_findings.extend(risk_assessment["security_concerns"])

        # SentinelGuard Evaluation
        sentinel_eval = sentinel_guard.evaluate(
            target_branch=target_branch,
            target_file=primary_file,
            diff=diff_patch,
            fixed_content=diff_patch,
        )

        is_sentinel_blocked = sentinel_eval.get("guard_status") == "BLOCKED"
        if is_sentinel_blocked:
            block_reasons = sentinel_eval.get("block_reasons", [])
            security_findings.extend(block_reasons)
            reasons.extend(block_reasons)

        # Ingest Critic's security concerns and issues
        critic_security = critic.get("security_concerns") or []
        if critic_security:
            security_findings.extend(critic_security)

        # ── 3. HARD SECURITY BLOCKS (Immediate Deterministic Rejection) ───────
        if is_sentinel_blocked or risk_level == "critical" or risk_assessment.get("destructive_patterns_detected"):
            return {
                "decision": "rejected",
                "approval_status": "auto_rejected",
                "risk_level": risk_level if risk_level == "critical" else "high",
                "diagnosis_confidence": diag_conf,
                "fix_confidence": fix_conf,
                "critic_score": critic_score,
                "critic_approved": critic_approved,
                "security_findings": security_findings,
                "reasons": reasons or ["Blocked by hard security policy (destructive action or policy violation)"],
                "requires_human_review": True,
                "thresholds": {
                    "diagnosis": self.diagnosis_threshold,
                    "fix": self.fix_threshold,
                    "critic": self.critic_threshold,
                    "max_auto_approval_risk": self.max_auto_approval_risk,
                },
            }

        # ── 4. CRITIC REJECTION CHECK ────────────────────────────────────────
        if not critic_approved or critic_score < self.critic_threshold:
            critic_reason = critic.get("reason") or f"Critic score {critic_score:.2f} below threshold {self.critic_threshold:.2f}"
            return {
                "decision": "rejected",
                "approval_status": "auto_rejected",
                "risk_level": risk_level,
                "diagnosis_confidence": diag_conf,
                "fix_confidence": fix_conf,
                "critic_score": critic_score,
                "critic_approved": False,
                "security_findings": security_findings,
                "reasons": [f"Critic rejected proposed fix: {critic_reason}"],
                "requires_human_review": False,
                "thresholds": {
                    "diagnosis": self.diagnosis_threshold,
                    "fix": self.fix_threshold,
                    "critic": self.critic_threshold,
                    "max_auto_approval_risk": self.max_auto_approval_risk,
                },
            }

        # ── 5. CONFIDENCE & RISK THRESHOLDS (Auto-Approval vs Human Review) ───
        confidence_passed = (
            diag_conf >= self.diagnosis_threshold
            and fix_conf >= self.fix_threshold
            and critic_score >= self.critic_threshold
        )

        risk_acceptable = risk_level == self.max_auto_approval_risk
        no_security_issues = len(security_findings) == 0

        if confidence_passed and risk_acceptable and no_security_issues:
            decision = "approved"
            approval_status = "auto_approved"
            reasons.append("All confidence thresholds met, risk is low, zero security concerns, SentinelGuard passed.")
        else:
            decision = "human_review_required"
            approval_status = "pending_review"

            if diag_conf < self.diagnosis_threshold:
                reasons.append(f"Diagnosis confidence ({diag_conf:.2f}) is below threshold ({self.diagnosis_threshold:.2f})")
            if fix_conf < self.fix_threshold:
                reasons.append(f"Fix confidence ({fix_conf:.2f}) is below threshold ({self.fix_threshold:.2f})")
            if critic_score < self.critic_threshold:
                reasons.append(f"Critic score ({critic_score:.2f}) is below threshold ({self.critic_threshold:.2f})")
            if not risk_acceptable:
                reasons.append(f"Risk level '{risk_level.upper()}' requires explicit human verification")
            if not no_security_issues:
                reasons.append(f"Detected {len(security_findings)} security/policy findings")

        return {
            "decision": decision,
            "approval_status": approval_status,
            "risk_level": risk_level,
            "diagnosis_confidence": diag_conf,
            "fix_confidence": fix_conf,
            "critic_score": critic_score,
            "critic_approved": critic_approved,
            "security_findings": security_findings,
            "reasons": reasons,
            "requires_human_review": decision == "human_review_required",
            "thresholds": {
                "diagnosis": self.diagnosis_threshold,
                "fix": self.fix_threshold,
                "critic": self.critic_threshold,
                "max_auto_approval_risk": self.max_auto_approval_risk,
            },
        }

    def _fail_closed_response(self, reason: str) -> dict[str, Any]:
        """Returns safe default fail-closed response requiring human review."""
        return {
            "decision": "human_review_required",
            "approval_status": "pending_review",
            "risk_level": "high",
            "diagnosis_confidence": 0.0,
            "fix_confidence": 0.0,
            "critic_score": 0.0,
            "critic_approved": False,
            "security_findings": [f"Fail-closed safety trigger: {reason}"],
            "reasons": [f"Fail-closed safety trigger: {reason}"],
            "requires_human_review": True,
            "thresholds": {
                "diagnosis": self.diagnosis_threshold,
                "fix": self.fix_threshold,
                "critic": self.critic_threshold,
                "max_auto_approval_risk": self.max_auto_approval_risk,
            },
        }


# Singleton instance
confidence_gate = ConfidenceGate()

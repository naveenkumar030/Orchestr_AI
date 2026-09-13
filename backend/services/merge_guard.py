"""
MergeGuard: Autonomous Merge Safety Boundary for SentinelOps (Phase 2).
Decides whether an autonomous Pull Request can be merged without human intervention.
Enforces a strict 7-point safety policy.
"""

from typing import Dict, Any, List, Optional
import config


class MergeGuard:
    """
    Security boundary for autonomous auto-merge.
    Ensures AI agents cannot merge code unless all safety checks and CI validation pass.
    """

    def __init__(self):
        self.max_attempts = config.MAX_REMEDIATION_ATTEMPTS

    def can_auto_merge(
        self,
        confidence: int,
        risk_level: str,
        sentinel_status: str,
        ci_status: str,
        attempt_number: int = 1,
        restricted_paths: bool = False,
        secret_scan: str = "PASS",
        confidence_threshold: Optional[int] = None,
    ) -> Dict[str, Any]:
        """
        Evaluates 7 safety conditions to authorize or deny auto-merge:
          1. Confidence score >= threshold (default 90%)
          2. Risk level == 'LOW'
          3. SentinelGuard policy == 'PASS' / 'PASSED'
          4. CI Workflow status == 'SUCCESS'
          5. Attempt number <= MAX_REMEDIATION_ATTEMPTS
          6. Restricted paths == False
          7. Secret scanning == 'PASS' / 'PASSED'
        """
        if confidence_threshold is None:
            try:
                from data_store import store
                confidence_threshold = store.get_settings().get("confidenceThreshold", 90)
            except Exception:
                confidence_threshold = 90

        failed_conditions: List[str] = []

        # Condition 1: Confidence
        if confidence < confidence_threshold:
            failed_conditions.append(
                f"Confidence score {confidence}% is below required threshold of {confidence_threshold}%"
            )

        # Condition 2: Risk Level
        if risk_level.upper() != "LOW":
            failed_conditions.append(
                f"Risk level is {risk_level.upper()} (must be strictly LOW for autonomous merge)"
            )

        # Condition 3: SentinelGuard Status
        if sentinel_status.upper() not in ["PASS", "PASSED"]:
            failed_conditions.append(
                f"SentinelGuard status is {sentinel_status.upper()} (requires PASS)"
            )

        # Condition 4: CI Workflow Status
        if ci_status.upper() != "SUCCESS":
            failed_conditions.append(
                f"CI status is {ci_status.upper()} (requires SUCCESS)"
            )

        # Condition 5: Attempt limit
        if attempt_number > self.max_attempts:
            failed_conditions.append(
                f"Attempt #{attempt_number} exceeds maximum allowed attempts ({self.max_attempts})"
            )

        # Condition 6: Restricted / Blocked paths
        if restricted_paths:
            failed_conditions.append(
                "Proposed changes modify restricted or sensitive file paths"
            )

        # Condition 7: Secret scan
        if secret_scan.upper() not in ["PASS", "PASSED"]:
            failed_conditions.append(
                f"Secret scanner status is {secret_scan.upper()} (requires PASS)"
            )

        if failed_conditions:
            return {
                "allowed": False,
                "decision": "HUMAN_REVIEW",
                "reason": failed_conditions[0],
                "failed_conditions": failed_conditions,
                "policy": "Autonomous Auto-Merge Policy v2.4",
            }

        return {
            "allowed": True,
            "decision": "AUTO_MERGE",
            "reason": "All autonomous merge safety conditions passed",
            "failed_conditions": [],
            "policy": "Autonomous Auto-Merge Policy v2.4",
        }


# Singleton MergeGuard instance
merge_guard = MergeGuard()

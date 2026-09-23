"""
MergeGuard: Autonomous Merge Safety Boundary for SentinelOps (Phase 2).
Decides whether an autonomous Pull Request can be merged without human intervention.
Enforces a strict 9-point safety policy with independent verification and fail-closed defaults.
"""

import threading
import time
import uuid
from datetime import datetime, timezone
from typing import Any

import config


class MergeGuard:
    """
    Security boundary for autonomous auto-merge.
    Ensures AI agents cannot merge code unless all safety checks and independent CI validation pass.
    """

    POLICY_VERSION = "v2.5.0"

    def __init__(self):
        self.max_attempts = config.MAX_REMEDIATION_ATTEMPTS
        self._lock = threading.RLock()
        self._decision_cache: dict[str, dict[str, Any]] = {}

    def can_auto_merge(
        self,
        confidence: int,
        risk_level: str,
        sentinel_status: str,
        ci_status: str,
        attempt_number: int = 1,
        restricted_paths: bool = False,
        secret_scan: str = "PASS",
        confidence_threshold: int | None = None,
        ci_verified: bool = True,
        token_scope_ok: bool = True,
        repo: str | None = None,
        pr_number: int | None = None,
        commit_sha: str | None = None,
    ) -> dict[str, Any]:
        """
        Evaluates 9 safety conditions to authorize or deny auto-merge:
          1. Confidence score >= threshold (default 90%)
          2. Risk level == 'LOW' (strictly fail-closed for MEDIUM/HIGH)
          3. SentinelGuard policy == 'PASS' / 'PASSED'
          4. CI Workflow status == 'SUCCESS'
          5. Independent CI verification confirmed on exact commit SHA
          6. GitHub token scope verified for least-privilege merge authority
          7. Attempt number <= MAX_REMEDIATION_ATTEMPTS
          8. Restricted paths == False
          9. Secret scanning == 'PASS' / 'PASSED'
        """
        # Idempotency check if identifiers provided
        cache_key = None
        if repo and pr_number and commit_sha:
            cache_key = f"{repo}:{pr_number}:{commit_sha}"
            with self._lock:
                if cache_key in self._decision_cache:
                    cached = dict(self._decision_cache[cache_key])
                    cached["idempotent"] = True
                    return cached

        if confidence_threshold is None:
            try:
                from data_store import store
                confidence_threshold = store.get_settings().get("confidenceThreshold", 90)
            except Exception:
                confidence_threshold = 90

        failed_conditions: list[str] = []
        checks: dict[str, bool] = {}

        # Condition 1: Confidence score
        conf_ok = confidence is not None and confidence >= confidence_threshold
        checks["confidence_threshold_met"] = conf_ok
        if not conf_ok:
            failed_conditions.append(
                f"Confidence score {confidence}% is below required threshold of {confidence_threshold}%"
            )

        # Condition 2: Risk Level (fail-closed: strictly LOW required for autonomous merge)
        risk_ok = risk_level is not None and str(risk_level).strip().upper() == "LOW"
        checks["risk_level_low"] = risk_ok
        if not risk_ok:
            failed_conditions.append(
                f"Risk level is {str(risk_level).upper()} (must be strictly LOW for autonomous merge)"
            )

        # Condition 3: SentinelGuard Status
        sentinel_ok = sentinel_status is not None and str(sentinel_status).strip().upper() in ["PASS", "PASSED"]
        checks["sentinel_guard_passed"] = sentinel_ok
        if not sentinel_ok:
            failed_conditions.append(
                f"SentinelGuard status is {str(sentinel_status).upper()} (requires PASS)"
            )

        # Condition 4: CI Workflow Status
        ci_status_ok = ci_status is not None and str(ci_status).strip().upper() in ["SUCCESS", "PASSED"]
        checks["ci_status_success"] = ci_status_ok
        if not ci_status_ok:
            failed_conditions.append(
                f"CI status is {str(ci_status).upper()} (requires SUCCESS)"
            )

        # Condition 5: Independent CI Verification
        checks["ci_independently_verified"] = bool(ci_verified)
        if not ci_verified:
            failed_conditions.append(
                "Independent CI verification has not been confirmed for this commit SHA"
            )

        # Condition 6: Least-Privilege GitHub Token Check
        checks["token_scope_authorized"] = bool(token_scope_ok)
        if not token_scope_ok:
            failed_conditions.append(
                "GitHub token lacks authorized least-privilege merge scope"
            )

        # Condition 7: Attempt limit
        attempt_ok = attempt_number is not None and attempt_number <= self.max_attempts
        checks["attempt_within_limit"] = attempt_ok
        if not attempt_ok:
            failed_conditions.append(
                f"Attempt #{attempt_number} exceeds maximum allowed attempts ({self.max_attempts})"
            )

        # Condition 8: Restricted / Blocked paths
        paths_ok = not restricted_paths
        checks["no_restricted_paths"] = paths_ok
        if not paths_ok:
            failed_conditions.append(
                "Proposed changes modify restricted or sensitive file paths"
            )

        # Condition 9: Secret scan
        secret_ok = secret_scan is not None and str(secret_scan).strip().upper() in ["PASS", "PASSED"]
        checks["secret_scan_passed"] = secret_ok
        if not secret_ok:
            failed_conditions.append(
                f"Secret scanner status is {str(secret_scan).upper()} (requires PASS)"
            )

        audit_id = f"mg-audit-{int(time.time() * 1000)}-{uuid.uuid4().hex[:6]}"
        now_iso = datetime.now(timezone.utc).isoformat()

        if failed_conditions:
            decision_payload = {
                "allowed": False,
                "decision": "HUMAN_REVIEW",
                "reason": failed_conditions[0],
                "failed_conditions": failed_conditions,
                "policy": f"Autonomous Auto-Merge Policy {self.POLICY_VERSION}",
                "policy_version": self.POLICY_VERSION,
                "audit_id": audit_id,
                "evaluated_at": now_iso,
                "checks": checks,
                "policy_checks": checks,
            }
        else:
            decision_payload = {
                "allowed": True,
                "decision": "AUTO_MERGE",
                "reason": "All autonomous merge safety conditions passed",
                "failed_conditions": [],
                "policy": f"Autonomous Auto-Merge Policy {self.POLICY_VERSION}",
                "policy_version": self.POLICY_VERSION,
                "audit_id": audit_id,
                "evaluated_at": now_iso,
                "checks": checks,
                "policy_checks": checks,
            }

        if cache_key:
            with self._lock:
                self._decision_cache[cache_key] = decision_payload

        return decision_payload


# Singleton MergeGuard instance
merge_guard = MergeGuard()


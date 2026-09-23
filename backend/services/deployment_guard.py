"""
DeploymentGuard: Safety Boundary for Post-Deployment Incident Resolution (Phase 3).
Evaluates whether a pipeline incident is genuinely and safely resolved.
Enforces a strict 5-condition policy preventing premature resolution.
Enforces that rollback resolution cannot be inferred from a status string alone,
requiring verifiable rollback execution evidence.
"""

import uuid
from datetime import datetime, timezone
from typing import Any


class DeploymentGuard:
    """
    Safety policy gate that authorizes or blocks final incident resolution.
    Evaluates CI, MergeGuard, Pull Request status, Deployment status, and Live Health.
    Ensures rollback resolution requires verifiable rollback evidence and not merely
    an unverified status string.
    """

    POLICY_VERSION = "v3.1.0"

    def can_declare_resolved(
        self,
        ci_status: str,
        merge_guard_status: Any,
        pr_merged: Any,
        deployment_status: str,
        health_check_status: str,
        rollback_status: str | None = None,
        rollback_record: dict[str, Any] | None = None,
        incident_id: str | None = None,
    ) -> dict[str, Any]:
        """
        Evaluates the 5-point deployment verification policy:
        1. CI_SUCCESS
        2. MERGE_GUARD_APPROVED
        3. PR_MERGED
        4. DEPLOYMENT_SUCCESS
        5. HEALTH_CHECK_HEALTHY

        If the primary deployment path fails, rollback resolution requires verified
        rollback evidence (cannot be inferred from a status string alone).
        """
        now_iso = datetime.now(timezone.utc).isoformat()
        audit_id = f"depg-audit-{uuid.uuid4().hex[:12]}"

        ci_ok = str(ci_status).upper() in ["SUCCESS", "PASSED"]
        mg_ok = (
            merge_guard_status is True
            or str(merge_guard_status).upper() in ["APPROVED", "ALLOW", "AUTO_MERGE", "TRUE", "PASSED"]
        )
        if isinstance(pr_merged, dict):
            pr_ok = pr_merged.get("merged") is True or str(pr_merged.get("state", "")).lower() == "merged"
        else:
            pr_ok = pr_merged is True or str(pr_merged).strip().lower() in ["true", "merged"]
        dep_ok = str(deployment_status).upper() in ["SUCCESS", "DEPLOYED"]
        health_ok = str(health_check_status).upper() in ["HEALTHY", "PASS"]

        policy_checks = {
            "CI_SUCCESS": ci_ok,
            "MERGE_GUARD_APPROVED": mg_ok,
            "PR_MERGED": pr_ok,
            "DEPLOYMENT_SUCCESS": dep_ok,
            "HEALTH_CHECK_HEALTHY": health_ok,
        }

        reasons: list[str] = []
        if not ci_ok:
            reasons.append(f"CI validation is not green (Status: {ci_status})")
        if not mg_ok:
            reasons.append(f"MergeGuard did not authorize autonomous merge (Status: {merge_guard_status})")
        if not pr_ok:
            reasons.append("Pull request has not been merged")
        if not dep_ok:
            reasons.append(f"Deployment did not complete successfully (Status: {deployment_status})")
        if not health_ok:
            reasons.append(f"Health check status is '{health_check_status}'")

        allowed = all(policy_checks.values())

        # If primary checks did not pass, evaluate whether rollback evidence genuinely justifies resolution
        if not allowed:
            # Check if rollback is being claimed
            has_rollback_claim = bool(
                rollback_record
                or (rollback_status and str(rollback_status).upper() in ["SUCCESS", "HEALTHY", "ROLLED_BACK"])
            )

            if has_rollback_claim:
                # Production Safeguard: Rollback success CANNOT be inferred from a status string alone.
                # It requires verifiable evidence (a valid rollback record with target_commit, health_verified, success).
                evidence_record = rollback_record
                if evidence_record is None and incident_id:
                    # Attempt to retrieve verified rollback from data store
                    try:
                        from data_store import store
                        stored_rollbacks = [
                            r for r in store.get_rollbacks()
                            if r.get("incident_id") == incident_id and r.get("status") == "SUCCESS"
                        ]
                        if stored_rollbacks:
                            evidence_record = stored_rollbacks[-1]
                    except Exception:
                        evidence_record = None

                if not evidence_record or not isinstance(evidence_record, dict):
                    reasons.append(
                        "Rollback verification failed: rollback success cannot be inferred from a status string "
                        "alone without verified rollback execution evidence."
                    )
                    return {
                        "allowed": False,
                        "authorized": False,
                        "policy_version": self.POLICY_VERSION,
                        "audit_id": audit_id,
                        "evaluated_at": now_iso,
                        "reasons": reasons,
                        "policy_checks": policy_checks,
                        "checks": {
                            "ci_passed": ci_ok,
                            "merge_guard_passed": mg_ok,
                            "pr_merged": pr_ok,
                            "deployment_passed": dep_ok,
                            "health_passed": health_ok,
                            "rollback_evidence_verified": False,
                        },
                        "resolution_type": "RESOLUTION_BLOCKED_UNVERIFIED_ROLLBACK",
                    }

                # Validate evidence record fields
                rb_success = evidence_record.get("success") is True or str(evidence_record.get("status")).upper() == "SUCCESS"
                rb_health = (
                    evidence_record.get("health_verified") is True
                    or str(evidence_record.get("health_status")).upper() in ["HEALTHY", "PASS"]
                )
                rb_target_commit = evidence_record.get("target_commit")
                has_valid_target = bool(rb_target_commit and str(rb_target_commit).strip() not in ["", "UNKNOWN", "None"])
                rb_attempt = evidence_record.get("attempt_number", 1)
                attempt_ok = isinstance(rb_attempt, int) and rb_attempt <= 3

                rollback_checks = {
                    "rollback_success": rb_success,
                    "rollback_health_verified": rb_health,
                    "valid_target_commit": has_valid_target,
                    "attempt_limit_respected": attempt_ok,
                    "live_health_healthy": health_ok,
                }

                if all(rollback_checks.values()):
                    return {
                        "allowed": True,
                        "authorized": True,
                        "policy_version": self.POLICY_VERSION,
                        "audit_id": audit_id,
                        "evaluated_at": now_iso,
                        "reasons": [],
                        "policy_checks": policy_checks,
                        "rollback_checks": rollback_checks,
                        "checks": {
                            "ci_passed": ci_ok,
                            "merge_guard_passed": mg_ok,
                            "pr_merged": pr_ok,
                            "deployment_passed": dep_ok,
                            "health_passed": health_ok,
                            "rollback_evidence_verified": True,
                        },
                        "resolution_type": "RESOLVED_VIA_ROLLBACK",
                        "evidence": {
                            "target_commit": rb_target_commit,
                            "rollback_id": evidence_record.get("rollback_id"),
                            "attempt_number": rb_attempt,
                        },
                    }
                else:
                    unmet_rb = [k for k, v in rollback_checks.items() if not v]
                    reasons.append(f"Rollback evidence verification failed checks: {', '.join(unmet_rb)}")

        resolution_type = "AUTONOMOUS_DEPLOYMENT_VERIFIED" if allowed else "RESOLUTION_BLOCKED"

        return {
            "allowed": allowed,
            "authorized": allowed,
            "policy_version": self.POLICY_VERSION,
            "audit_id": audit_id,
            "evaluated_at": now_iso,
            "reasons": reasons,
            "policy_checks": policy_checks,
            "checks": {
                "ci_passed": ci_ok,
                "merge_guard_passed": mg_ok,
                "pr_merged": pr_ok,
                "deployment_passed": dep_ok,
                "health_passed": health_ok,
            },
            "resolution_type": resolution_type,
        }

    def evaluate_resolution(
        self,
        ci_status: str,
        merge_guard_allowed: Any,
        pr_status: Any,
        deployment_status: str,
        health_status: str,
        rollback_status: str | None = None,
        rollback_record: dict[str, Any] | None = None,
        incident_id: str | None = None,
    ) -> dict[str, Any]:
        """
        Backwards-compatible wrapper calling can_declare_resolved.
        """
        if isinstance(pr_status, dict):
            pr_merged = pr_status.get("merged") is True or str(pr_status.get("state", "")).lower() == "merged"
        else:
            pr_merged = pr_status is True or str(pr_status).strip().lower() in ["merged", "true"]
        return self.can_declare_resolved(
            ci_status=ci_status,
            merge_guard_status=merge_guard_allowed,
            pr_merged=pr_merged,
            deployment_status=deployment_status,
            health_check_status=health_status,
            rollback_status=rollback_status,
            rollback_record=rollback_record,
            incident_id=incident_id,
        )


# Singleton instance
deployment_guard = DeploymentGuard()

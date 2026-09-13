"""
DeploymentGuard: Safety Boundary for Post-Deployment Incident Resolution (Phase 3).
Evaluates whether a pipeline incident is genuinely and safely resolved.
Enforces a strict 5-condition policy preventing premature resolution.
"""

from typing import Dict, Any, List, Optional, Tuple


class DeploymentGuard:
    """
    Safety policy gate that authorises or blocks final incident resolution.
    Evaluates CI, MergeGuard, Pull Request status, Deployment status, and Live Health.
    """

    POLICY_VERSION = "v3.0.0"

    def can_declare_resolved(
        self,
        ci_status: str,
        merge_guard_status: Any,
        pr_merged: Any,
        deployment_status: str,
        health_check_status: str,
        rollback_status: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Evaluates the 5-point deployment verification policy:
        1. CI_SUCCESS
        2. MERGE_GUARD_APPROVED
        3. PR_MERGED
        4. DEPLOYMENT_SUCCESS
        5. HEALTH_CHECK_HEALTHY
        """
        ci_ok = str(ci_status).upper() in ["SUCCESS", "PASSED"]
        mg_ok = (
            merge_guard_status is True
            or str(merge_guard_status).upper() in ["APPROVED", "ALLOW", "AUTO_MERGE", "TRUE", "PASSED"]
        )
        pr_ok = pr_merged is True or str(pr_merged).lower() in ["true", "merged", "closed"]
        dep_ok = str(deployment_status).upper() in ["SUCCESS", "DEPLOYED"]
        health_ok = str(health_check_status).upper() in ["HEALTHY", "PASS"]

        policy_checks = {
            "CI_SUCCESS": ci_ok,
            "MERGE_GUARD_APPROVED": mg_ok,
            "PR_MERGED": pr_ok,
            "DEPLOYMENT_SUCCESS": dep_ok,
            "HEALTH_CHECK_HEALTHY": health_ok,
        }

        reasons: List[str] = []
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

        if not allowed and rollback_status and str(rollback_status).upper() in ["SUCCESS", "HEALTHY", "ROLLED_BACK"]:
            if health_ok:
                return {
                    "allowed": True,
                    "authorized": True,
                    "policy_version": self.POLICY_VERSION,
                    "reasons": [],
                    "policy_checks": policy_checks,
                    "checks": {
                        "ci_passed": ci_ok,
                        "merge_guard_passed": mg_ok,
                        "pr_merged": pr_ok,
                        "deployment_passed": dep_ok,
                        "health_passed": health_ok,
                    },
                    "resolution_type": "RESOLVED_VIA_ROLLBACK",
                }

        resolution_type = "AUTONOMOUS_DEPLOYMENT_VERIFIED" if allowed else "RESOLUTION_BLOCKED"

        return {
            "allowed": allowed,
            "authorized": allowed,
            "policy_version": self.POLICY_VERSION,
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
        rollback_status: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Backwards-compatible wrapper calling can_declare_resolved.
        """
        pr_merged = pr_status is True or str(pr_status).lower() in ["merged", "closed", "true"]
        return self.can_declare_resolved(
            ci_status=ci_status,
            merge_guard_status=merge_guard_allowed,
            pr_merged=pr_merged,
            deployment_status=deployment_status,
            health_check_status=health_status,
            rollback_status=rollback_status,
        )


# Singleton instance
deployment_guard = DeploymentGuard()

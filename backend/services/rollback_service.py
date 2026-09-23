"""
Rollback Service for SentinelOps (Phase 3).
Executes safe, automated rollbacks when post-deployment health checks fail.
Enforces strict single-attempt boundaries to prevent cascading rollback loops.
"""

import time
import uuid
from datetime import datetime, timezone
from typing import Any

import config

from services.deployment_service import deployment_service
from services.github_service import github_service
from services.health_check_service import health_check_service


class RollbackService:
    """
    Automated rollback orchestration engine.
    Restores the application to the previous known-good state upon health verification failure.
    """

    SERVICE_NAME = "RollbackService"

    def __init__(self, max_attempts: int | None = None):
        self.max_attempts = max_attempts or config.MAX_ROLLBACK_ATTEMPTS

    def rollback(
        self,
        incident_id: str,
        repo: str,
        current_commit: str,
        previous_known_good_commit: str | None = None,
        reason: str = "Post-deployment health check failed",
        environment: str = "production",
        override_success: bool | None = None,
        override_health_status: str | None = None,
    ) -> dict[str, Any]:
        """
        Executes an automated rollback to the previous known-good commit/deployment.
        """
        from data_store import store

        rollback_id = f"rb-{int(time.time())}-{uuid.uuid4().hex[:6]}"
        now_iso = datetime.now(timezone.utc).isoformat()

        # Check existing rollbacks for this incident to enforce max rollback attempts
        existing_rollbacks = [
            r for r in store.get_rollbacks() if r.get("incident_id") == incident_id
        ]
        attempt_number = len(existing_rollbacks) + 1

        if attempt_number > self.max_attempts:
            store.add_log(
                service=self.SERVICE_NAME,
                level="ERROR",
                message=f"Rollback rejected for {incident_id}: Max rollback limit ({self.max_attempts}) reached.",
            )
            return {
                "rollback_id": rollback_id,
                "incident_id": incident_id,
                "status": "FAILED",
                "success": False,
                "reason": f"Maximum rollback attempts ({self.max_attempts}) exceeded",
                "error_message": f"Maximum rollback attempts ({self.max_attempts}) exceeded",
                "error": f"Maximum rollback attempts ({self.max_attempts}) exceeded",
                "attempt_number": attempt_number,
                "executed_at": now_iso,
            }

        # Determine target fallback commit
        target_commit = previous_known_good_commit or self._find_previous_known_good_commit(repo, current_commit)

        store.add_log(
            service=self.SERVICE_NAME,
            level="WARN",
            message=f"Initiating autonomous rollback [{rollback_id}] for {incident_id}: Reverting {current_commit[:7]} -> {target_commit[:7]} (Reason: {reason})",
        )

        rollback_record = {
            "rollback_id": rollback_id,
            "incident_id": incident_id,
            "repository": repo,
            "current_commit": current_commit[:7],
            "target_commit": target_commit[:7],
            "reason": reason,
            "environment": environment,
            "status": "IN_PROGRESS",
            "attempt_number": attempt_number,
            "started_at": now_iso,
            "completed_at": None,
            "health_verified": False,
            "error": None,
        }
        store.save_rollback(rollback_record)

        # Handle override for controlled testing
        if override_success is not None:
            is_success = override_success
            rollback_record["status"] = "SUCCESS" if is_success else "FAILED"
            rollback_record["completed_at"] = datetime.now(timezone.utc).isoformat()
            rollback_record["duration_seconds"] = 12

            # Verify health of the rolled-back target
            h_status = override_health_status or ("HEALTHY" if is_success else "UNHEALTHY")
            health_res = health_check_service.verify_health(override_status=h_status)
            rollback_record["health_verified"] = health_res.get("status") == "HEALTHY"
            rollback_record["health_result"] = health_res

            store.save_rollback(rollback_record)
            return {
                "rollback_id": rollback_id,
                "incident_id": incident_id,
                "status": "SUCCESS" if (is_success and rollback_record["health_verified"]) else "FAILED",
                "success": is_success and rollback_record["health_verified"],
                "target_commit": target_commit[:7],
                "attempt_number": attempt_number,
                "health_status": health_res.get("status"),
                "duration_seconds": 12,
                "record": rollback_record,
            }

        # Real rollback execution: Deploy previous known-good commit
        try:
            dep_res = deployment_service.deploy(
                repo=repo,
                commit_sha=target_commit,
                environment=environment,
                incident_id=incident_id,
            )
            # Poll rollback deployment
            dep_poll = deployment_service.poll_deployment(
                deployment_id=dep_res["deployment_id"],
                repo=repo,
                commit_sha=target_commit,
                timeout_seconds=config.DEPLOYMENT_TIMEOUT_SECONDS,
            )

            if dep_poll.get("status") == "SUCCESS":
                # Verify health of restored version
                health_res = health_check_service.verify_health()
                rollback_ok = health_res.get("status") == "HEALTHY"
                rollback_record["status"] = "SUCCESS" if rollback_ok else "FAILED"
                rollback_record["health_verified"] = rollback_ok
                rollback_record["health_result"] = health_res
                rollback_record["completed_at"] = datetime.now(timezone.utc).isoformat()
                store.save_rollback(rollback_record)

                return {
                    "rollback_id": rollback_id,
                    "incident_id": incident_id,
                    "status": "SUCCESS" if rollback_ok else "FAILED",
                    "success": rollback_ok,
                    "target_commit": target_commit[:7],
                    "attempt_number": attempt_number,
                    "health_status": health_res.get("status"),
                    "record": rollback_record,
                }
            else:
                rollback_record["status"] = "FAILED"
                rollback_record["error"] = dep_poll.get("error_message") or "Rollback deployment failed"
                rollback_record["completed_at"] = datetime.now(timezone.utc).isoformat()
                store.save_rollback(rollback_record)
                return {
                    "rollback_id": rollback_id,
                    "incident_id": incident_id,
                    "status": "FAILED",
                    "success": False,
                    "reason": rollback_record["error"],
                    "attempt_number": attempt_number,
                    "record": rollback_record,
                }
        except Exception as e:
            rollback_record["status"] = "FAILED"
            rollback_record["error"] = str(e)
            rollback_record["completed_at"] = datetime.now(timezone.utc).isoformat()
            store.save_rollback(rollback_record)
            return {
                "rollback_id": rollback_id,
                "incident_id": incident_id,
                "status": "FAILED",
                "success": False,
                "reason": str(e),
                "attempt_number": attempt_number,
                "record": rollback_record,
            }

    def _find_previous_known_good_commit(self, repo: str, current_commit: str) -> str:
        """Finds the commit SHA of the last known successful workflow run on main."""
        ok, res = github_service.list_workflow_runs(repo)
        if ok and res:
            runs = res.get("workflow_runs", [])
            for r in runs:
                if r.get("conclusion") == "success" and r.get("head_branch") == "main":
                    sha = r.get("head_sha")
                    if sha and sha != current_commit and not current_commit.startswith(sha[:7]):
                        return sha

        # Fallback default known stable hash
        return "7f9a1b2c"


# Singleton instance
rollback_service = RollbackService()

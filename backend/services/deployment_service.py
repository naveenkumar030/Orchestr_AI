"""
Deployment Service for SentinelOps (Phase 3).
Provides a provider-agnostic deployment abstraction:
Handles deployment triggering, tracking, polling, and status inspection across
GitHub Actions, Render, Docker, or Kubernetes deployment pipelines.
"""

import time
import uuid
from datetime import datetime, timezone
from typing import Any

import config

from services.github_service import github_service


class DeploymentService:
    """
    Provider-agnostic deployment management and verification service.
    """

    SERVICE_NAME = "DeploymentService"

    def __init__(
        self,
        provider: str | None = None,
        timeout_seconds: int | None = None,
        poll_interval_seconds: int | None = None,
    ):
        self.provider = provider or config.DEPLOYMENT_PROVIDER
        self.timeout_seconds = timeout_seconds or config.DEPLOYMENT_TIMEOUT_SECONDS
        self.poll_interval_seconds = poll_interval_seconds or 5

    def deploy(
        self,
        repo: str,
        commit_sha: str,
        environment: str = "production",
        pr_number: int | None = None,
        incident_id: str | None = None,
        override_status: str | None = None,
        override_url: str | None = None,
    ) -> dict[str, Any]:
        """
        Triggers or registers a deployment for the specified commit and environment.
        """
        from data_store import store

        deployment_id = f"dep-{int(time.time())}-{uuid.uuid4().hex[:6]}"
        now_iso = datetime.now(timezone.utc).isoformat()

        clean_commit = commit_sha[:7] if len(commit_sha) >= 7 else commit_sha
        default_url = f"https://{repo.split('/')[-1].lower()}.pages.dev" if "Pages" in repo else f"https://{repo.split('/')[-1].lower()}.onrender.com"

        deployment_record = {
            "deployment_id": deployment_id,
            "incident_id": incident_id,
            "repository": repo,
            "commit_sha": clean_commit,
            "pr_number": pr_number,
            "environment": environment,
            "provider": self.provider,
            "status": override_status or "IN_PROGRESS",
            "deployment_url": override_url or default_url,
            "started_at": now_iso,
            "completed_at": now_iso if override_status in ["SUCCESS", "FAILURE"] else None,
            "workflow_run_id": None,
            "duration_seconds": 0,
            "error_message": None,
        }

        store.add_log(
            service=self.SERVICE_NAME,
            level="INFO",
            message=f"Deployment initiated [{deployment_id}] for {repo}@{clean_commit} (Env: {environment}, Provider: {self.provider})",
        )

        # Trigger or track GitHub Actions deployment if provider is github_actions
        if self.provider == "github_actions" and not override_status:
            if not github_service.token:
                deployment_record["status"] = "SUCCESS"
                deployment_record["completed_at"] = now_iso
                deployment_record["duration_seconds"] = 8
                deployment_record["simulated"] = True
            else:
                # Check if a deployment workflow run is already triggered on GitHub
                deploy_runs = self._find_github_deployment_runs(repo, clean_commit)
                if deploy_runs:
                    deployment_record["workflow_run_id"] = deploy_runs[0].get("id")
                    deployment_record["status"] = self._map_github_status(
                        deploy_runs[0].get("status"), deploy_runs[0].get("conclusion")
                    )

        store.save_deployment(deployment_record)
        return deployment_record

    def get_deployment_status(self, deployment_id: str, repo: str | None = None) -> dict[str, Any] | None:
        """
        Retrieves the current status of a deployment from the data store and live provider.
        """
        from data_store import store
        record = store.get_deployment(deployment_id)
        if not record:
            return None

        # If already completed or overridden, return current record
        if record.get("status") in ["SUCCESS", "FAILURE", "CANCELLED", "TIMED_OUT"]:
            return record

        # Poll GitHub Actions for live updates if applicable
        if self.provider == "github_actions" and (repo or record.get("repository")):
            target_repo = repo or record.get("repository")
            commit_sha = record.get("commit_sha")
            deploy_runs = self._find_github_deployment_runs(target_repo, commit_sha)
            if deploy_runs:
                run = deploy_runs[0]
                record["workflow_run_id"] = run.get("id")
                new_status = self._map_github_status(run.get("status"), run.get("conclusion"))
                record["status"] = new_status
                if new_status in ["SUCCESS", "FAILURE", "CANCELLED", "TIMED_OUT"]:
                    record["completed_at"] = datetime.now(timezone.utc).isoformat()
                    start_t = datetime.fromisoformat(record["started_at"].replace("Z", "+00:00"))
                    end_t = datetime.fromisoformat(record["completed_at"].replace("Z", "+00:00"))
                    record["duration_seconds"] = int(abs((end_t - start_t).total_seconds()))
                store.save_deployment(record)

        return record

    def poll_deployment(
        self,
        deployment_id: str,
        repo: str,
        commit_sha: str,
        timeout_seconds: int | None = None,
        override_status: str | None = None,
    ) -> dict[str, Any]:
        """
        Polls deployment until it reaches a terminal status or times out.
        """
        from data_store import store
        timeout = timeout_seconds or self.timeout_seconds
        start_time = time.time()

        if override_status:
            rec = store.get_deployment(deployment_id) or {
                "deployment_id": deployment_id,
                "repository": repo,
                "commit_sha": commit_sha,
                "status": override_status,
                "started_at": datetime.now(timezone.utc).isoformat(),
            }
            rec["status"] = override_status
            rec["completed_at"] = datetime.now(timezone.utc).isoformat()
            rec["duration_seconds"] = rec.get("duration_seconds") or 8
            store.save_deployment(rec)
            return rec

        # Simulated mode when GITHUB_TOKEN is not configured
        if not github_service.token:
            rec = store.get_deployment(deployment_id) or {
                "deployment_id": deployment_id,
                "repository": repo,
                "commit_sha": commit_sha,
                "status": "SUCCESS",
                "started_at": datetime.now(timezone.utc).isoformat(),
            }
            rec["status"] = "SUCCESS"
            rec["completed_at"] = datetime.now(timezone.utc).isoformat()
            rec["duration_seconds"] = rec.get("duration_seconds") or 8
            rec["simulated"] = True
            store.save_deployment(rec)
            return rec

        while time.time() - start_time < timeout:
            status_data = self.get_deployment_status(deployment_id, repo=repo)
            if not status_data:
                time.sleep(self.poll_interval_seconds)
                continue

            current_status = status_data.get("status")
            if current_status in ["SUCCESS", "FAILURE", "CANCELLED", "TIMED_OUT"]:
                return status_data

            time.sleep(self.poll_interval_seconds)

        # Timeout reached
        rec = store.get_deployment(deployment_id) or {
            "deployment_id": deployment_id,
            "repository": repo,
            "commit_sha": commit_sha,
            "status": "TIMED_OUT",
            "started_at": datetime.now(timezone.utc).isoformat(),
        }
        rec["status"] = "TIMED_OUT"
        rec["completed_at"] = datetime.now(timezone.utc).isoformat()
        rec["error_message"] = f"Deployment timed out after {timeout} seconds"
        store.save_deployment(rec)
        return rec

    def cancel_deployment(self, deployment_id: str, repo: str | None = None) -> bool:
        """
        Cancels an in-progress deployment.
        """
        from data_store import store
        record = store.get_deployment(deployment_id)
        if not record:
            return False

        record["status"] = "CANCELLED"
        record["completed_at"] = datetime.now(timezone.utc).isoformat()
        store.save_deployment(record)
        return True

    # ── Helpers ───────────────────────────────────────────────────────────────
    def _find_github_deployment_runs(self, repo: str, commit_sha: str) -> list[dict[str, Any]]:
        """Finds deployment workflow runs associated with a commit."""
        ok, res = github_service.list_workflow_runs(repo)
        if not ok or not res:
            return []

        runs = res.get("workflow_runs", [])
        deploy_runs = []
        for r in runs:
            wf_name = (r.get("name") or "").lower()
            head_sha = (r.get("head_sha") or "")
            if "deploy" in wf_name or "release" in wf_name or "pages" in wf_name:
                if not commit_sha or head_sha.startswith(commit_sha) or commit_sha.startswith(head_sha[:7]):
                    deploy_runs.append(r)

        return deploy_runs

    def _map_github_status(self, gh_status: str | None, gh_conclusion: str | None) -> str:
        """Maps GitHub Actions status/conclusion to deployment status."""
        if gh_status in ["queued", "waiting", "requested"]:
            return "QUEUED"
        if gh_status in ["in_progress"]:
            return "IN_PROGRESS"
        if gh_conclusion == "success":
            return "SUCCESS"
        if gh_conclusion in ["failure", "timed_out", "action_required"]:
            return "FAILURE"
        if gh_conclusion in ["cancelled", "skipped"]:
            return "CANCELLED"
        return "IN_PROGRESS" if gh_status else "UNKNOWN"


# Singleton instance
deployment_service = DeploymentService()

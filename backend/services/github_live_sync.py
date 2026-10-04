"""
GitHub Live Sync Service for SentinelOps.
Fetches REAL failed CI/CD workflow runs from GitHub Actions API and
creates live incidents from them. Runs on-demand or on startup.
"""

import logging
import os
import time
from datetime import datetime, timezone
from typing import Any

import config

logger = logging.getLogger("sentinelops.github_live_sync")

# Status mapping from GitHub conclusion to SentinelOps status
CONCLUSION_STATUS_MAP = {
    "failure": "Investigating",
    "timed_out": "Investigating",
    "cancelled": "Investigating",
    "startup_failure": "Investigating",
    "action_required": "Investigating",
    "success": "Resolved",
    "skipped": "Resolved",
    "neutral": "Resolved",
}


class GitHubLiveSyncService:
    """
    Pulls real GitHub Actions failures and syncs them into SentinelOps as
    live incidents with real metadata: commit SHA, branch, failed step,
    workflow name, and links to real GitHub Actions run URLs.
    """

    def __init__(self):
        self._last_sync_time = 0.0
        self._sync_interval = 300  # 5 min cache

    def _get_github_service(self):
        from services.github_service import GitHubService
        token = os.environ.get("GITHUB_TOKEN") or getattr(config, "GITHUB_TOKEN", None)
        return GitHubService(token=token)

    def _get_repo(self) -> str:
        return os.environ.get("GITHUB_REPO") or getattr(config, "GITHUB_REPO", "naveenkumar030/testingrepo")

    def fetch_and_sync(self, force: bool = False, max_runs: int = 15) -> dict[str, Any]:
        """
        Fetches real failed workflow runs from GitHub and persists them as incidents.
        Uses a 5-minute cache to avoid hammering the GitHub API.
        Returns a summary of what was synced.
        """
        now = time.time()
        if not force and (now - self._last_sync_time) < self._sync_interval:
            logger.debug("GitHub live sync skipped — cache is still fresh")
            return {"synced": 0, "cached": True, "message": "Cache still fresh"}

        repo = self._get_repo()
        gh = self._get_github_service()
        logger.info("Starting GitHub live sync for repo: %s", repo)

        # 1. Fetch all recent runs (not just failures — so we can show resolved too)
        ok, runs_data = gh._api_request(
            f"repos/{repo}/actions/runs?per_page={max_runs}"
        )
        if not ok or not isinstance(runs_data, dict):
            logger.warning("Failed to fetch workflow runs from GitHub: %s", runs_data)
            return {"synced": 0, "error": str(runs_data)}

        runs = runs_data.get("workflow_runs", [])
        logger.info("Fetched %d workflow runs from GitHub", len(runs))

        # 2. Also fetch existing PRs to correlate with incidents
        ok_pr, prs_data = gh._api_request(f"repos/{repo}/pulls?state=open&per_page=30")
        pr_branch_map: dict[str, dict] = {}
        if ok_pr and isinstance(prs_data, list):
            for pr in prs_data:
                branch = pr.get("head", {}).get("ref", "")
                if branch:
                    pr_branch_map[branch] = {
                        "prNumber": pr.get("number"),
                        "prUrl": pr.get("html_url", ""),
                        "prTitle": pr.get("title", ""),
                    }

        from services.incident_service import incident_service

        synced = 0
        updated = 0
        errors = 0

        for run in runs:
            try:
                result = self._sync_single_run(run, repo, gh, pr_branch_map, incident_service)
                if result == "created":
                    synced += 1
                elif result == "updated":
                    updated += 1
            except Exception as e:
                logger.error("Error syncing run %s: %s", run.get("id"), e, exc_info=True)
                errors += 1

        self._last_sync_time = time.time()
        logger.info("GitHub live sync complete: %d created, %d updated, %d errors", synced, updated, errors)

        return {
            "synced": synced,
            "updated": updated,
            "errors": errors,
            "total_runs": len(runs),
            "repo": repo,
            "message": f"Synced {synced} new + {updated} updated incidents from GitHub Actions",
        }

    def _sync_single_run(
        self,
        run: dict,
        repo: str,
        gh,
        pr_branch_map: dict,
        incident_service,
    ) -> str:
        """
        Syncs a single GitHub Actions run to an incident.
        Returns 'created', 'updated', or 'skipped'.
        """
        run_id = run["id"]
        inc_id = f"INC-{run_id}"
        conclusion = run.get("conclusion") or "in_progress"
        wf_name = run.get("name", "CI/CD Workflow")
        branch = run.get("head_branch", "main")
        sha = run.get("head_sha", "HEAD")
        short_sha = sha[:7]
        html_url = run.get("html_url", "")
        created_at = run.get("created_at", datetime.now(timezone.utc).isoformat())
        actor = run.get("actor", {}).get("login", "github-actions")

        # Fetch jobs to get failed step detail
        ok_jobs, jobs_data = gh._api_request(f"repos/{repo}/actions/runs/{run_id}/jobs")
        jobs = jobs_data.get("jobs", []) if (ok_jobs and isinstance(jobs_data, dict)) else []

        failed_job_name = None
        failed_step_name = None
        failure_detail = f"Workflow '{wf_name}' {conclusion}"

        for job in jobs:
            if job.get("conclusion") == "failure":
                failed_job_name = job.get("name", "unknown job")
                for step in job.get("steps", []):
                    if step.get("conclusion") == "failure":
                        failed_step_name = step.get("name", "unknown step")
                        failure_detail = f"Step '{failed_step_name}' failed in job '{failed_job_name}'"
                        break
                break

        # Map conclusion to SentinelOps status
        status = CONCLUSION_STATUS_MAP.get(conclusion, "Investigating")

        # Check if a SentinelOps PR was created for this run's branch
        sentinel_branch = f"sentinelops/fix-{run_id}"
        pr_info = pr_branch_map.get(sentinel_branch, {})

        # Check if incident already exists
        existing = incident_service.get_incident_by_id(inc_id)

        if existing:
            # Update status if the run concluded
            if conclusion in ("success", "failure", "timed_out", "cancelled") and \
               existing.get("status") == "Investigating":
                # Don't overwrite if it was already remediated by SentinelOps
                if existing.get("source") not in ("webhook",):
                    pass
            return "updated" if pr_info else "skipped"

        # Build real incident from GitHub data
        confidence = 0
        confidence_color = "secondary"
        root_cause = (
            f"GitHub Actions run #{run_id} failed on branch '{branch}' "
            f"at commit {short_sha} triggered by {actor}"
        )
        if failed_step_name:
            root_cause = (
                f"Step '{failed_step_name}' failed in job '{failed_job_name}'. "
                f"Branch: {branch}, Commit: {short_sha}, Actor: {actor}"
            )

        incident_data = {
            "id": inc_id,
            "repo": repo,
            "pipeline": wf_name,
            "failure": failure_detail,
            "rootCause": root_cause,
            "confidence": confidence,
            "confidenceColor": confidence_color,
            "status": status,
            "time": created_at,
            "runId": run_id,
            "branch": branch,
            "commit": short_sha,
            "actionLabel": "Auto-Heal" if conclusion == "failure" else "Resolved",
            "actionVariant": "warning" if conclusion == "failure" else "success",
            "prNumber": pr_info.get("prNumber"),
            "prUrl": pr_info.get("prUrl"),
            "remediationBranch": sentinel_branch if pr_info else None,
            "guard_status": "PASSED" if pr_info else None,
            "risk_level": None,
            "source": "github_live",
            "html_url": html_url,
            "failed_job": failed_job_name,
            "failed_step": failed_step_name,
            "actor": actor,
            "created_at": created_at,
        }

        incident_service.persist_incident(incident_data)
        logger.info("Created real incident %s from run %s (%s)", inc_id, run_id, conclusion)
        return "created"


github_live_sync = GitHubLiveSyncService()

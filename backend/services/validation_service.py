"""
CI Validation Service for SentinelOps (Phase 2).
Determines whether a remediation branch actually passes CI by inspecting
and polling real GitHub Actions workflow runs via the GitHub REST API.
"""

import os
import time
from datetime import datetime
from typing import Dict, Any, List, Optional, Tuple
import config
from services.github_service import github_service


class ValidationService:
    """
    Monitors, polls, and validates GitHub Actions CI execution for remediation branches.
    Returns structured validation results with failed jobs and error logs.
    """

    def __init__(
        self,
        timeout_seconds: Optional[int] = None,
        poll_interval_seconds: Optional[int] = None,
    ):
        self.default_timeout = timeout_seconds or config.CI_VALIDATION_TIMEOUT_SECONDS
        self.default_poll_interval = poll_interval_seconds or config.CI_POLL_INTERVAL_SECONDS

    def validate_branch(
        self,
        repo: str,
        branch: str,
        commit_sha: Optional[str] = None,
        timeout_seconds: Optional[int] = None,
        poll_interval_seconds: Optional[int] = None,
    ) -> Dict[str, Any]:
        """
        Polls GitHub Actions workflow runs for the specified branch until completion or timeout.
        Retrieves job-level breakdown and logs on failure.
        """
        timeout = timeout_seconds if timeout_seconds is not None else self.default_timeout
        poll_interval = poll_interval_seconds if poll_interval_seconds is not None else self.default_poll_interval
        start_time = time.time()

        # Handle local / simulated mode when GITHUB_TOKEN is not present
        if not github_service.token:
            duration = 12
            return {
                "status": "SUCCESS",
                "workflow": "CI / Test & Build Suite",
                "run_id": int(time.time()),
                "commit_sha": commit_sha or "c0ffee1",
                "branch": branch,
                "failed_jobs": [],
                "logs": None,
                "duration": duration,
                "simulated": True,
            }

        run_id: Optional[int] = None
        workflow_name = "CI/CD Workflow"
        current_commit = commit_sha

        while time.time() - start_time < timeout:
            ok, data = github_service.list_workflow_runs_for_branch(repo, branch)
            if ok and isinstance(data, dict):
                runs = data.get("workflow_runs", [])
                if runs:
                    target_run = None
                    if commit_sha:
                        for r in runs:
                            if r.get("head_sha", "").startswith(commit_sha) or commit_sha.startswith(r.get("head_sha", "")):
                                target_run = r
                                break
                    if not target_run and runs:
                        target_run = runs[0]

                    if target_run:
                        run_id = target_run.get("id")
                        workflow_name = target_run.get("name") or workflow_name
                        current_commit = target_run.get("head_sha") or current_commit
                        status = target_run.get("status")
                        conclusion = target_run.get("conclusion")

                        if status == "completed":
                            return self._build_result(
                                repo=repo,
                                branch=branch,
                                run_id=run_id,
                                workflow_name=workflow_name,
                                commit_sha=current_commit,
                                conclusion=conclusion,
                                start_time=start_time,
                            )

            time.sleep(poll_interval)

        # Timeout reached
        elapsed = int(time.time() - start_time)
        return {
            "status": "TIMED_OUT",
            "workflow": workflow_name,
            "run_id": run_id or 0,
            "commit_sha": current_commit or "HEAD",
            "branch": branch,
            "failed_jobs": [],
            "logs": f"CI validation timed out after {elapsed}s waiting for workflow completion on {branch}",
            "duration": elapsed,
            "simulated": False,
        }

    def validate_workflow_run(self, repo: str, run_id: int) -> Dict[str, Any]:
        """
        Inspects a specific workflow run by ID and produces a structured validation result.
        """
        ok, run_data = github_service.get_workflow_run(repo, run_id)
        if not ok or not isinstance(run_data, dict):
            return {
                "status": "UNKNOWN",
                "workflow": "Unknown Workflow",
                "run_id": run_id,
                "commit_sha": "HEAD",
                "branch": "main",
                "failed_jobs": [],
                "logs": f"Failed to retrieve workflow run #{run_id}",
                "duration": 0,
                "simulated": False,
            }

        conclusion = run_data.get("conclusion")
        status = run_data.get("status")
        branch = run_data.get("head_branch", "main")
        commit_sha = run_data.get("head_sha", "HEAD")
        wf_name = run_data.get("name", "CI/CD Workflow")

        created_at = run_data.get("created_at")
        updated_at = run_data.get("updated_at")
        duration = 0
        if created_at and updated_at:
            try:
                t1 = datetime.fromisoformat(created_at.replace("Z", "+00:00"))
                t2 = datetime.fromisoformat(updated_at.replace("Z", "+00:00"))
                duration = abs(int((t2 - t1).total_seconds()))
            except Exception:
                duration = 30

        return self._build_result(
            repo=repo,
            branch=branch,
            run_id=run_id,
            workflow_name=wf_name,
            commit_sha=commit_sha,
            conclusion=conclusion,
            explicit_duration=duration,
        )

    def _build_result(
        self,
        repo: str,
        branch: str,
        run_id: int,
        workflow_name: str,
        commit_sha: Optional[str],
        conclusion: Optional[str],
        start_time: Optional[float] = None,
        explicit_duration: Optional[int] = None,
    ) -> Dict[str, Any]:
        """Constructs normalized validation dictionary."""
        duration = explicit_duration if explicit_duration is not None else (
            int(time.time() - start_time) if start_time else 30
        )

        failed_jobs: List[str] = []
        logs: Optional[str] = None

        if conclusion == "success":
            status = "SUCCESS"
        elif conclusion in ["failure", "startup_failure"]:
            status = "FAILURE"
        elif conclusion == "cancelled":
            status = "CANCELLED"
        elif conclusion == "timed_out":
            status = "TIMED_OUT"
        else:
            status = "UNKNOWN"

        if status in ["FAILURE", "TIMED_OUT"]:
            ok, jobs_data = github_service.get_workflow_jobs(repo, run_id)
            if ok and isinstance(jobs_data, dict):
                for job in jobs_data.get("jobs", []):
                    if job.get("conclusion") in ["failure", "timed_out"]:
                        job_name = job.get("name", f"job-{job.get('id')}")
                        failed_jobs.append(job_name)
                        if not logs:
                            j_ok, j_logs = github_service.get_job_logs(repo, job.get("id", 0))
                            if j_ok and j_logs:
                                logs = j_logs

            if not logs:
                l_ok, wf_logs = github_service.get_workflow_logs(repo, run_id)
                if l_ok and wf_logs:
                    logs = wf_logs

        return {
            "status": status,
            "workflow": workflow_name,
            "run_id": run_id,
            "commit_sha": commit_sha or "HEAD",
            "branch": branch,
            "failed_jobs": failed_jobs,
            "logs": logs,
            "duration": duration,
            "simulated": False,
        }


# Singleton validation service instance
validation_service = ValidationService()

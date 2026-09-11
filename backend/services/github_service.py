"""
GitHub Integration Service for SentinelOps.
Handles interactions with GitHub REST APIs, webhook payload parsing,
and structured incident event generation for failed workflow runs.
"""

import os
import time
import json
import urllib.request
import urllib.error
from datetime import datetime
from typing import Optional, Dict, Any, Tuple


class GitHubService:
    """
    Isolated service encapsulating all GitHub API communication and event processing.
    Ensures thin Flask routes and structured ingestion.
    """

    def __init__(self, token: Optional[str] = None, base_url: str = "https://api.github.com"):
        self.token = token or os.environ.get("GITHUB_TOKEN")
        self.base_url = base_url.rstrip("/")

    def _get_headers(self) -> Dict[str, str]:
        headers = {
            "Accept": "application/vnd.github+json",
            "User-Agent": "SentinelOps-CI-CD-Agent",
        }
        if self.token:
            headers["Authorization"] = f"Bearer {self.token}"
        return headers

    def _api_request(self, endpoint: str, method: str = "GET", data: Optional[Dict[str, Any]] = None) -> Tuple[bool, Any]:
        url = f"{self.base_url}/{endpoint.lstrip('/')}"
        headers = self._get_headers()
        body = None
        if data is not None:
            body = json.dumps(data).encode("utf-8")
            headers["Content-Type"] = "application/json"

        req = urllib.request.Request(url, data=body, headers=headers, method=method)
        try:
            with urllib.request.urlopen(req, timeout=10) as response:
                resp_data = response.read()
                if resp_data:
                    return True, json.loads(resp_data.decode("utf-8"))
                return True, {}
        except urllib.error.HTTPError as e:
            err_body = e.read().decode("utf-8", errors="ignore")
            return False, {"code": e.code, "reason": e.reason, "body": err_body}
        except Exception as ex:
            return False, {"error": str(ex)}

    # ── Payload Parsing & Webhook Event Handling ──────────────────────────────

    def parse_workflow_run(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        """
        Extracts structured metadata from a GitHub Actions workflow_run webhook event.
        Extracts repository, workflow name, run ID, branch, commit SHA, status, and conclusion.
        """
        run = payload.get("workflow_run", {})
        repo_obj = payload.get("repository", {}) or run.get("repository", {})

        repo_name = (
            repo_obj.get("full_name")
            or repo_obj.get("name")
            or os.environ.get("GITHUB_REPO", "SentinelOps")
        )
        wf_name = run.get("name") or payload.get("workflow", {}).get("name") or "CI/CD Workflow"
        run_id = run.get("id") or payload.get("run_id") or 0
        branch = run.get("head_branch") or payload.get("branch") or "main"
        commit_sha = run.get("head_sha") or payload.get("head_sha") or "HEAD"
        status = run.get("status") or payload.get("status") or "completed"
        conclusion = run.get("conclusion") or payload.get("conclusion")
        action = payload.get("action", "completed")
        actor = (
            payload.get("sender", {}).get("login")
            or run.get("actor", {}).get("login")
            or "github-actions"
        )
        html_url = run.get("html_url") or ""

        return {
            "repository": repo_name,
            "workflow_name": wf_name,
            "run_id": run_id,
            "branch": branch,
            "commit_sha": commit_sha,
            "status": status,
            "conclusion": conclusion,
            "action": action,
            "actor": actor,
            "html_url": html_url,
        }

    def is_failed_workflow(self, run_data: Dict[str, Any]) -> bool:
        """
        Determines whether a workflow run represents a completed failure.
        """
        action = run_data.get("action", "")
        conclusion = run_data.get("conclusion", "")
        # GitHub sets action="completed" when a run finishes, with conclusion="failure", "timed_out", etc.
        return action == "completed" and conclusion in ["failure", "timed_out", "startup_failure"]

    def create_incident_from_workflow_run(self, run_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Produces a structured incident event from a completed failed workflow run.
        """
        run_id = run_data.get("run_id") or int(time.time())
        commit_short = run_data.get("commit_sha", "")[:7] if run_data.get("commit_sha") else "HEAD"
        incident_id = f"INC-{run_id}"

        return {
            "id": incident_id,
            "event_type": "workflow_run_failure",
            "repository": run_data.get("repository", "SentinelOps"),
            "workflow": run_data.get("workflow_name", "CI/CD Workflow"),
            "run_id": run_id,
            "branch": run_data.get("branch", "main"),
            "commit_sha": run_data.get("commit_sha", "HEAD"),
            "status": run_data.get("status", "completed"),
            "conclusion": run_data.get("conclusion", "failure"),
            "detected_at": datetime.now().isoformat(),
            "severity": "high",
            "incident_status": "Investigating",
            "summary": (
                f"Workflow '{run_data.get('workflow_name')}' failed on "
                f"{run_data.get('repository')}@{run_data.get('branch')} "
                f"[{commit_short}] (Run #{run_id})"
            ),
            "html_url": run_data.get("html_url", ""),
            "actor": run_data.get("actor", "github-actions"),
        }

    # ── GitHub REST API Methods (Phase 2 & onward) ────────────────────────────

    def get_repository(self, repo: str) -> Tuple[bool, Dict[str, Any]]:
        """Fetches repository metadata from GitHub API."""
        if not self.token:
            return True, {"name": repo, "simulated": True, "full_name": repo}
        return self._api_request(f"repos/{repo}")

    def get_workflow_run(self, repo: str, run_id: int) -> Tuple[bool, Dict[str, Any]]:
        """Fetches workflow run details by run ID."""
        if not self.token:
            return True, {"id": run_id, "simulated": True, "status": "completed"}
        return self._api_request(f"repos/{repo}/actions/runs/{run_id}")

    def get_workflow_logs(self, repo: str, run_id: int) -> Tuple[bool, str]:
        """Fetches workflow execution logs (simulated when token is not configured)."""
        if not self.token:
            return True, f"[Simulated Logs for Run {run_id}] Step 'Build' failed: Process returned non-zero code 1"
        ok, res = self._api_request(f"repos/{repo}/actions/runs/{run_id}/logs")
        return ok, str(res)

    def get_commit(self, repo: str, sha: str) -> Tuple[bool, Dict[str, Any]]:
        """Fetches commit details by SHA."""
        if not self.token:
            return True, {"sha": sha, "simulated": True, "message": "Simulated commit"}
        return self._api_request(f"repos/{repo}/commits/{sha}")

    def get_pull_request(self, repo: str, pr_number: int) -> Tuple[bool, Dict[str, Any]]:
        """Fetches pull request details by number."""
        if not self.token:
            return True, {"number": pr_number, "simulated": True, "state": "open"}
        return self._api_request(f"repos/{repo}/pulls/{pr_number}")

    def create_branch(self, repo: str, branch_name: str, sha: str) -> Tuple[bool, Dict[str, Any]]:
        """Creates a git reference/branch."""
        if not self.token:
            return True, {"ref": f"refs/heads/{branch_name}", "sha": sha, "simulated": True}
        return self._api_request(
            f"repos/{repo}/git/refs",
            method="POST",
            data={"ref": f"refs/heads/{branch_name}", "sha": sha},
        )

    def create_pull_request(self, repo: str, title: str, head: str, base: str, body: str) -> Tuple[bool, Dict[str, Any]]:
        """Creates a GitHub pull request."""
        if not self.token:
            return True, {
                "number": 199,
                "title": title,
                "html_url": f"https://github.com/{repo}/pull/199",
                "simulated": True,
            }
        return self._api_request(
            f"repos/{repo}/pulls",
            method="POST",
            data={"title": title, "head": head, "base": base, "body": body},
        )

    def create_comment(self, repo: str, pr_or_issue_number: int, body: str) -> Tuple[bool, Dict[str, Any]]:
        """Creates a comment on an issue or pull request."""
        if not self.token:
            return True, {"id": 1, "body": body, "simulated": True}
        return self._api_request(
            f"repos/{repo}/issues/{pr_or_issue_number}/comments",
            method="POST",
            data={"body": body},
        )


# Singleton service instance
github_service = GitHubService()

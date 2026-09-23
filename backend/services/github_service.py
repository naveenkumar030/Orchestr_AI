"""
GitHub Integration Service for SentinelOps.
Handles interactions with GitHub REST APIs, webhook payload parsing,
and structured incident event generation for failed workflow runs.
"""

import json
import os
import time
import urllib.error
import urllib.request
from datetime import datetime
from typing import Any


class GitHubService:
    """
    Isolated service encapsulating all GitHub API communication and event processing.
    Ensures thin Flask routes and structured ingestion.
    """

    def __init__(self, token: str | None = None, base_url: str = "https://api.github.com"):
        self.token = token or os.environ.get("GITHUB_TOKEN")
        self.base_url = base_url.rstrip("/")

    def _get_headers(self) -> dict[str, str]:
        headers = {
            "Accept": "application/vnd.github+json",
            "User-Agent": "SentinelOps-CI-CD-Agent",
        }
        if self.token:
            headers["Authorization"] = f"Bearer {self.token}"
        return headers

    def _api_request(self, endpoint: str, method: str = "GET", data: dict[str, Any] | None = None) -> tuple[bool, Any]:
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

    def parse_workflow_run(self, payload: dict[str, Any]) -> dict[str, Any]:
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

    def is_failed_workflow(self, run_data: dict[str, Any]) -> bool:
        """
        Determines whether a workflow run represents a completed failure.
        """
        action = run_data.get("action", "")
        conclusion = run_data.get("conclusion", "")
        # GitHub sets action="completed" when a run finishes, with conclusion="failure", "timed_out", etc.
        return action == "completed" and conclusion in ["failure", "timed_out", "startup_failure"]

    def create_incident_from_workflow_run(self, run_data: dict[str, Any]) -> dict[str, Any]:
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

    # ── GitHub REST API Methods ───────────────────────────────────────────────

    def get_repository(self, repo: str) -> tuple[bool, dict[str, Any]]:
        """Fetches repository metadata from GitHub API."""
        if not self.token:
            return True, {"name": repo, "simulated": True, "full_name": repo, "default_branch": "main"}
        return self._api_request(f"repos/{repo}")

    def get_workflow_run(self, repo: str, run_id: int) -> tuple[bool, dict[str, Any]]:
        """Fetches workflow run details by run ID."""
        if not self.token:
            return True, {"id": run_id, "simulated": True, "status": "completed", "conclusion": "failure"}
        return self._api_request(f"repos/{repo}/actions/runs/{run_id}")

    def get_workflow_jobs(self, repo: str, run_id: int) -> tuple[bool, dict[str, Any]]:
        """Fetches list of jobs for a workflow run to pinpoint failed steps."""
        if not self.token:
            return True, {
                "total_count": 1,
                "jobs": [
                    {
                        "id": 892401,
                        "run_id": run_id,
                        "name": "test-and-build",
                        "status": "completed",
                        "conclusion": "failure",
                        "started_at": datetime.now().isoformat(),
                        "completed_at": datetime.now().isoformat(),
                        "steps": [
                            {"name": "Set up Python", "status": "completed", "conclusion": "success", "number": 1},
                            {"name": "Install dependencies", "status": "completed", "conclusion": "success", "number": 2},
                            {"name": "Run automated test suite", "status": "completed", "conclusion": "failure", "number": 3},
                        ],
                    }
                ],
            }
        return self._api_request(f"repos/{repo}/actions/runs/{run_id}/jobs")

    def get_job_logs(self, repo: str, job_id: int) -> tuple[bool, str]:
        """Fetches raw logs for a specific job."""
        if not self.token:
            sample_logs = (
                f"=== Job {job_id} Runner Execution Log ===\n"
                "[2026-09-11T10:00:01Z] Step 1: Set up Python 3.13 ... OK (0.8s)\n"
                "[2026-09-11T10:00:03Z] Step 2: Install dependencies ... OK (4.2s)\n"
                "[2026-09-11T10:00:08Z] Step 3: Run automated test suite\n"
                "============================= test session starts ==============================\n"
                "rootdir: /workspace/SentinelOps\n"
                "collected 18 items\n\n"
                "tests/test_auth_service.py ..F....\n"
                "=================================== FAILURES ===================================\n"
                "_________________________ test_jwt_expiry_race_condition _________________________\n"
                "    def test_jwt_expiry_race_condition():\n"
                ">       assert token_validator.verify(expired_token) is False\n"
                "E       AssertionError: assert True is False\n"
                "E       + where True = <bound method TokenValidator.verify of <services.auth.TokenValidator object at 0x7f>>('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...')\n"
                "services/auth/token_validator.py:48: AssertionError\n"
                "=========================== 1 failed, 17 passed in 1.42s ===========================\n"
                "##[error]Process completed with exit code 1.\n"
            )
            return True, sample_logs

        url = f"{self.base_url}/repos/{repo}/actions/jobs/{job_id}/logs"
        headers = self._get_headers()
        req = urllib.request.Request(url, headers=headers, method="GET")
        try:
            with urllib.request.urlopen(req, timeout=15) as response:
                return True, response.read().decode("utf-8", errors="replace")
        except Exception as ex:
            return False, f"Error fetching job logs: {ex!s}"

    def get_workflow_logs(self, repo: str, run_id: int) -> tuple[bool, str]:
        """
        Fetches workflow execution logs.
        Attempts to fetch via workflow jobs or fallback to simulated/mock logs.
        """
        if not self.token:
            return self.get_job_logs(repo, 892401)

        ok, jobs_data = self.get_workflow_jobs(repo, run_id)
        if ok and isinstance(jobs_data, dict) and jobs_data.get("jobs"):
            for job in jobs_data["jobs"]:
                if job.get("conclusion") in ["failure", "timed_out"]:
                    j_ok, j_logs = self.get_job_logs(repo, job["id"])
                    if j_ok:
                        return True, j_logs

        ok, res = self._api_request(f"repos/{repo}/actions/runs/{run_id}/logs")
        if ok:
            return True, str(res)
        return self.get_job_logs(repo, 892401)

    def get_file_content(self, repo: str, path: str, ref: str | None = None) -> tuple[bool, dict[str, Any]]:
        """Fetches a repository file's content and SHA."""
        if not self.token:
            import base64
            mock_content = (
                "# Token Validator Service\n"
                "import time\n\n"
                "class TokenValidator:\n"
                "    def verify(self, token):\n"
                "        # Buggy check allows expired token when grace period is not bounded\n"
                "        return True\n"
            )
            return True, {
                "name": os.path.basename(path),
                "path": path,
                "sha": "7b8c9d0e1f2a3b4c",
                "size": len(mock_content),
                "content": base64.b64encode(mock_content.encode("utf-8")).decode("utf-8"),
                "encoding": "base64",
                "decoded_text": mock_content,
            }

        endpoint = f"repos/{repo}/contents/{path.lstrip('/')}"
        if ref:
            endpoint += f"?ref={ref}"
        ok, res = self._api_request(endpoint)
        if ok and isinstance(res, dict) and "content" in res:
            import base64
            try:
                decoded = base64.b64decode(res["content"]).decode("utf-8", errors="replace")
                res["decoded_text"] = decoded
            except Exception:
                res["decoded_text"] = ""
        return ok, res

    def create_or_update_file(
        self,
        repo: str,
        path: str,
        content: str,
        message: str,
        branch: str,
        sha: str | None = None,
    ) -> tuple[bool, dict[str, Any]]:
        """Creates or updates a file in a branch via GitHub Contents API."""
        import base64
        b64_content = base64.b64encode(content.encode("utf-8")).decode("utf-8")

        if not self.token:
            return True, {
                "content": {"name": os.path.basename(path), "path": path, "sha": "new_file_sha_123"},
                "commit": {"sha": "c0ffee123456", "message": message},
                "simulated": True,
            }

        payload: dict[str, Any] = {
            "message": message,
            "content": b64_content,
            "branch": branch,
        }
        if sha:
            payload["sha"] = sha

        return self._api_request(
            f"repos/{repo}/contents/{path.lstrip('/')}",
            method="PUT",
            data=payload,
        )

    def get_commit(self, repo: str, sha: str) -> tuple[bool, dict[str, Any]]:
        """Fetches commit details by SHA."""
        if not self.token:
            return True, {"sha": sha, "simulated": True, "message": "Simulated commit"}
        return self._api_request(f"repos/{repo}/commits/{sha}")

    def get_pull_request(self, repo: str, pr_number: int) -> tuple[bool, dict[str, Any]]:
        """Fetches pull request details by number."""
        if not self.token:
            return True, {"number": pr_number, "simulated": True, "state": "open"}
        return self._api_request(f"repos/{repo}/pulls/{pr_number}")

    def create_branch(self, repo: str, branch_name: str, sha: str) -> tuple[bool, dict[str, Any]]:
        """Creates a git reference/branch from a base commit SHA."""
        if not self.token:
            return True, {
                "ref": f"refs/heads/{branch_name}",
                "node_id": "REF_kwDO",
                "url": f"https://api.github.com/repos/{repo}/git/refs/heads/{branch_name}",
                "object": {"sha": sha, "type": "commit"},
                "simulated": True,
            }
        return self._api_request(
            f"repos/{repo}/git/refs",
            method="POST",
            data={"ref": f"refs/heads/{branch_name}", "sha": sha},
        )

    def create_pull_request(
        self, repo: str, title: str, head: str, base: str, body: str, draft: bool = False
    ) -> tuple[bool, dict[str, Any]]:
        """Creates a GitHub pull request."""
        if not self.token:
            pr_num = int(time.time()) % 1000 + 100
            return True, {
                "id": pr_num,
                "number": pr_num,
                "title": title,
                "state": "open",
                "draft": draft,
                "html_url": f"https://github.com/{repo}/pull/{pr_num}",
                "head": {"ref": head},
                "base": {"ref": base},
                "body": body,
                "simulated": True,
            }
        
        payload = {"title": title, "head": head, "base": base, "body": body, "draft": draft}
        return self._api_request(
            f"repos/{repo}/pulls",
            method="POST",
            data=payload,
        )

    def create_comment(self, repo: str, pr_or_issue_number: int, body: str) -> tuple[bool, dict[str, Any]]:
        """Creates a comment on an issue or pull request."""
        if not self.token:
            return True, {"id": 1, "body": body, "simulated": True}
        return self._api_request(
            f"repos/{repo}/issues/{pr_or_issue_number}/comments",
            method="POST",
            data={"body": body},
        )

    def list_workflow_runs(self, repo: str, per_page: int = 20) -> tuple[bool, dict[str, Any]]:
        """Fetches list of workflow runs for a repository."""
        return self._api_request(f"repos/{repo}/actions/runs?per_page={per_page}")

    def list_pull_requests(self, repo: str, state: str = "all") -> tuple[bool, Any]:
        """Fetches list of pull requests for a repository."""
        return self._api_request(f"repos/{repo}/pulls?state={state}")

    def list_workflows(self, repo: str) -> tuple[bool, dict[str, Any]]:
        """Fetches list of workflows configured in repository."""
        return self._api_request(f"repos/{repo}/actions/workflows")

    def list_workflow_runs_for_branch(
        self, repo: str, branch: str, event: str | None = None
    ) -> tuple[bool, dict[str, Any]]:
        """Fetches workflow runs filtered by branch and optional event."""
        endpoint = f"repos/{repo}/actions/runs?branch={branch}"
        if event:
            endpoint += f"&event={event}"
        return self._api_request(endpoint)

    def merge_pull_request(
        self,
        repo: str,
        pull_number: int,
        commit_title: str | None = None,
        commit_message: str | None = None,
        merge_method: str = "squash",
    ) -> tuple[bool, dict[str, Any]]:
        """
        Merges a pull request using GitHub REST API.
        Enforces real GitHub responses (handles branch protection, approval requirements, merge conflicts).
        """
        if not self.token:
            return True, {
                "sha": "c0ffee1234567890abcdef",
                "merged": True,
                "message": f"Simulated {merge_method} merge for PR #{pull_number}",
                "simulated": True,
            }

        payload: dict[str, Any] = {"merge_method": merge_method}
        if commit_title:
            payload["commit_title"] = commit_title
        if commit_message:
            payload["commit_message"] = commit_message

        return self._api_request(
            f"repos/{repo}/pulls/{pull_number}/merge",
            method="PUT",
            data=payload,
        )


# Singleton service instance
github_service = GitHubService()



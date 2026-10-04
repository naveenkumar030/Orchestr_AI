"""
SentinelOps Real Data Sync
Fetches REAL failed workflow runs from GitHub Actions and creates
actual incidents from them — replacing all demo/fake data.
"""
import json
import os
import sys
import time
import urllib.request
import urllib.error
from datetime import datetime, timezone

# Load env
def load_env():
    env_file = os.path.join(os.path.dirname(__file__), ".env")
    env = {}
    try:
        with open(env_file) as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith("#") and "=" in line:
                    k, v = line.split("=", 1)
                    env[k.strip()] = v.strip()
    except Exception as e:
        print(f"Warning: Could not load .env: {e}")
    return env

ENV = load_env()
GITHUB_TOKEN = ENV.get("GITHUB_TOKEN", "")
GITHUB_REPO = ENV.get("GITHUB_REPO", "naveenkumar030/testingrepo")

HEADERS = {
    "Accept": "application/vnd.github+json",
    "User-Agent": "SentinelOps-CI-CD-Agent",
    "Authorization": f"Bearer {GITHUB_TOKEN}",
}

def github_get(url):
    req = urllib.request.Request(url, headers=HEADERS)
    try:
        with urllib.request.urlopen(req, timeout=20) as resp:
            return json.loads(resp.read().decode())
    except urllib.error.HTTPError as e:
        body = e.read().decode()
        print(f"  HTTP {e.code}: {body[:200]}")
        return None
    except Exception as ex:
        print(f"  Error: {ex}")
        return None


def fetch_real_failed_runs(repo, max_runs=20):
    """Fetch real failed workflow runs from GitHub API."""
    print(f"\n[1] Fetching real failed runs from {repo}...")
    url = f"https://api.github.com/repos/{repo}/actions/runs?per_page={max_runs}&status=failure"
    data = github_get(url)
    if not data:
        return []
    runs = data.get("workflow_runs", [])
    print(f"    Found {len(runs)} failed runs")
    return runs


def fetch_run_jobs(repo, run_id):
    """Fetch jobs for a workflow run to get failed step details."""
    url = f"https://api.github.com/repos/{repo}/actions/runs/{run_id}/jobs"
    data = github_get(url)
    if not data:
        return []
    return data.get("jobs", [])


def fetch_job_logs(repo, job_id):
    """Fetch logs for a specific job."""
    url = f"https://api.github.com/repos/{repo}/actions/jobs/{job_id}/logs"
    try:
        req = urllib.request.Request(url, headers=HEADERS)
        with urllib.request.urlopen(req, timeout=20) as resp:
            return resp.read().decode("utf-8", errors="replace")[:3000]
    except Exception as ex:
        return f"Could not fetch logs: {ex}"


def fetch_real_prs(repo):
    """Fetch real open pull requests."""
    url = f"https://api.github.com/repos/{repo}/pulls?state=open&per_page=20"
    data = github_get(url)
    return data or []


def build_real_incident(run, jobs, repo):
    """Convert a real GitHub Actions run into a SentinelOps incident."""
    run_id = run["id"]
    wf_name = run["name"]
    branch = run["head_branch"]
    sha = run["head_sha"][:7]
    created_at = run["created_at"]
    html_url = run.get("html_url", "")
    
    # Find failed job and step
    failed_job = None
    failed_step = None
    failure_msg = "Workflow run failed"
    for job in jobs:
        if job.get("conclusion") == "failure":
            failed_job = job
            for step in job.get("steps", []):
                if step.get("conclusion") == "failure":
                    failed_step = step.get("name", "unknown step")
                    failure_msg = f"Step '{failed_step}' failed in job '{job['name']}'"
                    break
            break

    # Determine risk and status
    inc_id = f"INC-{run_id}"
    
    incident = {
        "id": inc_id,
        "repo": repo,
        "pipeline": wf_name,
        "failure": failure_msg,
        "rootCause": f"GitHub Actions workflow '{wf_name}' failed on branch '{branch}' at commit {sha}",
        "confidence": 0,
        "confidenceColor": "secondary",
        "status": "Investigating",
        "time": created_at,
        "runId": run_id,
        "branch": branch,
        "commit": sha,
        "actionLabel": "Investigate",
        "actionVariant": "warning",
        "prNumber": None,
        "guard_status": "PENDING",
        "risk_level": "UNKNOWN",
        "source": "github_live",
        "html_url": html_url,
        "failed_job": failed_job["name"] if failed_job else None,
        "failed_step": failed_step,
        "created_at": created_at,
    }
    return incident


if __name__ == "__main__":
    sys.path.insert(0, os.path.join(os.path.dirname(__file__), "backend"))

    # Add env vars into environment so backend reads them
    for k, v in ENV.items():
        os.environ.setdefault(k, v)

    print("=" * 60)
    print("SentinelOps — Real Data Sync from GitHub")
    print("=" * 60)
    print(f"Repo: {GITHUB_REPO}")

    # 1. Fetch real failed runs
    failed_runs = fetch_real_failed_runs(GITHUB_REPO, max_runs=20)
    if not failed_runs:
        print("No failed runs found! Checking without filter...")
        url = f"https://api.github.com/repos/{GITHUB_REPO}/actions/runs?per_page=20"
        data = github_get(url)
        all_runs = data.get("workflow_runs", []) if data else []
        failed_runs = [r for r in all_runs if r.get("conclusion") in ("failure", "timed_out", "cancelled")]
        print(f"  Found {len(failed_runs)} non-success runs from all runs")

    print(f"\n[2] Processing {len(failed_runs)} failed runs into real incidents...")
    real_incidents = []
    for run in failed_runs[:15]:  # Cap at 15 real incidents
        run_id = run["id"]
        print(f"    Processing run {run_id}: {run['name']} ({run['conclusion']})...")
        jobs = fetch_run_jobs(GITHUB_REPO, run_id)
        incident = build_real_incident(run, jobs, GITHUB_REPO)
        real_incidents.append(incident)
        print(f"      -> INC-{run_id} | failed_step: {incident.get('failed_step', 'N/A')}")

    print(f"\n[3] Saving {len(real_incidents)} real incidents to database...")
    
    from services.incident_service import incident_service
    
    saved = 0
    for inc in real_incidents:
        try:
            existing = incident_service.get_incident(inc["id"])
            if existing:
                print(f"    SKIP (exists): {inc['id']}")
                continue
            incident_service.persist_incident(inc)
            print(f"    SAVED: {inc['id']} | {inc['failure'][:60]}")
            saved += 1
        except Exception as e:
            print(f"    ERROR saving {inc['id']}: {e}")

    # 4. Fetch real PRs
    print(f"\n[4] Fetching real pull requests from {GITHUB_REPO}...")
    prs = fetch_real_prs(GITHUB_REPO)
    print(f"    Found {len(prs)} open PRs")
    for pr in prs[:5]:
        print(f"    PR #{pr['number']}: {pr['title'][:60]} | branch: {pr['head']['ref']}")

    print(f"\n[5] Summary")
    print(f"    Real incidents created: {saved}")
    print(f"    Total real runs processed: {len(real_incidents)}")
    print(f"    Real PRs available: {len(prs)}")
    print("\nDone! Refresh the Incidents page to see real data.")

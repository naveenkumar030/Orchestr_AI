"""Check the PR created by SentinelOps agents."""
import urllib.request
import json

import os

TOKEN = os.environ.get("GITHUB_TOKEN", "")
if not TOKEN and os.path.exists(".env"):
    with open(".env") as f:
        for line in f:
            if line.startswith("GITHUB_TOKEN="):
                TOKEN = line.split("=", 1)[1].strip().strip('"').strip("'")
                break
REPO = "naveenkumar030/testingrepo"

HEADERS = {
    "User-Agent": "SentinelOps",
    "Accept": "application/vnd.github+json",
    "Authorization": f"Bearer {TOKEN}",
}

def gh_get(url):
    req = urllib.request.Request(url, headers=HEADERS)
    with urllib.request.urlopen(req, timeout=15) as resp:
        return json.loads(resp.read())

# Check open PRs
print("=== OPEN PULL REQUESTS ===")
prs = gh_get(f"https://api.github.com/repos/{REPO}/pulls?state=open&per_page=10")
for pr in prs:
    print(f"  PR #{pr['number']}: {pr['title']}")
    print(f"    Branch: {pr['head']['ref']} -> {pr['base']['ref']}")
    print(f"    URL: {pr['html_url']}")
    print(f"    State: {pr['state']}, Draft: {pr.get('draft', False)}")
    print()

# Check recent branches
print("=== RECENT BRANCHES ===")
branches = gh_get(f"https://api.github.com/repos/{REPO}/branches?per_page=20")
for b in branches:
    print(f"  {b['name']}")

# Check latest workflow runs
print("\n=== LATEST WORKFLOW RUNS ===")
runs = gh_get(f"https://api.github.com/repos/{REPO}/actions/runs?per_page=5")
for r in runs.get("workflow_runs", []):
    print(f"  Run #{r['id']}: {r['name']} | branch={r['head_branch']} | status={r['status']} | conclusion={r.get('conclusion')} | sha={r['head_sha'][:8]}")

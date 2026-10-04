"""
Trigger SentinelOps autonomous remediation pipeline for testingrepo failure.
This calls the project's own /api/github/orchestrate endpoint which runs the full agent loop:
  Detect → Diagnose → Fix → SentinelGuard → PR → CI Validation → MergeGuard → Auto-Merge
"""
import urllib.request
import json
import time

BACKEND = "http://127.0.0.1:5000"

# Real failure data from GitHub Actions run #36114116056
RUN_DATA = {
    "run_id": 36114116056,
    "repo": "naveenkumar030/testingrepo",
    "branch": "main",
    "commit_sha": "41e010b41c6a25ef3cba61af65d80f77ec1104d7",
    "workflow_name": "CI Suite"
}

print("=" * 68)
print("  SentinelOps Autonomous Remediation Pipeline")
print("=" * 68)
print(f"  Repo:     {RUN_DATA['repo']}")
print(f"  Run ID:   #{RUN_DATA['run_id']}")
print(f"  Branch:   {RUN_DATA['branch']}")
print(f"  Commit:   {RUN_DATA['commit_sha'][:8]}")
print(f"  Workflow: {RUN_DATA['workflow_name']}")
print("=" * 68)
print()

def post(endpoint, data, timeout=300):
    payload = json.dumps(data).encode()
    req = urllib.request.Request(
        f"{BACKEND}{endpoint}",
        data=payload,
        headers={"Content-Type": "application/json"},
        method="POST"
    )
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return json.loads(resp.read())

# Step 1: Connect the repository
print("[1/4] Connecting repository to SentinelOps...")
try:
    result = post("/api/github/connect", {"repository": RUN_DATA["repo"], "branch": RUN_DATA["branch"]})
    print(f"      ✅ Repository connected: {result}")
except Exception as e:
    print(f"      ⚠️  Connect: {e} (may already be connected)")

print()

# Step 2: Trigger the full autonomous orchestration
print("[2/4] Triggering autonomous agent pipeline...")
print("      → Failure Detection Agent")
print("      → Log Analysis Agent")
print("      → Root Cause Agent")
print("      → Fix Suggester Agent")
print("      → Patch Applicator")
print("      → SentinelGuard")
print("      → PR Creation")
print("      → CI Validation")
print("      → MergeGuard")
print()
print("      [Running... this may take 1-3 minutes]")
print()

start = time.time()
try:
    result = post("/api/github/orchestrate", RUN_DATA, timeout=300)
    elapsed = time.time() - start
    print(f"[3/4] Pipeline completed in {elapsed:.1f}s")
    print()
    print("=" * 68)
    print("  ORCHESTRATION RESULT")
    print("=" * 68)
    print(json.dumps(result, indent=2))
except Exception as e:
    print(f"      ❌ Orchestration error: {e}")
    print()
    # Fallback: try the simpler remediate endpoint
    print("[2b/4] Trying remediation endpoint as fallback...")
    try:
        result = post("/api/github/remediate", RUN_DATA, timeout=300)
        elapsed = time.time() - start
        print(f"       Completed in {elapsed:.1f}s")
        print(json.dumps(result, indent=2))
    except Exception as e2:
        print(f"       ❌ Remediation also failed: {e2}")

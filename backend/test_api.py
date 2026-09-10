"""
Automated Integration Test Suite for SentinelOps Python Flask REST API.
Verifies contract adherence, data mutations, status codes, and JSON schemas.
Run via: python backend/test_api.py
"""

import sys
import os

# Ensure backend directory is in python search path
CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
if CURRENT_DIR not in sys.path:
    sys.path.insert(0, CURRENT_DIR)

from app import app


def run_tests():
    client = app.test_client()
    passed = 0
    total = 0

    def assert_eq(desc, actual, expected):
        nonlocal passed, total
        total += 1
        if actual == expected:
            print(f"  [PASS] {desc}")
            passed += 1
        else:
            print(f"  [FAIL] {desc} — Expected: {expected}, Got: {actual}")
            sys.exit(1)

    print("=" * 60)
    print("  SentinelOps Python REST API -- Automated Test Runner")
    print("=" * 60)

    # 1. Health & Telemetry
    print("\n[1/7] Testing Health & Telemetry...")
    res = client.get("/api/health")
    assert_eq("GET /api/health status is 200", res.status_code, 200)
    data = res.get_json()
    assert_eq("Backend is Python Flask", data.get("backend"), "Python Flask")
    assert_eq("Status is healthy", data.get("status"), "healthy")
    assert_eq("Has Python runtime version", bool(data.get("pythonVersion")), True)
    assert_eq("Has active agents count", "activeAgents" in data, True)

    # 2. Overview
    print("\n[2/7] Testing Overview...")
    res = client.get("/api/overview")
    assert_eq("GET /api/overview status is 200", res.status_code, 200)
    ov = res.get_json()
    assert_eq("Overview contains kpiMetrics", len(ov.get("kpiMetrics", [])) > 0, True)
    assert_eq("Overview contains remediationSteps", len(ov.get("remediationSteps", [])) > 0, True)

    # 3. Pipelines
    print("\n[3/7] Testing Pipelines...")
    res = client.get("/api/pipelines")
    assert_eq("GET /api/pipelines status is 200", res.status_code, 200)
    pipes = res.get_json()
    assert_eq("Pipelines list non-empty", len(pipes) > 0, True)

    res = client.post("/api/pipelines/trigger", json={
        "repo": "billing-service",
        "branch": "feat/stripe-v14",
        "name": "Integration Test Pipeline"
    })
    assert_eq("POST /api/pipelines/trigger status is 201", res.status_code, 201)
    new_pipe = res.get_json()
    assert_eq("Triggered pipeline has running status", new_pipe.get("status"), "running")

    res = client.post(f"/api/pipelines/{pipes[0]['id']}/retry")
    assert_eq("POST /api/pipelines/<id>/retry status is 200", res.status_code, 200)

    # 4. Incidents
    print("\n[4/7] Testing Incidents...")
    res = client.get("/api/incidents")
    assert_eq("GET /api/incidents status is 200", res.status_code, 200)
    incs = res.get_json()
    assert_eq("Incidents list non-empty", len(incs) > 0, True)

    res = client.post("/api/incidents/inc-8924/explain")
    assert_eq("POST /api/incidents/inc-8924/explain status is 200", res.status_code, 200)
    exp = res.get_json()
    assert_eq("Explanation confidence is > 90", exp.get("confidence", 0) > 90, True)

    res = client.post("/api/incidents/inc-8924/status", json={"status": "Resolved"})
    assert_eq("POST /api/incidents/inc-8924/status is 200", res.status_code, 200)
    assert_eq("Incident status updated to Resolved", res.get_json().get("status"), "Resolved")

    res = client.post("/api/incidents/simulate")
    assert_eq("POST /api/incidents/simulate status is 201", res.status_code, 201)
    sim_inc = res.get_json()
    assert_eq("Simulated incident has Investigating status", sim_inc.get("status"), "Investigating")

    # 5. AI Agents
    print("\n[5/7] Testing AI Agents Fleet...")
    res = client.get("/api/ai-agents")
    assert_eq("GET /api/ai-agents status is 200", res.status_code, 200)
    agents = res.get_json()
    assert_eq("AI Agents list has >= 6 nodes", len(agents) >= 6, True)

    # Deploy new agent pod
    res = client.post("/api/ai-agents", json={
        "name": "CanaryGuard-Pro",
        "role": "Canary Deployment Monitor",
        "capability": "Automated eBPF latency tracking & instant rollback",
        "status": "active"
    })
    assert_eq("POST /api/ai-agents status is 201", res.status_code, 201)
    new_agent = res.get_json()
    assert_eq("New agent has active status", new_agent.get("status"), "active")

    # Update agent status
    res = client.patch(f"/api/ai-agents/{agents[0]['id']}/status", json={"status": "standby"})
    assert_eq("PATCH /api/ai-agents/<id>/status is 200", res.status_code, 200)
    assert_eq("Agent status toggled to standby", res.get_json().get("status"), "standby")

    # 6. Pull Requests & Logs
    print("\n[6/7] Testing PRs & Logs...")
    res = client.get("/api/pull-requests")
    assert_eq("GET /api/pull-requests status is 200", res.status_code, 200)
    prs = res.get_json()
    assert_eq("PRs list non-empty", len(prs) > 0, True)

    res = client.post(f"/api/pull-requests/{prs[0]['id']}/review")
    assert_eq("POST /api/pull-requests/<id>/review is 200", res.status_code, 200)

    res = client.post("/api/logs", json={
        "service": "test-runner",
        "level": "INFO",
        "message": "Integration test event recorded"
    })
    assert_eq("POST /api/logs status is 201", res.status_code, 201)

    # 7. Settings & Analytics
    print("\n[7/7] Testing Settings & Analytics...")
    res = client.get("/api/settings")
    assert_eq("GET /api/settings status is 200", res.status_code, 200)

    res = client.post("/api/settings", json={"confidenceThreshold": 96})
    assert_eq("POST /api/settings status is 200", res.status_code, 200)
    assert_eq("Settings updated", res.get_json().get("confidenceThreshold"), 96)

    res = client.get("/api/analytics?range=7d")
    assert_eq("GET /api/analytics?range=7d status is 200", res.status_code, 200)
    an_7d = res.get_json()
    assert_eq("Analytics contains dora metrics", "dora" in an_7d, True)
    assert_eq("Analytics contains microservices", len(an_7d.get("microservices", [])) >= 5, True)

    res = client.get("/api/analytics?range=30d")
    assert_eq("GET /api/analytics?range=30d status is 200", res.status_code, 200)

    print("\n" + "=" * 60)
    print(f"  All Tests Passed! ({passed}/{total} assertions verified)")
    print("=" * 60)


if __name__ == "__main__":
    run_tests()

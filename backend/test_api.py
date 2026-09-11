"""
Automated Integration Test Suite for SentinelOps Python Flask REST API.
Run via: pytest backend/test_api.py -v
"""

import pytest
import sys
import os

# Ensure backend directory is in python search path
CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
if CURRENT_DIR not in sys.path:
    sys.path.insert(0, CURRENT_DIR)

from app import app


@pytest.fixture
def client():
    app.config["TESTING"] = True
    with app.test_client() as client:
        yield client


def test_health_telemetry(client):
    res = client.get("/api/health")
    assert res.status_code == 200
    data = res.get_json()
    assert data.get("backend") == "Python Flask"
    assert data.get("status") == "healthy"
    assert data.get("pythonVersion") is not None
    assert "activeAgents" in data


def test_overview(client):
    res = client.get("/api/overview")
    assert res.status_code == 200
    ov = res.get_json()
    assert len(ov.get("kpiMetrics", [])) > 0
    assert len(ov.get("remediationSteps", [])) > 0


def test_pipelines_list(client):
    res = client.get("/api/pipelines")
    assert res.status_code == 200
    pipes = res.get_json()
    assert len(pipes) > 0


def test_pipelines_trigger(client):
    res = client.post("/api/pipelines/trigger", json={
        "repo": "billing-service",
        "branch": "feat/stripe-v14",
        "name": "Integration Test Pipeline"
    })
    assert res.status_code == 201
    new_pipe = res.get_json()
    assert new_pipe.get("status") == "running"


def test_pipelines_retry(client):
    pipes_res = client.get("/api/pipelines")
    pipes = pipes_res.get_json()
    
    res = client.post(f"/api/pipelines/{pipes[0]['id']}/retry")
    assert res.status_code == 200


def test_incidents_list(client):
    res = client.get("/api/incidents")
    assert res.status_code == 200
    incs = res.get_json()
    assert len(incs) > 0


def test_incidents_explain(client):
    res = client.post("/api/incidents/inc-8924/explain")
    assert res.status_code == 200
    exp = res.get_json()
    assert exp.get("confidence", 0) > 90


def test_incidents_status_update(client):
    res = client.post("/api/incidents/inc-8924/status", json={"status": "Resolved"})
    assert res.status_code == 200
    assert res.get_json().get("status") == "Resolved"


def test_incidents_simulate(client):
    res = client.post("/api/incidents/simulate")
    assert res.status_code == 201
    sim_inc = res.get_json()
    assert sim_inc.get("status") == "Investigating"


def test_ai_agents_fleet(client):
    res = client.get("/api/ai-agents")
    assert res.status_code == 200
    agents = res.get_json()
    assert len(agents) >= 6


def test_ai_agents_deploy_and_update(client):
    # Deploy new agent pod
    res = client.post("/api/ai-agents", json={
        "name": "CanaryGuard-Pro",
        "role": "Canary Deployment Monitor",
        "capability": "Automated eBPF latency tracking & instant rollback",
        "status": "active"
    })
    assert res.status_code == 201
    new_agent = res.get_json()
    assert new_agent.get("status") == "active"

    # Update agent status
    agents_res = client.get("/api/ai-agents")
    agents = agents_res.get_json()
    
    update_res = client.patch(f"/api/ai-agents/{agents[0]['id']}/status", json={"status": "standby"})
    assert update_res.status_code == 200
    assert update_res.get_json().get("status") == "standby"


def test_pull_requests_list(client):
    res = client.get("/api/pull-requests")
    assert res.status_code == 200
    prs = res.get_json()
    assert len(prs) > 0


def test_pull_requests_review(client):
    prs_res = client.get("/api/pull-requests")
    prs = prs_res.get_json()
    
    res = client.post(f"/api/pull-requests/{prs[0]['id']}/review")
    assert res.status_code == 200


def test_logs_post(client):
    res = client.post("/api/logs", json={
        "service": "test-runner",
        "level": "INFO",
        "message": "Integration test event recorded"
    })
    assert res.status_code == 201


def test_settings_get(client):
    res = client.get("/api/settings")
    assert res.status_code == 200


def test_settings_update(client):
    res = client.post("/api/settings", json={"confidenceThreshold": 96})
    assert res.status_code == 200
    assert res.get_json().get("confidenceThreshold") == 96


@pytest.mark.parametrize("range_val", ["7d", "30d"])
def test_analytics(client, range_val):
    res = client.get(f"/api/analytics?range={range_val}")
    assert res.status_code == 200
    if range_val == "7d":
        an_7d = res.get_json()
        assert "dora" in an_7d
        assert len(an_7d.get("microservices", [])) >= 5


# ── GitHub Webhook Integration Tests ──────────────────────────────────────────
def test_github_webhook_ping_dev_mode(client, monkeypatch):
    """Test ping event without secret configured (dev mode)."""
    monkeypatch.delenv("GITHUB_WEBHOOK_SECRET", raising=False)
    res = client.post(
        "/api/webhooks/github",
        headers={"X-GitHub-Event": "ping"},
        json={"zen": "Approachable is better than simple."}
    )
    assert res.status_code == 200
    data = res.get_json()
    assert data.get("status") == "pong"


def test_github_webhook_ping_valid_signature(client, monkeypatch):
    """Test ping event with strict HMAC-SHA256 signature verification."""
    import hmac
    import hashlib
    import json

    test_secret = "9f3a1c8e2b7d4f6a0e5c9b1d8f2a4c6e7b0d3f5a1c9e8b4d6f2a0c8e5b1d9f3a"
    monkeypatch.setenv("GITHUB_WEBHOOK_SECRET", test_secret)

    payload_bytes = json.dumps({"zen": "Mind your words."}).encode("utf-8")
    sig = "sha256=" + hmac.new(test_secret.encode("utf-8"), payload_bytes, hashlib.sha256).hexdigest()

    res = client.post(
        "/api/webhooks/github",
        data=payload_bytes,
        headers={
            "Content-Type": "application/json",
            "X-GitHub-Event": "ping",
            "X-Hub-Signature-256": sig,
        }
    )
    assert res.status_code == 200
    assert res.get_json().get("status") == "pong"


def test_github_webhook_invalid_signature_rejected(client, monkeypatch):
    """Test that requests with an invalid HMAC signature are rejected with 401."""
    monkeypatch.setenv("GITHUB_WEBHOOK_SECRET", "super-secret-key")

    res = client.post(
        "/api/webhooks/github",
        headers={
            "Content-Type": "application/json",
            "X-GitHub-Event": "ping",
            "X-Hub-Signature-256": "sha256=invalid_tampered_signature_12345",
        },
        json={"zen": "Security first"}
    )
    assert res.status_code == 401
    assert "Invalid HMAC" in res.get_json().get("error", "")


def test_github_webhook_workflow_run_event(client, monkeypatch):
    """Test that workflow_run events update SentinelOps pipeline states and logs."""
    monkeypatch.delenv("GITHUB_WEBHOOK_SECRET", raising=False)
    payload = {
        "action": "completed",
        "workflow_run": {
            "id": 987654321,
            "name": "Deploy SentinelOps to Production",
            "head_branch": "main",
            "head_sha": "a1b2c3d4e5f6",
            "status": "completed",
            "conclusion": "success",
            "actor": {"login": "devops-engineer"}
        },
        "repository": {
            "name": "payment-service"
        },
        "sender": {
            "login": "devops-engineer"
        }
    }

    res = client.post(
        "/api/webhooks/github",
        headers={"X-GitHub-Event": "workflow_run"},
        json=payload
    )
    assert res.status_code == 200
    data = res.get_json()
    assert data.get("status") == "processed"
    assert data.get("event") == "workflow_run"
    assert data.get("result", {}).get("status") == "success"

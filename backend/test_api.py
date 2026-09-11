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


def test_github_webhook_push_event(client, monkeypatch):
    """Test that push events create running pipelines and logs."""
    monkeypatch.delenv("GITHUB_WEBHOOK_SECRET", raising=False)
    payload = {
        "ref": "refs/heads/feature/oauth",
        "pusher": {"name": "alice-dev"},
        "head_commit": {
            "id": "7b8c9d0e1f2a",
            "message": "feat: add Google OAuth provider"
        },
        "repository": {"name": "auth-service"},
        "commits": [{"id": "7b8c9d0e1f2a"}]
    }

    res = client.post(
        "/api/webhooks/github",
        headers={"X-GitHub-Event": "push"},
        json=payload
    )
    assert res.status_code == 200
    data = res.get_json()
    assert data.get("status") == "processed"
    assert data.get("event") == "push"
    assert data.get("result", {}).get("status") == "running"
    assert data.get("result", {}).get("branch") == "feature/oauth"


def test_github_webhook_pull_request_event(client, monkeypatch):
    """Test that pull_request opened events generate AI review audits."""
    monkeypatch.delenv("GITHUB_WEBHOOK_SECRET", raising=False)
    payload = {
        "action": "opened",
        "number": 204,
        "pull_request": {
            "number": 204,
            "title": "fix: prevent deadlocks in worker transaction queue",
            "head": {"ref": "fix/deadlock"},
            "base": {"ref": "main"},
            "user": {"login": "bob-architect"},
            "changed_files": 4,
            "additions": 56,
            "deletions": 18,
        },
        "repository": {"name": "payment-service"},
        "sender": {"login": "bob-architect"}
    }

    res = client.post(
        "/api/webhooks/github",
        headers={"X-GitHub-Event": "pull_request"},
        json=payload
    )
    assert res.status_code == 200
    data = res.get_json()
    assert data.get("status") == "processed"
    assert data.get("event") == "pull_request"
    assert data.get("result", {}).get("status") == "reviewing"
    assert data.get("result", {}).get("aiScore") > 80


def test_github_status_and_history(client):
    """Test the GitHub integration status and webhook history API."""
    res = client.get("/api/github/status")
    assert res.status_code == 200
    data = res.get_json()
    assert data.get("status") == "active"
    assert "repository" in data
    assert "webhookEndpoint" in data
    assert "recentEvents" in data
    assert isinstance(data["recentEvents"], list)


def test_github_test_webhook_simulation(client):
    """Test the in-app webhook simulator endpoint."""
    res = client.post(
        "/api/github/test-webhook",
        json={"event": "workflow_run"}
    )
    assert res.status_code == 200
    data = res.get_json()
    assert data.get("status") == "processed"
    assert data.get("event") == "workflow_run"


def test_github_dispatch_endpoint(client):
    """Test the GitHub Actions workflow dispatch endpoint."""
    res = client.post(
        "/api/github/dispatch",
        json={"branch": "main", "workflow": "deploy.yml"}
    )
    assert res.status_code == 200
    data = res.get_json()
    assert data.get("success") is True
    assert "pipeline" in data


def test_github_webhook_workflow_run_valid_signature(client, monkeypatch):
    """Test workflow_run event with valid HMAC-SHA256 signature."""
    import hmac
    import hashlib
    import json

    test_secret = "test-workflow-secret-key-12345"
    monkeypatch.setenv("GITHUB_WEBHOOK_SECRET", test_secret)

    payload = {
        "action": "completed",
        "workflow_run": {
            "id": 11223344,
            "name": "Integration Tests",
            "head_branch": "main",
            "head_sha": "f1e2d3c4b5a6",
            "status": "completed",
            "conclusion": "success",
            "actor": {"login": "ci-bot"}
        },
        "repository": {"name": "order-service", "full_name": "org/order-service"},
        "sender": {"login": "ci-bot"}
    }
    payload_bytes = json.dumps(payload).encode("utf-8")
    sig = "sha256=" + hmac.new(test_secret.encode("utf-8"), payload_bytes, hashlib.sha256).hexdigest()

    res = client.post(
        "/api/webhooks/github",
        data=payload_bytes,
        headers={
            "Content-Type": "application/json",
            "X-GitHub-Event": "workflow_run",
            "X-Hub-Signature-256": sig,
        }
    )
    assert res.status_code == 200
    data = res.get_json()
    assert data.get("status") == "processed"
    assert data.get("event") == "workflow_run"


def test_github_webhook_workflow_run_invalid_signature(client, monkeypatch):
    """Test workflow_run event with invalid HMAC-SHA256 signature is rejected with 401."""
    monkeypatch.setenv("GITHUB_WEBHOOK_SECRET", "expected-secret")

    payload = {
        "action": "completed",
        "workflow_run": {
            "id": 999888,
            "name": "Build & Test",
            "head_branch": "feature/branch",
            "head_sha": "abcdef123456",
            "status": "completed",
            "conclusion": "failure"
        },
        "repository": {"name": "auth-service"}
    }

    res = client.post(
        "/api/webhooks/github",
        headers={
            "Content-Type": "application/json",
            "X-GitHub-Event": "workflow_run",
            "X-Hub-Signature-256": "sha256=tampered_signature_value_xyz",
        },
        json=payload
    )
    assert res.status_code == 401
    assert "Invalid HMAC" in res.get_json().get("error", "")


def test_github_webhook_workflow_run_success_detection(client, monkeypatch):
    """Test completed successful workflow_run event updates pipeline without triggering incident."""
    monkeypatch.delenv("GITHUB_WEBHOOK_SECRET", raising=False)

    payload = {
        "action": "completed",
        "workflow_run": {
            "id": 55667788,
            "name": "Production Release Pipeline",
            "head_branch": "release-v2.5",
            "head_sha": "c0ffee123456",
            "status": "completed",
            "conclusion": "success",
            "actor": {"login": "release-manager"}
        },
        "repository": {"name": "payment-service", "full_name": "sentinel/payment-service"},
        "sender": {"login": "release-manager"}
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
    # No incident should be generated for a successful run
    assert data.get("incident") is None
    assert data.get("result", {}).get("incident") is None


def test_github_webhook_workflow_run_failed_detection(client, monkeypatch):
    """
    Test completed failed workflow_run event:
    Detects failure, extracts repository, workflow name, run ID, branch, commit SHA, status, conclusion,
    and returns a structured incident event.
    """
    monkeypatch.delenv("GITHUB_WEBHOOK_SECRET", raising=False)

    run_id = 77889900
    repo_name = "billing-engine"
    wf_name = "Stripe Billing & Tax Tests"
    branch = "fix/tax-calc"
    commit_sha = "d4e5f6a7b8c9"

    payload = {
        "action": "completed",
        "workflow_run": {
            "id": run_id,
            "name": wf_name,
            "head_branch": branch,
            "head_sha": commit_sha,
            "status": "completed",
            "conclusion": "failure",
            "html_url": f"https://github.com/sentinel/{repo_name}/actions/runs/{run_id}",
            "actor": {"login": "devops-engineer"}
        },
        "repository": {
            "name": repo_name,
            "full_name": f"sentinel/{repo_name}"
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
    assert data.get("result", {}).get("status") == "failed"

    # Verify structured incident event in response
    incident = data.get("incident")
    assert incident is not None, "Expected structured incident in webhook response"
    assert incident.get("id") == f"INC-{run_id}"
    assert incident.get("repository") == f"sentinel/{repo_name}"
    assert incident.get("workflow") == wf_name
    assert incident.get("run_id") == run_id
    assert incident.get("branch") == branch
    assert incident.get("commit_sha") == commit_sha
    assert incident.get("status") == "completed"
    assert incident.get("conclusion") == "failure"
    assert incident.get("event_type") == "workflow_run_failure"
    assert incident.get("severity") == "high"
    assert incident.get("incident_status") == "Investigating"

    # Verify incident is recorded in SentinelOps incidents store
    inc_res = client.get("/api/incidents")
    assert inc_res.status_code == 200
    incidents = inc_res.get_json()
    matched = [i for i in incidents if i.get("id") == f"INC-{run_id}"]
    assert len(matched) == 1
    assert matched[0].get("repo") == repo_name
    assert matched[0].get("status") in ["Investigating", "Remediated"]
    assert matched[0].get("prNumber") is not None


def test_github_service_isolated_methods():
    """Unit test for isolated GitHubService methods and security helpers."""
    from services.github_service import GitHubService
    from security.webhook import verify_github_signature
    import hmac
    import hashlib

    # 1. Test signature verification helper directly
    secret = "my-secret"
    body = b'{"hello": "world"}'
    valid_sig = "sha256=" + hmac.new(secret.encode("utf-8"), body, hashlib.sha256).hexdigest()

    ok, msg = verify_github_signature(body, valid_sig, secret=secret)
    assert ok is True
    assert msg == "Signature verified"

    bad_ok, bad_msg = verify_github_signature(body, "sha256=invalid", secret=secret)
    assert bad_ok is False
    assert "Invalid HMAC" in bad_msg

    # 2. Test GitHubService parsing and incident formatting
    service = GitHubService(token=None)
    payload = {
        "action": "completed",
        "workflow_run": {
            "id": 12345,
            "name": "CI Build",
            "head_branch": "main",
            "head_sha": "abc1234567",
            "status": "completed",
            "conclusion": "failure",
        },
        "repository": {"full_name": "owner/repo", "name": "repo"}
    }

    parsed = service.parse_workflow_run(payload)
    assert parsed["repository"] == "owner/repo"
    assert parsed["workflow_name"] == "CI Build"
    assert parsed["run_id"] == 12345
    assert parsed["branch"] == "main"
    assert parsed["commit_sha"] == "abc1234567"
    assert parsed["status"] == "completed"
    assert parsed["conclusion"] == "failure"

    assert service.is_failed_workflow(parsed) is True

    inc = service.create_incident_from_workflow_run(parsed)
    assert inc["id"] == "INC-12345"
    assert inc["repository"] == "owner/repo"
    assert inc["run_id"] == 12345
    assert inc["conclusion"] == "failure"


def test_database_models_relationships():
    """Verify relational database models and relationship traversal."""
    from database import get_db, init_db
    from models.workflow import Repository, WorkflowRun, PipelineJob
    from models.incident import Incident
    from models.analysis import AIAnalysis
    from models.remediation import Remediation, PullRequest, Approval

    init_db()
    with get_db() as db:
        # Create or fetch Repository (idempotent across repeated test runs)
        repo = db.query(Repository).filter_by(full_name="sentinel/checkout-svc").first()
        if not repo:
            repo = Repository(
                name="checkout-svc",
                full_name="sentinel/checkout-svc",
                owner="sentinel",
                default_branch="main"
            )
            db.add(repo)
            db.flush()
        assert repo.id is not None

        # Create or fetch WorkflowRun (idempotent)
        wf = db.query(WorkflowRun).filter_by(run_id=987001).first()
        if not wf:
            wf = WorkflowRun(
                run_id=987001,
                repository_id=repo.id,
                repo_name=repo.full_name,
                name="CI Pipeline",
                branch="main",
                commit_sha="a1b2c3d",
                status="completed",
                conclusion="failure"
            )
            db.add(wf)
            db.flush()

        # Create PipelineJob (always create; no unique constraint)
        job = PipelineJob(
            workflow_run_id=wf.id,
            name="Build & Test",
            status="completed",
            conclusion="failure"
        )
        db.add(job)
        db.flush()

        # Create or fetch Incident (idempotent)
        inc = db.query(Incident).filter_by(id="INC-987001").first()
        if not inc:
            inc = Incident(
                id="INC-987001",
                workflow_run_id=wf.id,
                repo=repo.name,
                pipeline=wf.name,
                failure="Build Error: Exit code 1",
                rootCause="Dependency version mismatch",
                confidence=94,
                status="Investigating",
                runId=wf.run_id,
                branch=wf.branch,
                commit=wf.commit_sha
            )
            db.add(inc)
            db.flush()

        # Create AIAnalysis (always create; no unique constraint)
        analysis = AIAnalysis(
            incident_id=inc.id,
            agent_name="Healer-Alpha",
            category="dependency_error",
            severity="high",
            confidence=94,
            root_cause="Missing lockfile reconciliation for package",
            affected_files='["package.json", "package-lock.json"]',
            recommended_fix="Pin dependency version"
        )
        db.add(analysis)
        db.flush()

        # Create Remediation (always create; no unique constraint)
        rem = Remediation(
            incident_id=inc.id,
            action_type="dependency_lock_pin",
            policy_status="SAFE",
            status="pending"
        )
        db.add(rem)
        db.flush()

        # Create PullRequest (always create; no unique constraint)
        pr = PullRequest(
            repository_id=repo.id,
            remediation_id=rem.id,
            pr_number=501,
            title="fix: pin dependency to resolve build failure",
            branch="fix/dep-pin-501",
            status="open",
            ai_score=96
        )
        db.add(pr)
        db.flush()

        # Create Approval (always create; no unique constraint)
        approval = Approval(
            remediation_id=rem.id,
            approver="lead-devops",
            status="approved"
        )
        db.add(approval)
        db.flush()

        # Verify relationships and serialization
        assert len(repo.workflow_runs) >= 1
        assert len(wf.incidents) >= 1
        assert len(inc.analyses) >= 1
        assert len(inc.remediations) >= 1
        assert rem.pull_request is not None
        assert len(rem.approvals) >= 1
        assert inc.to_dict()["id"] == "INC-987001"
        assert pr.to_dict()["pr_number"] == 501



def test_database_persistence_via_webhook(client, monkeypatch):
    """Verify that incoming failed workflow webhooks persist to the database."""
    from services.incident_service import incident_service

    monkeypatch.delenv("GITHUB_WEBHOOK_SECRET", raising=False)
    unique_run_id = 99881122
    payload = {
        "action": "completed",
        "workflow_run": {
            "id": unique_run_id,
            "name": "Database Persistence Test Workflow",
            "head_branch": "test/db-persist",
            "head_sha": "e9f8a7b6",
            "status": "completed",
            "conclusion": "failure",
            "actor": {"login": "db-tester"}
        },
        "repository": {"name": "db-service", "full_name": "sentinel/db-service"},
        "sender": {"login": "db-tester"}
    }

    res = client.post(
        "/api/webhooks/github",
        headers={"X-GitHub-Event": "workflow_run"},
        json=payload
    )
    assert res.status_code == 200

    # Verify query through database service
    db_incs = incident_service.get_all_incidents()
    target = next((i for i in db_incs if i.get("id") == f"INC-{unique_run_id}"), None)
    assert target is not None, "Failed workflow incident should be persisted in the database"
    assert target["repo"] == "db-service"
    assert target["runId"] == unique_run_id
    assert target["status"] in ["Investigating", "Remediated"]

    # Test updating status persists to database
    update_res = client.post(f"/api/incidents/INC-{unique_run_id}/status", json={"status": "Resolved"})
    assert update_res.status_code == 200

    updated_db_incs = incident_service.get_all_incidents()
    updated_target = next((i for i in updated_db_incs if i.get("id") == f"INC-{unique_run_id}"), None)
    assert updated_target["status"] == "Resolved"


def test_end_to_end_autonomous_remediation_pipeline(client, monkeypatch):
    """
    Validates the complete autonomous loop:
    GitHub Actions Workflow Fails -> Webhook Event -> Flask Backend ->
    GitHub REST API (Logs) -> AI Agent (Healer-Alpha Root Cause) ->
    Branch + PR Creation -> Store & UI Synchronization.
    """
    monkeypatch.delenv("GITHUB_WEBHOOK_SECRET", raising=False)
    run_id = 987654
    failed_webhook_payload = {
        "action": "completed",
        "workflow_run": {
            "id": run_id,
            "name": "CI / Test & Build Suite",
            "head_branch": "main",
            "head_sha": "f1e2d3c4b5a6",
            "status": "completed",
            "conclusion": "failure",
            "actor": {"login": "ci-runner"},
        },
        "repository": {"name": "payment-service", "full_name": "naveenkumar030/payment-service"},
        "sender": {"login": "ci-runner"},
    }

    # 1. Trigger via GitHub Webhook
    resp = client.post(
        "/api/webhooks/github",
        headers={"X-GitHub-Event": "workflow_run"},
        json=failed_webhook_payload,
    )
    assert resp.status_code == 200
    data = resp.get_json()
    assert data["status"] == "processed"
    assert data["event"] == "workflow_run"

    # 2. Verify Incident has been created and auto-remediated by Healer-Alpha
    inc_res = client.get(f"/api/incidents/INC-{run_id}")
    assert inc_res.status_code == 200
    inc = inc_res.get_json()
    assert inc["id"] == f"INC-{run_id}"
    assert inc["status"] == "Remediated"
    assert inc["confidence"] >= 90
    assert "AssertionError" in inc["rootCause"] or "failure" in inc["rootCause"].lower()
    assert inc["prNumber"] is not None
    assert f"sentinelops/fix-{run_id}" in inc["remediationBranch"]
    assert inc["diff"] is not None
    assert "--- a/" in inc["diff"]

    # 3. Verify PR appears in Pull Requests dashboard
    prs_res = client.get("/api/pull-requests")
    assert prs_res.status_code == 200
    all_prs = prs_res.get_json()
    matching_pr = next((p for p in all_prs if p.get("number") == inc["prNumber"]), None)
    assert matching_pr is not None
    assert "Healer-Alpha" in matching_pr.get("title", "") or "SentinelOps AI" in matching_pr.get("title", "")

    # 4. Verify on-demand remediation endpoint
    on_demand_res = client.post(f"/api/incidents/INC-{run_id}/remediate")
    assert on_demand_res.status_code == 200
    on_demand_data = on_demand_res.get_json()
    assert on_demand_data["status"] == "remediated"
    assert on_demand_data["agent"] == "Healer-Alpha"

    # 5. Verify direct GitHub remediation dispatch endpoint
    direct_res = client.post("/api/github/remediate", json={"run_id": 999111, "repo": "auth-service"})
    assert direct_res.status_code == 200
    assert direct_res.get_json()["status"] == "success"


def test_webhook_relay_service_and_endpoints(client):
    """Verifies Smee.io Webhook Relay control endpoints and payload forwarding."""
    from services.webhook_relay import webhook_relay_service

    # 1. Check relay status endpoint
    status_res = client.get("/api/github/relay/status")
    assert status_res.status_code == 200
    status_data = status_res.get_json()
    assert "smeeUrl" in status_data
    assert "https://smee.io/" in status_data["smeeUrl"]

    # 2. Check relay start endpoint
    start_res = client.post("/api/github/relay/start", json={"channel_id": "test-sentinelops-channel"})
    assert start_res.status_code == 200
    start_data = start_res.get_json()
    assert start_data["status"] == "started"
    assert webhook_relay_service.running is True
    assert webhook_relay_service.channel_id == "test-sentinelops-channel"

    # 3. Check relay stop endpoint
    stop_res = client.post("/api/github/relay/stop")
    assert stop_res.status_code == 200
    assert stop_res.get_json()["status"] == "stopped"
    assert webhook_relay_service.running is False

    # 4. Check GitHub status contains relay metadata
    gh_status = client.get("/api/github/status").get_json()
    assert "relay" in gh_status
    assert gh_status["relay"]["channelId"] == "test-sentinelops-channel"


def test_ngrok_service_and_endpoints(client, monkeypatch):
    """Verifies ngrok tunnel service endpoints and status reporting."""
    from services.ngrok_service import ngrok_service
    monkeypatch.setattr(ngrok_service, "authtoken", "test_authtoken_123")

    # 1. Check ngrok status endpoint
    status_res = client.get("/api/github/ngrok/status")
    assert status_res.status_code == 200
    data = status_res.get_json()
    assert "running" in data
    assert "tokenConfigured" in data
    assert data["tokenConfigured"] is True

    # 2. Check github/status contains ngrok metadata
    gh_status = client.get("/api/github/status").get_json()
    assert "ngrok" in gh_status
    assert "tokenConfigured" in gh_status["ngrok"]

    # 3. Check start and stop endpoints (with mock to avoid blocking on network tunnel)
    monkeypatch.setattr(
        ngrok_service,
        "start",
        lambda port=5000, authtoken=None: {
            "running": True,
            "publicUrl": "https://test-subdomain.ngrok-free.app",
            "webhookUrl": "https://test-subdomain.ngrok-free.app/api/webhooks/github",
            "port": port,
            "tokenConfigured": True,
        }
    )
    start_res = client.post("/api/github/ngrok/start", json={"port": 5000})
    assert start_res.status_code == 200
    assert start_res.get_json()["status"] == "started"
    assert "ngrok-free.app" in start_res.get_json()["ngrok"]["publicUrl"]

    monkeypatch.setattr(
        ngrok_service,
        "stop",
        lambda: {
            "running": False,
            "publicUrl": None,
            "webhookUrl": None,
            "port": 5000,
            "tokenConfigured": True,
        }
    )
    stop_res = client.post("/api/github/ngrok/stop")
    assert stop_res.status_code == 200
    assert stop_res.get_json()["status"] == "stopped"







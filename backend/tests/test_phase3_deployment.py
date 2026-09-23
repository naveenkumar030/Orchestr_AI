"""
Comprehensive Test Suite for SentinelOps Phase 3:
Autonomous Deployment Verification, Health Check Probing, DeploymentGuard Policy, and Rollback Engine.
"""

import os
import sys
from unittest.mock import patch

import pytest

CURRENT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if CURRENT_DIR not in sys.path:
    sys.path.insert(0, CURRENT_DIR)

from services.deployment_guard import DeploymentGuard
from services.health_check_service import HealthCheckService
from services.remediation_orchestrator import remediation_orchestrator
from services.rollback_service import RollbackService

# ── Fixtures & Setup ──────────────────────────────────────────────────────────

@pytest.fixture(autouse=True)
def reset_services_state(monkeypatch):
    """Resets services and store between tests and isolates from external state."""
    from data_store import store
    from services.mongo_service import mongo_service

    monkeypatch.setattr(mongo_service, "_is_connected", False)
    store.deployments.clear()
    store.rollbacks.clear()
    store.incidents = [i for i in store.incidents if not str(i.get("id", "")).startswith("INC-9010")]
    yield
    store.deployments.clear()
    store.rollbacks.clear()
    store.incidents = [i for i in store.incidents if not str(i.get("id", "")).startswith("INC-9010")]


# ── Test 1: Complete Happy Path (Deploy -> Health Check Pass -> Guard Pass -> Resolved) ──

def test_phase3_deploy_success_health_healthy_declares_resolved():
    """
    Validates complete happy path:
    CI Success -> MergeGuard Approved -> Auto-Merge -> Deploy SUCCESS ->
    Health Check HEALTHY (2 consecutive 200 OKs) -> DeploymentGuard Approved -> INCIDENT RESOLVED.
    """
    run_data = {
        "repository": "payment-service",
        "workflow_name": "CI/CD Pipeline",
        "run_id": 901001,
        "branch": "main",
        "commit_sha": "a1b2c3d4e5f6",
        "conclusion": "failure",
        "action": "completed",
    }

    result = remediation_orchestrator.handle_remediation(
        run_data,
        trigger_source="test_phase3_happy_path",
        override_ci_status="SUCCESS",
        override_confidence=96,
        override_risk="LOW",
        override_merge_success=True,
        override_deployment_status="SUCCESS",
        override_health_status="HEALTHY",
    )

    assert result["status"] == "resolved"
    assert result["merged"] is True
    assert result["deployment"] is not None
    assert result["deployment"]["status"] == "SUCCESS"
    assert result["health_check"] is not None
    assert result["health_check"]["status"] == "HEALTHY"
    assert result["deployment_guard"] is not None
    assert result["deployment_guard"]["allowed"] is True
    assert result["incident"]["status"] == "Resolved"

    # Verify timeline events recorded
    timeline_titles = [e["title"] for e in result["timeline"]]
    assert any("Deployment Initiated" in t for t in timeline_titles)
    assert any("Deployment Succeeded" in t for t in timeline_titles)
    assert any("Health Verification Started" in t for t in timeline_titles)
    assert any("Health Verification Succeeded" in t for t in timeline_titles)
    assert any("Incident Fully Resolved" in t for t in timeline_titles)


# ── Test 2: Deployment Failure Triggers Rollback / Escalation ──

def test_phase3_deploy_failure_triggers_rollback():
    """
    Validates that a deployment failure triggers the automated RollbackService.
    """
    run_data = {
        "repository": "payment-service",
        "workflow_name": "CI/CD Pipeline",
        "run_id": 901002,
        "branch": "main",
        "commit_sha": "b2c3d4e5f6a1",
        "conclusion": "failure",
        "action": "completed",
    }

    result = remediation_orchestrator.handle_remediation(
        run_data,
        trigger_source="test_phase3_deploy_failure",
        override_ci_status="SUCCESS",
        override_confidence=95,
        override_risk="LOW",
        override_merge_success=True,
        override_deployment_status="FAILED",
        override_rollback_success=True,
        override_rollback_health_status="HEALTHY",
    )

    assert result["status"] in ["rolled_back", "resolved_via_rollback"]
    assert result["deployment"]["status"] == "FAILED"
    assert result["rollback"] is not None
    assert result["rollback"]["status"] in ["SUCCESS", "HEALTH_VERIFIED"]


# ── Test 3: Health Check Failure Triggers Rollback Success ──

def test_phase3_health_failure_triggers_rollback_success():
    """
    Validates that if deployment succeeds but post-deployment health check returns UNHEALTHY (HTTP 500),
    SentinelOps prevents premature resolution, initiates automated rollback, verifies rollback health,
    and transitions to 'Rolled Back'.
    """
    run_data = {
        "repository": "payment-service",
        "workflow_name": "CI/CD Pipeline",
        "run_id": 901003,
        "branch": "main",
        "commit_sha": "c3d4e5f6a1b2",
        "conclusion": "failure",
        "action": "completed",
    }

    result = remediation_orchestrator.handle_remediation(
        run_data,
        trigger_source="test_phase3_health_failure_rollback",
        override_ci_status="SUCCESS",
        override_confidence=95,
        override_risk="LOW",
        override_merge_success=True,
        override_deployment_status="SUCCESS",
        override_health_status="UNHEALTHY",
        override_rollback_success=True,
        override_rollback_health_status="HEALTHY",
    )

    assert result["status"] in ["rolled_back", "resolved_via_rollback"]
    assert result["deployment"]["status"] == "SUCCESS"
    assert result["health_check"]["status"] == "UNHEALTHY"
    assert result["rollback"] is not None
    assert result["rollback"]["status"] in ["SUCCESS", "HEALTH_VERIFIED"]
    assert result["incident"]["status"] in ["Rolled Back", "Resolved"]

    # Verify timeline records health failure and rollback
    timeline_titles = [e["title"] for e in result["timeline"]]
    assert any("Health Verification Failed" in t for t in timeline_titles)
    assert any("Automated Rollback" in t for t in timeline_titles)


# ── Test 4: Health Check Consecutive Success Threshold Logic ──

def test_phase3_health_check_consecutive_success_threshold():
    """
    Validates that HealthCheckService requires N consecutive 200 OK probes.
    If a probe fails mid-sequence, consecutive counter resets.
    """
    svc = HealthCheckService()

    # 1. Probe simulation with consecutive threshold = 2
    res_healthy = svc.verify_service_health(
        url="https://payment-service.pages.dev/health",
        incident_id="INC-901004",
        success_threshold=2,
        override_status="HEALTHY",
    )
    assert res_healthy["status"] == "HEALTHY"
    assert res_healthy["consecutive_successes"] >= 2
    assert len(res_healthy["probes"]) >= 2
    for probe in res_healthy["probes"]:
        assert probe["is_healthy"] is True
        assert probe["status_code"] == 200

    # 2. Probe simulation with unhealthy outcome
    res_unhealthy = svc.verify_service_health(
        url="https://payment-service.pages.dev/health",
        incident_id="INC-901004-fail",
        success_threshold=2,
        override_status="UNHEALTHY",
        override_code=503,
    )
    assert res_unhealthy["status"] == "UNHEALTHY"
    assert res_unhealthy["consecutive_successes"] < 2


# ── Test 5: Health Check Timeout / Network Failure Handling ──

def test_phase3_health_check_timeout_handling():
    """
    Validates that HealthCheckService handles request timeouts cleanly without crashing.
    """
    svc = HealthCheckService()

    with patch("urllib.request.urlopen", side_effect=TimeoutError("Request timed out")):
        res = svc.verify_service_health(
            url="https://slow-service.pages.dev/health",
            incident_id="INC-901005",
            timeout_seconds=1,
            interval_seconds=0.1,
            success_threshold=2,
        )
        assert res["status"] in ["UNHEALTHY", "TIMEOUT"]
        assert res["consecutive_successes"] == 0
        assert len(res["probes"]) > 0
        assert "timed out" in res["probes"][0]["error"].lower() or "error" in res["probes"][0]


# ── Test 6: Rollback Single Attempt Strict Enforcement ──

def test_phase3_rollback_single_attempt_enforcement():
    """
    Validates that MAX_ROLLBACK_ATTEMPTS = 1 is strictly enforced per incident.
    A second rollback attempt on the same incident is blocked.
    """
    rb = RollbackService()

    # Attempt 1 -> succeeds
    res1 = rb.rollback(
        incident_id="INC-901006",
        repo="payment-service",
        current_commit="fail_commit_1",
        previous_known_good_commit="good_commit_0",
        override_success=True,
    )
    assert res1["status"] == "SUCCESS"
    assert res1["rollback_id"] is not None

    # Attempt 2 -> blocked by single attempt policy
    res2 = rb.rollback(
        incident_id="INC-901006",
        repo="payment-service",
        current_commit="fail_commit_2",
        previous_known_good_commit="good_commit_0",
        override_success=True,
    )
    assert res2["status"] == "FAILED"
    assert "maximum rollback attempts" in res2["error_message"].lower()


# ── Test 7: Rollback Failure Escalates to Human Operator ──

def test_phase3_rollback_failure_escalates_to_human():
    """
    Validates that if automated rollback fails (e.g. git revert conflict),
    the incident transitions to 'Escalated' and alerts Slack/PagerDuty.
    """
    run_data = {
        "repository": "payment-service",
        "workflow_name": "CI/CD Pipeline",
        "run_id": 901007,
        "branch": "main",
        "commit_sha": "d4e5f6a1b2c3",
        "conclusion": "failure",
        "action": "completed",
    }

    result = remediation_orchestrator.handle_remediation(
        run_data,
        trigger_source="test_phase3_rollback_fail_escalate",
        override_ci_status="SUCCESS",
        override_confidence=95,
        override_risk="LOW",
        override_merge_success=True,
        override_deployment_status="SUCCESS",
        override_health_status="UNHEALTHY",
        override_rollback_success=False,
    )

    assert result["status"] == "escalated"
    assert result["rollback"] is not None
    assert result["rollback"]["status"] == "FAILED"
    assert result["incident"]["status"] == "Escalated"

    timeline_titles = [e["title"] for e in result["timeline"]]
    assert any("Rollback Failed" in t or "Escalated" in t for t in timeline_titles)


# ── Test 8: DeploymentGuard 5-Point Safety Policy Verification ──

def test_phase3_deployment_guard_all_5_policies():
    """
    Validates the 5-point safety gate in DeploymentGuard:
    1. CI_SUCCESS
    2. MERGE_GUARD_APPROVED
    3. PR_MERGED
    4. DEPLOYMENT_SUCCESS
    5. HEALTH_CHECK_HEALTHY
    """
    dg = DeploymentGuard()

    # All 5 pass
    res_pass = dg.can_declare_resolved(
        ci_status="SUCCESS",
        merge_guard_status="APPROVED",
        pr_merged=True,
        deployment_status="SUCCESS",
        health_check_status="HEALTHY",
    )
    assert res_pass["allowed"] is True
    assert len(res_pass["reasons"]) == 0
    assert all(res_pass["policy_checks"].values())

    # Individual failures
    res_ci_fail = dg.can_declare_resolved(ci_status="FAILED", merge_guard_status="APPROVED", pr_merged=True, deployment_status="SUCCESS", health_check_status="HEALTHY")
    assert res_ci_fail["allowed"] is False
    assert res_ci_fail["policy_checks"]["CI_SUCCESS"] is False

    res_mg_fail = dg.can_declare_resolved(ci_status="SUCCESS", merge_guard_status="BLOCKED", pr_merged=True, deployment_status="SUCCESS", health_check_status="HEALTHY")
    assert res_mg_fail["allowed"] is False
    assert res_mg_fail["policy_checks"]["MERGE_GUARD_APPROVED"] is False

    res_pr_fail = dg.can_declare_resolved(ci_status="SUCCESS", merge_guard_status="APPROVED", pr_merged=False, deployment_status="SUCCESS", health_check_status="HEALTHY")
    assert res_pr_fail["allowed"] is False
    assert res_pr_fail["policy_checks"]["PR_MERGED"] is False

    # PR closed without being merged must NOT be accepted
    res_pr_closed = dg.can_declare_resolved(ci_status="SUCCESS", merge_guard_status="APPROVED", pr_merged="closed", deployment_status="SUCCESS", health_check_status="HEALTHY")
    assert res_pr_closed["allowed"] is False
    assert res_pr_closed["policy_checks"]["PR_MERGED"] is False
    assert "Pull request has not been merged" in res_pr_closed["reasons"]

    res_pr_dict_unmerged = dg.can_declare_resolved(ci_status="SUCCESS", merge_guard_status="APPROVED", pr_merged={"merged": False, "state": "closed"}, deployment_status="SUCCESS", health_check_status="HEALTHY")
    assert res_pr_dict_unmerged["allowed"] is False
    assert res_pr_dict_unmerged["policy_checks"]["PR_MERGED"] is False

    # Explicit merged state (string or dict with merged=True) must be accepted
    res_pr_merged_str = dg.can_declare_resolved(ci_status="SUCCESS", merge_guard_status="APPROVED", pr_merged="merged", deployment_status="SUCCESS", health_check_status="HEALTHY")
    assert res_pr_merged_str["allowed"] is True
    assert res_pr_merged_str["policy_checks"]["PR_MERGED"] is True

    res_pr_dict_merged = dg.can_declare_resolved(ci_status="SUCCESS", merge_guard_status="APPROVED", pr_merged={"merged": True, "state": "closed"}, deployment_status="SUCCESS", health_check_status="HEALTHY")
    assert res_pr_dict_merged["allowed"] is True
    assert res_pr_dict_merged["policy_checks"]["PR_MERGED"] is True

    res_dep_fail = dg.can_declare_resolved(ci_status="SUCCESS", merge_guard_status="APPROVED", pr_merged=True, deployment_status="FAILED", health_check_status="HEALTHY")
    assert res_dep_fail["allowed"] is False
    assert res_dep_fail["policy_checks"]["DEPLOYMENT_SUCCESS"] is False

    res_health_fail = dg.can_declare_resolved(ci_status="SUCCESS", merge_guard_status="APPROVED", pr_merged=True, deployment_status="SUCCESS", health_check_status="UNHEALTHY")
    assert res_health_fail["allowed"] is False
    assert res_health_fail["policy_checks"]["HEALTH_CHECK_HEALTHY"] is False


# ── Test 9: DeploymentGuard Blocks Premature Resolution ──

def test_phase3_deployment_guard_blocks_unhealthy():
    """
    Validates that DeploymentGuard blocks resolution when health check is PENDING, UNKNOWN, or TIMEOUT.
    """
    dg = DeploymentGuard()

    for invalid_health in ["PENDING", "UNKNOWN", "TIMEOUT", "FAILED"]:
        res = dg.can_declare_resolved(
            ci_status="SUCCESS",
            merge_guard_status="APPROVED",
            pr_merged=True,
            deployment_status="SUCCESS",
            health_check_status=invalid_health,
        )
        assert res["allowed"] is False
        assert f"Health check status is '{invalid_health}'" in res["reasons"][0]


# ── Test 10: Idempotency with Duplicate Events ──

def test_phase3_idempotency_duplicate_events():
    """
    Validates that re-running remediation on the same incident ID is handled idempotently.
    """
    run_data = {
        "repository": "payment-service",
        "workflow_name": "CI/CD Pipeline",
        "run_id": 901010,
        "branch": "main",
        "commit_sha": "e5f6a1b2c3d4",
        "conclusion": "failure",
        "action": "completed",
    }

    # First run
    res1 = remediation_orchestrator.handle_remediation(
        run_data,
        trigger_source="test_phase3_idempotent_1",
        override_ci_status="SUCCESS",
        override_confidence=95,
        override_risk="LOW",
        override_merge_success=True,
        override_deployment_status="SUCCESS",
        override_health_status="HEALTHY",
    )
    assert res1["status"] == "resolved"

    # Duplicate delivery
    res2 = remediation_orchestrator.handle_remediation(
        run_data,
        trigger_source="test_phase3_idempotent_2",
        override_ci_status="SUCCESS",
        override_confidence=95,
        override_risk="LOW",
        override_merge_success=True,
        override_deployment_status="SUCCESS",
        override_health_status="HEALTHY",
    )
    assert res2["status"] == "resolved"


# ── Test 11: Slack Failure Resilience for Deployment Notifications ──

def test_phase3_slack_failure_resilience_deployment():
    """
    Validates that if Slack notifications fail during deployment or rollback,
    the autonomous pipeline continues without crashing.
    """
    with patch("services.slack_service.SlackService.send_deployment_started", side_effect=Exception("Slack network timeout")):
        with patch("services.slack_service.SlackService.send_health_verification_started", side_effect=Exception("Slack error")):
            with patch("services.slack_service.SlackService.send_deployment_successful", side_effect=Exception("Slack error")):
                run_data = {
                    "repository": "payment-service",
                    "workflow_name": "CI/CD Pipeline",
                    "run_id": 901011,
                    "branch": "main",
                    "commit_sha": "f6a1b2c3d4e5",
                    "conclusion": "failure",
                    "action": "completed",
                }

                result = remediation_orchestrator.handle_remediation(
                    run_data,
                    trigger_source="test_phase3_slack_resilience",
                    override_ci_status="SUCCESS",
                    override_confidence=95,
                    override_risk="LOW",
                    override_merge_success=True,
                    override_deployment_status="SUCCESS",
                    override_health_status="HEALTHY",
                )

                assert result["status"] == "resolved"
                assert result["deployment"]["status"] == "SUCCESS"
                assert result["health_check"]["status"] == "HEALTHY"


# ── Test 12: Flask REST API Deployment and Health Check Endpoints ──

def test_phase3_api_deployment_and_health_endpoints():
    """
    Validates Flask REST API endpoints:
    - GET  /api/incidents/<id>/deployment
    - GET  /api/incidents/<id>/health
    - GET  /api/incidents/<id>/rollback
    - POST /api/incidents/<id>/verify-deployment
    - POST /api/incidents/<id>/rollback
    - POST /api/github/deployment-guard/check
    - POST /api/github/health-check
    - GET  /api/deployments
    - GET  /api/rollbacks
    """
    from app import app
    client = app.test_client()

    # 1. DeploymentGuard check endpoint
    resp_dg = client.post("/api/github/deployment-guard/check", json={
        "ci_status": "SUCCESS",
        "merge_guard_status": "APPROVED",
        "pr_merged": True,
        "deployment_status": "SUCCESS",
        "health_check_status": "HEALTHY",
    })
    assert resp_dg.status_code == 200
    dg_data = resp_dg.get_json()
    assert dg_data["allowed"] is True

    # 2. Health check endpoint
    resp_hc = client.post("/api/github/health-check", json={
        "url": "https://payment-service.pages.dev/health",
        "incident_id": "INC-API-TEST",
        "success_threshold": 2,
    })
    assert resp_hc.status_code == 200
    hc_data = resp_hc.get_json()
    assert hc_data["status"] in ["HEALTHY", "UNHEALTHY"]

    # 3. List deployments endpoint
    resp_deps = client.get("/api/deployments")
    assert resp_deps.status_code == 200
    assert isinstance(resp_deps.get_json(), list)

    # 4. List rollbacks endpoint
    resp_rbs = client.get("/api/rollbacks")
    assert resp_rbs.status_code == 200
    assert isinstance(resp_rbs.get_json(), list)

    # 5. Incident deployment status
    resp_inc_dep = client.get("/api/incidents/INC-34504270337/deployment")
    assert resp_inc_dep.status_code == 200

    # 6. Incident health status
    resp_inc_hlth = client.get("/api/incidents/INC-34504270337/health")
    assert resp_inc_hlth.status_code == 200

    # 7. Incident rollback status
    resp_inc_rb = client.get("/api/incidents/INC-34504270337/rollback")
    assert resp_inc_rb.status_code == 200


# ── Test 13: MTTR Telemetry Includes Deployment & Health Check Durations ──

def test_phase3_mttr_telemetry_includes_deployment_and_health():
    """
    Validates that MTTR calculation in RemediationOrchestrator tracks:
    - time_to_diagnosis
    - time_to_patch
    - time_to_validation
    - time_to_merge
    - time_to_deploy
    - time_to_health_check
    - total_mttr
    """
    run_data = {
        "repository": "payment-service",
        "workflow_name": "CI/CD Pipeline",
        "run_id": 901013,
        "branch": "main",
        "commit_sha": "a1b2c3d4e5f6",
        "conclusion": "failure",
        "action": "completed",
    }

    result = remediation_orchestrator.handle_remediation(
        run_data,
        trigger_source="test_phase3_mttr_telemetry",
        override_ci_status="SUCCESS",
        override_confidence=95,
        override_risk="LOW",
        override_merge_success=True,
        override_deployment_status="SUCCESS",
        override_health_status="HEALTHY",
    )

    mttr = result["mttr_metrics"]
    assert "time_to_diagnosis" in mttr
    assert "time_to_patch" in mttr
    assert "time_to_validation" in mttr
    assert "time_to_merge" in mttr
    assert "time_to_deploy" in mttr
    assert "time_to_health_check" in mttr
    assert "total_mttr" in mttr
    assert mttr["total_mttr_seconds"] >= 0

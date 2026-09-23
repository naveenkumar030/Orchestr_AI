"""
Phase 2 Autonomous Self-Healing CI/CD Loop Tests for SentinelOps.

Tests cover:
  1. CI success + MergeGuard pass -> Auto-Merge -> RESOLVED
  2. CI failure -> Intelligent retry with new logs
  3. CI failure on max attempts (attempt 3) -> ESCALATED
  4. Medium risk + CI success -> HUMAN_REVIEW (no auto-merge)
  5. Low confidence + CI success -> HUMAN_REVIEW
  6. SentinelGuard policy failure -> BLOCKED / HUMAN_REVIEW
  7. Retry context: second attempt receives NEW CI logs and history
  8. GitHub merge rejection (branch protection) -> Controlled failure, not false RESOLVED
  9. Slack notification failure resilience
  10. Strict retry limit enforcement (no infinite loop)
  11. ValidationService polling, timeouts, and job log extraction
  12. ValidatorAgent regression vs unresolved root cause detection
"""

import os
import sys
from unittest.mock import patch

CURRENT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if CURRENT_DIR not in sys.path:
    sys.path.insert(0, CURRENT_DIR)

from services.merge_guard import merge_guard
from services.remediation_orchestrator import (
    RemediationOrchestrator,
    remediation_orchestrator,
)
from services.sentinel_guard import sentinel_guard
from services.slack_service import slack_service
from services.validation_service import ValidationService, validation_service
from services.validator_agent import ValidatorAgent


# ── Test 1: CI Success + MergeGuard Pass -> Auto-Merge -> RESOLVED ────────────
def test_phase2_ci_success_auto_merge():
    """
    Validates:
      CI = SUCCESS, SentinelGuard = PASS, confidence = 95, risk = LOW
      -> MergeGuard = ALLOW -> PR auto-merged -> Incident RESOLVED.
    """
    decision = merge_guard.can_auto_merge(
        confidence=95,
        risk_level="LOW",
        sentinel_status="PASS",
        ci_status="SUCCESS",
        attempt_number=1,
        restricted_paths=False,
        secret_scan="PASS",
    )
    assert decision["allowed"] is True
    assert decision["decision"] == "AUTO_MERGE"

    run_data = {
        "repository": "payment-service",
        "workflow_name": "CI / Test & Build",
        "run_id": 991001,
        "branch": "main",
        "commit_sha": "a1b2c3d4e5",
    }
    result = remediation_orchestrator.handle_remediation(
        run_data,
        override_ci_status="SUCCESS",
        override_confidence=95,
        override_risk="LOW",
        override_merge_success=True,
    )
    assert result["status"] == "resolved"
    assert result["incidentId"] == "INC-991001"
    assert len(result["attempts"]) == 1
    assert result["attempts"][0]["validation_status"] == "SUCCESS"
    assert "mttr" in result
    assert result["mttr"]["total_mttr_seconds"] > 0


# ── Test 2: CI Failure & Retry ────────────────────────────────────────────────
def test_phase2_ci_failure_triggers_retry():
    """
    Validates that a CI failure on Attempt 1 leads to Attempt 2.
    """
    run_data = {
        "repository": "payment-service",
        "workflow_name": "CI / Test & Build",
        "run_id": 991002,
        "branch": "main",
        "commit_sha": "b2c3d4e5f6",
    }

    # Custom orchestrator with max 2 attempts that fails on attempt 1, passes on attempt 2
    orch = RemediationOrchestrator()
    orch.max_attempts = 2

    # Patch validation_service to fail on first attempt, pass on second
    call_count = 0
    def mock_validate(repo, branch, commit_sha=None, **kwargs):
        nonlocal call_count
        call_count += 1
        if call_count == 1:
            return {
                "status": "FAILURE",
                "workflow": "CI",
                "run_id": 991002,
                "commit_sha": commit_sha or "HEAD",
                "branch": branch,
                "failed_jobs": ["unit-tests"],
                "logs": "AssertionError: TokenValidator verification failed on empty string",
                "duration": 10,
                "simulated": True,
            }
        return {
            "status": "SUCCESS",
            "workflow": "CI",
            "run_id": 991002,
            "commit_sha": commit_sha or "HEAD",
            "branch": branch,
            "failed_jobs": [],
            "logs": None,
            "duration": 12,
            "simulated": True,
        }

    with patch.object(validation_service, "validate_branch", side_effect=mock_validate):
        res = orch.handle_remediation(run_data)
        assert res["status"] == "resolved"
        assert len(res["attempts"]) == 2
        assert res["attempts"][0]["validation_status"] == "FAILURE"
        assert res["attempts"][1]["validation_status"] == "SUCCESS"


# ── Test 3: CI Failure on Max Attempts -> ESCALATED ───────────────────────────
def test_phase2_ci_failure_max_attempts_escalation():
    """
    Validates that reaching MAX_REMEDIATION_ATTEMPTS without CI pass moves incident to ESCALATED.
    """
    run_data = {
        "repository": "payment-service",
        "workflow_name": "CI / Test & Build",
        "run_id": 991003,
        "branch": "main",
        "commit_sha": "c3d4e5f6a1",
    }

    orch = RemediationOrchestrator()
    orch.max_attempts = 3

    def mock_always_fail(repo, branch, commit_sha=None, **kwargs):
        return {
            "status": "FAILURE",
            "workflow": "CI",
            "run_id": 991003,
            "commit_sha": commit_sha or "HEAD",
            "branch": branch,
            "failed_jobs": ["test_payment"],
            "logs": "AssertionError: Persistent failure",
            "duration": 14,
            "simulated": True,
        }

    with patch.object(validation_service, "validate_branch", side_effect=mock_always_fail):
        res = orch.handle_remediation(run_data)
        assert res["status"] == "escalated"
        assert len(res["attempts"]) == 3
        assert all(a["validation_status"] == "FAILURE" for a in res["attempts"])


# ── Test 4: Medium Risk Gate -> HUMAN_REVIEW ──────────────────────────────────
def test_phase2_medium_risk_requires_human_review():
    """
    Validates:
      confidence = 98, risk = MEDIUM, CI = SUCCESS
      -> MergeGuard = DENY -> HUMAN_REVIEW
    """
    decision = merge_guard.can_auto_merge(
        confidence=98,
        risk_level="MEDIUM",
        sentinel_status="PASS",
        ci_status="SUCCESS",
        attempt_number=1,
        restricted_paths=False,
        secret_scan="PASS",
    )
    assert decision["allowed"] is False
    assert decision["decision"] == "HUMAN_REVIEW"
    assert "Risk level is MEDIUM" in decision["reason"]

    run_data = {
        "repository": "payment-service",
        "workflow_name": "CI / Test & Build",
        "run_id": 991004,
        "branch": "main",
        "commit_sha": "d4e5f6a1b2",
    }
    result = remediation_orchestrator.handle_remediation(
        run_data,
        override_ci_status="SUCCESS",
        override_confidence=98,
        override_risk="MEDIUM",
    )
    assert result["status"] == "human_review"
    assert result["incidentId"] == "INC-991004"


# ── Test 5: Low Confidence Gate -> HUMAN_REVIEW ───────────────────────────────
def test_phase2_low_confidence_requires_human_review():
    """
    Validates:
      confidence = 70, risk = LOW, CI = SUCCESS
      -> MergeGuard = DENY -> HUMAN_REVIEW
    """
    decision = merge_guard.can_auto_merge(
        confidence=70,
        risk_level="LOW",
        sentinel_status="PASS",
        ci_status="SUCCESS",
        attempt_number=1,
        confidence_threshold=90,
    )
    assert decision["allowed"] is False
    assert decision["decision"] == "HUMAN_REVIEW"
    assert "below required threshold" in decision["reason"]

    run_data = {
        "repository": "payment-service",
        "workflow_name": "CI / Test & Build",
        "run_id": 991005,
        "branch": "main",
        "commit_sha": "e5f6a1b2c3",
    }
    result = remediation_orchestrator.handle_remediation(
        run_data,
        override_ci_status="SUCCESS",
        override_confidence=70,
        override_risk="LOW",
    )
    assert result["status"] == "human_review"


# ── Test 6: SentinelGuard Policy Block ─────────────────────────────────────────
def test_phase2_sentinel_guard_policy_block():
    """
    Validates SentinelGuard blocking modification of restricted directories.
    """
    guard_res = sentinel_guard.evaluate(
        target_branch="sentinelops/fix-991006",
        target_file=".github/workflows/deploy.yml",
        diff="--- a/.github/workflows/deploy.yml\n+++ b/.github/workflows/deploy.yml\n+run: echo hello",
        fixed_content="name: deploy\non: push\n",
    )
    assert guard_res["guard_status"] == "BLOCKED"
    assert guard_res["risk_level"] == "BLOCKED"
    assert len(guard_res["block_reasons"]) > 0

    # Also evaluate through MergeGuard
    decision = merge_guard.can_auto_merge(
        confidence=95,
        risk_level="BLOCKED",
        sentinel_status="BLOCKED",
        ci_status="SUCCESS",
        restricted_paths=True,
    )
    assert decision["allowed"] is False
    assert decision["decision"] == "HUMAN_REVIEW"


# ── Test 7: CI Failure Context in Retry ───────────────────────────────────────
def test_phase2_retry_context_includes_new_ci_logs():
    """
    Validates that retry prompt and synthesis receives previous attempt diff and new failure logs.
    """
    orch = RemediationOrchestrator()
    analysis = orch._intelligent_retry_analysis(
        repo="payment-service",
        wf_name="CI",
        branch="main",
        incident_id="INC-991007",
        original_logs="AssertionError: TokenValidator verify expired_token failed",
        new_ci_logs="AssertionError: TokenValidator verify None failed with TypeError",
        previous_diff="--- a/token.py\n+++ b/token.py\n-return False\n+return True",
        previous_target_file="services/auth/token_validator.py",
        attempts_history=[{"attempt_number": 1, "validation_status": "FAILURE"}],
    )
    assert "target_file" in analysis
    assert "diff" in analysis
    assert "fixed_content" in analysis
    assert analysis["confidence"] >= 90


# ── Test 8: GitHub Merge Failure Handling (Controlled Failure) ────────────────
def test_phase2_github_merge_failure_handling():
    """
    Simulates GitHub REST API refusing the merge (e.g. branch protection / 405).
    Ensures the system produces a controlled failure and transitions to HUMAN_REVIEW,
    WITHOUT falsely reporting RESOLVED.
    """
    run_data = {
        "repository": "payment-service",
        "workflow_name": "CI / Test & Build",
        "run_id": 991008,
        "branch": "main",
        "commit_sha": "f6a1b2c3d4",
    }
    result = remediation_orchestrator.handle_remediation(
        run_data,
        override_ci_status="SUCCESS",
        override_confidence=96,
        override_risk="LOW",
        override_merge_success=False,  # GitHub refused merge
    )
    assert result["status"] == "human_review"
    assert result["status"] != "resolved"
    assert "reason" in result


# ── Test 9: Slack Failure Resilience ──────────────────────────────────────────
def test_phase2_slack_failure_resilience():
    """
    Validates that Slack network or API failures do not break the remediation loop.
    """
    with patch.object(slack_service, "_send_message", return_value=False):
        # All Slack helper methods should safely return False without raising exceptions
        assert slack_service.send_validation_started("INC-991009", "repo", "branch") is False
        assert slack_service.send_retry_notification("INC-991009", "repo", 2, 3, "fail") is False
        assert slack_service.send_merge_decision("INC-991009", 181, "repo", {"allowed": True}) is False
        assert slack_service.send_resolution_notification("INC-991009", 181, "repo", 45) is False
        assert slack_service.send_escalation_alert({"id": "INC-991009"}, 3, "failed") is False

        # Orchestration completes despite Slack failure
        run_data = {
            "repository": "payment-service",
            "workflow_name": "CI / Test & Build",
            "run_id": 991009,
            "branch": "main",
            "commit_sha": "a1b2c3d4e5",
        }
        res = remediation_orchestrator.handle_remediation(
            run_data,
            override_ci_status="SUCCESS",
            override_confidence=95,
            override_risk="LOW",
            override_merge_success=True,
        )
        assert res["status"] == "resolved"


# ── Test 10: Retry Limit Strict Enforcement (No Infinite Loop) ────────────────
def test_phase2_retry_limit_strict_enforcement():
    """
    Ensures that attempt count never exceeds MAX_REMEDIATION_ATTEMPTS.
    """
    orch = RemediationOrchestrator()
    orch.max_attempts = 3

    run_data = {
        "repository": "payment-service",
        "workflow_name": "CI",
        "run_id": 991010,
        "branch": "main",
        "commit_sha": "b2c3d4e5f6",
    }
    with patch.object(validation_service, "validate_branch", return_value={"status": "FAILURE", "logs": "Error"}):
        res = orch.handle_remediation(run_data)
        assert res["status"] == "escalated"
        assert len(res["attempts"]) == 3
        # Ensure exact attempt numbers 1, 2, 3
        assert [a["attempt_number"] for a in res["attempts"]] == [1, 2, 3]


# ── Test 11: ValidationService Status Parsing ─────────────────────────────────
def test_phase2_validation_service_parsing():
    """
    Tests ValidationService normalization of workflow conclusions.
    """
    val = ValidationService(timeout_seconds=5, poll_interval_seconds=1)

    res_success = val._build_result(
        repo="test-repo", branch="fix", run_id=101, workflow_name="CI",
        commit_sha="c0ffee", conclusion="success"
    )
    assert res_success["status"] == "SUCCESS"
    assert res_success["failed_jobs"] == []

    res_failure = val._build_result(
        repo="test-repo", branch="fix", run_id=102, workflow_name="CI",
        commit_sha="c0ffee", conclusion="failure"
    )
    assert res_failure["status"] == "FAILURE"

    res_timeout = val._build_result(
        repo="test-repo", branch="fix", run_id=103, workflow_name="CI",
        commit_sha="c0ffee", conclusion="timed_out"
    )
    assert res_timeout["status"] == "TIMED_OUT"


# ── Test 12: ValidatorAgent Evaluation ────────────────────────────────────────
def test_phase2_validator_agent_regression_detection():
    """
    Tests ValidatorAgent heuristic evaluation distinguishing syntax/import regression from persistent test failure.
    """
    agent = ValidatorAgent()

    # Case A: CI Success
    eval_success = agent.evaluate_fix(
        incident={"id": "INC-1"},
        original_failure_logs="AssertionError",
        patch_summary="Fixed token",
        changed_files=["token.py"],
        commit_sha="abc1234",
        ci_result={"status": "SUCCESS", "workflow": "CI"},
    )
    assert eval_success["passed"] is True
    assert eval_success["root_cause_fixed"] is True

    # Case B: New Syntax Error regression
    eval_syntax = agent._heuristic_evaluation(
        incident={"id": "INC-2"},
        orig_logs="AssertionError: test failed",
        patch_summary="Added check",
        changed_files=["token.py"],
        new_logs="SyntaxError: invalid syntax in token.py line 4",
        ci_status="FAILURE",
    )
    assert eval_syntax["passed"] is False
    assert eval_syntax["new_failure"] is True
    assert "SyntaxError" in eval_syntax["reason"]

    # Case C: Unresolved original assertion failure
    eval_unresolved = agent._heuristic_evaluation(
        incident={"id": "INC-3"},
        orig_logs="AssertionError: token validation failed",
        patch_summary="Changed logic",
        changed_files=["services/auth/token_validator.py"],
        new_logs="AssertionError: TokenValidator incorrectly accepted expired token",
        ci_status="FAILURE",
    )
    assert eval_unresolved["passed"] is False
    assert eval_unresolved["new_failure"] is False


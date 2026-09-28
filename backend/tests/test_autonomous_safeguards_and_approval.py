"""
Tests for Autonomous Safeguards, Approval Gates, and Exception Handling.
Validates:
1. Production defaults for AUTO_MERGE_ENABLED (disabled by default in production).
2. MergeGuard enforcement of AUTO_MERGE_ENABLED and approval_status gates.
3. Server-side rejection of merges when approval state is pending, rejected, or missing under strict policies.
4. MongoService structured exception handling and connection recovery logic.
5. Error recovery paths during autonomous remediation.
"""

import os
import pytest
from unittest.mock import patch, MagicMock

import config
from services.merge_guard import MergeGuard
from services.mongo_service import MongoService, PYMONGO_AVAILABLE


# ── 1. Production Defaults for AUTO_MERGE_ENABLED ─────────────────────────────

def test_auto_merge_disabled_by_default_in_production():
    """In production mode with no override, auto-merge must strictly default to False."""
    with patch.dict(os.environ, {}, clear=True):
        res_prod = config._resolve_auto_merge_enabled(is_production=True)
        assert res_prod is False

        res_dev = config._resolve_auto_merge_enabled(is_production=False)
        assert res_dev is True


def test_auto_merge_explicit_enablement_in_production():
    """Setting AUTO_MERGE_ENABLED=true explicitly enables auto-merge even in production."""
    with patch.dict(os.environ, {"AUTO_MERGE_ENABLED": "true"}):
        res = config._resolve_auto_merge_enabled(is_production=True)
        assert res is True

    with patch.dict(os.environ, {"AUTO_MERGE_ENABLED": "False"}):
        res = config._resolve_auto_merge_enabled(is_production=False)
        assert res is False


# ── 2. MergeGuard Safeguards & Approval Gates ─────────────────────────────────

def test_merge_guard_blocks_when_auto_merge_disabled():
    """MergeGuard must fail closed to HUMAN_REVIEW when auto-merge is disabled."""
    mg = MergeGuard()
    res = mg.can_auto_merge(
        confidence=98,
        risk_level="LOW",
        sentinel_status="PASS",
        ci_status="SUCCESS",
        attempt_number=1,
        restricted_paths=False,
        secret_scan="PASS",
        auto_merge_enabled=False,
    )
    assert res["allowed"] is False
    assert res["decision"] == "HUMAN_REVIEW"
    assert res["checks"]["auto_merge_enabled"] is False
    assert any("AUTO_MERGE_ENABLED=False" in c for c in res["failed_conditions"])


def test_merge_guard_blocks_when_approval_status_pending():
    """MergeGuard must reject autonomous merge when approval status is pending_review."""
    mg = MergeGuard()
    res = mg.can_auto_merge(
        confidence=98,
        risk_level="LOW",
        sentinel_status="PASS",
        ci_status="SUCCESS",
        attempt_number=1,
        restricted_paths=False,
        secret_scan="PASS",
        auto_merge_enabled=True,
        approval_status="pending_review",
    )
    assert res["allowed"] is False
    assert res["decision"] == "HUMAN_REVIEW"
    assert res["checks"]["approval_status_valid"] is False
    assert any("Approval gate not satisfied" in c for c in res["failed_conditions"])


def test_merge_guard_blocks_when_approval_status_rejected():
    """MergeGuard must reject autonomous merge when approval status is auto_rejected or rejected_by_human."""
    mg = MergeGuard()
    for rejected_state in ["rejected", "auto_rejected", "rejected_by_human", "expired"]:
        res = mg.can_auto_merge(
            confidence=98,
            risk_level="LOW",
            sentinel_status="PASS",
            ci_status="SUCCESS",
            attempt_number=1,
            restricted_paths=False,
            secret_scan="PASS",
            auto_merge_enabled=True,
            approval_status=rejected_state,
        )
        assert res["allowed"] is False
        assert res["decision"] == "HUMAN_REVIEW"
        assert res["checks"]["approval_status_valid"] is False


def test_merge_guard_allows_when_approved_by_human():
    """MergeGuard permits merge when operator human approval has been granted."""
    mg = MergeGuard()
    res = mg.can_auto_merge(
        confidence=98,
        risk_level="LOW",
        sentinel_status="PASS",
        ci_status="SUCCESS",
        attempt_number=1,
        restricted_paths=False,
        secret_scan="PASS",
        auto_merge_enabled=True,
        approval_status="approved_by_human",
    )
    assert res["allowed"] is True
    assert res["decision"] == "AUTO_MERGE"
    assert res["checks"]["approval_status_valid"] is True


def test_merge_guard_allows_when_auto_approved():
    """MergeGuard permits merge when auto-approval policy condition is met."""
    mg = MergeGuard()
    res = mg.can_auto_merge(
        confidence=98,
        risk_level="LOW",
        sentinel_status="PASS",
        ci_status="SUCCESS",
        attempt_number=1,
        restricted_paths=False,
        secret_scan="PASS",
        auto_merge_enabled=True,
        approval_status="auto_approved",
    )
    assert res["allowed"] is True
    assert res["decision"] == "AUTO_MERGE"
    assert res["checks"]["approval_status_valid"] is True


# ── 3. MongoService Exception Handling & Resilience ───────────────────────────

def test_mongo_service_handles_transient_connection_failure():
    """Transient network/timeout exceptions should cleanly reset _is_connected without crashing."""
    service = MongoService(uri=None)
    service._is_connected = True

    try:
        from pymongo.errors import ServerSelectionTimeoutError
        timeout_err = ServerSelectionTimeoutError("Server selection timed out after 8000 ms")
    except ImportError:
        timeout_err = Exception("Server selection timed out")

    service._handle_mongo_error("test_query", timeout_err, "incident-123")
    assert service._is_connected is False


def test_mongo_service_handles_unexpected_error_without_raising():
    """Unexpected non-pymongo errors are logged as errors without raising unhandled exceptions."""
    service = MongoService(uri=None)
    unexpected = TypeError("unsupported operand type(s) for +: 'int' and 'str'")
    # Should not raise
    service._handle_mongo_error("test_op", unexpected, "ctx")


# ── 4. Remediation Orchestrator Merge Authorization ───────────────────────────

def test_remediation_orchestrator_respects_auto_merge_disabled():
    """When auto-merge is disabled in kwargs, remediation orchestrator must not auto-merge PR."""
    from services.remediation_orchestrator import remediation_orchestrator

    run_data = {
        "repository": "SentinelOps",
        "run_id": 992001,
        "workflow_name": "CI / Test & Build",
        "branch": "main",
        "head_sha": "a1b2c3d4e5f6",
        "failure_logs": "AssertionError: token invalid",
    }

    result = remediation_orchestrator.handle_remediation(
        run_data=run_data,
        auto_merge_enabled=False,
        override_ci_status="SUCCESS",
        override_ci_logs="All 5 tests passed cleanly",
        override_confidence=95,
        override_risk="LOW",
    )

    # Status must be awaiting review or not auto-merged
    assert result.get("status") in ["awaiting_review", "resolved", "failed", "blocked"]
    if result.get("mergeDecision"):
        assert result["mergeDecision"]["allowed"] is False
        assert result["mergeDecision"]["decision"] == "HUMAN_REVIEW"


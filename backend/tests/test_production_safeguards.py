"""
Tests for Production Safeguards across Autonomous Remediation, MergeGuard, and DeploymentGuard.
Validates:
1. Input boundary verification (exact repo, branch, commit; path traversal rejection; protected branch protection).
2. Malformed / untrusted patch rejection (ast.parse syntax check, traversal, destructive commands).
3. Least-privilege GitHub token scope enforcement.
4. Independent CI verification requirement before merge.
5. Rollback success rejection when inferred from status string alone without verified evidence.
6. Merge and deployment action idempotency and structured audit trails.
"""

import pytest

from services.deployment_guard import DeploymentGuard, deployment_guard
from services.merge_guard import MergeGuard, merge_guard
from services.remediation_orchestrator import RemediationOrchestrator, remediation_orchestrator


# ── Test Suite 1: MergeGuard Production Safeguards ────────────────────────────

def test_merge_guard_rejects_unverified_ci():
    """MergeGuard must fail closed when CI verification is not independent/confirmed."""
    mg = MergeGuard()
    res = mg.can_auto_merge(
        confidence=98,
        risk_level="LOW",
        sentinel_status="PASSED",
        ci_status="SUCCESS",
        attempt_number=1,
        restricted_paths=False,
        secret_scan="PASS",
        ci_verified=False,  # Unverified CI
    )
    assert res["allowed"] is False
    assert res["checks"]["ci_independently_verified"] is False
    assert any("Independent CI verification" in r for r in res["failed_conditions"])
    assert "audit_id" in res
    assert res["policy_version"] == "v2.5.0"


def test_merge_guard_rejects_unauthorized_token():
    """MergeGuard must fail closed when least-privilege token verification fails."""
    mg = MergeGuard()
    res = mg.can_auto_merge(
        confidence=98,
        risk_level="LOW",
        sentinel_status="PASSED",
        ci_status="SUCCESS",
        attempt_number=1,
        restricted_paths=False,
        secret_scan="PASS",
        ci_verified=True,
        token_scope_ok=False,  # Unauthorized token
    )
    assert res["allowed"] is False
    assert res["checks"]["token_scope_authorized"] is False
    assert any("least-privilege" in r for r in res["failed_conditions"])


def test_merge_guard_idempotency_cache():
    """MergeGuard returns cached idempotent decision for the same repo, PR, and commit."""
    mg = MergeGuard()
    repo = "test-org/repo-safeguard"
    pr = 101
    commit = "a1b2c3d"

    res1 = mg.can_auto_merge(
        confidence=98,
        risk_level="LOW",
        sentinel_status="PASSED",
        ci_status="SUCCESS",
        attempt_number=1,
        restricted_paths=False,
        secret_scan="PASS",
        ci_verified=True,
        token_scope_ok=True,
        repo=repo,
        pr_number=pr,
        commit_sha=commit,
    )
    assert res1["allowed"] is True

    # Subsequent call with same coordinates should hit idempotency cache
    res2 = mg.can_auto_merge(
        confidence=98,
        risk_level="LOW",
        sentinel_status="PASSED",
        ci_status="SUCCESS",
        attempt_number=1,
        restricted_paths=False,
        secret_scan="PASS",
        ci_verified=True,
        token_scope_ok=True,
        repo=repo,
        pr_number=pr,
        commit_sha=commit,
    )
    assert res2["allowed"] is True
    assert res2.get("idempotent") is True
    assert res2["audit_id"] == res1["audit_id"]


# ── Test Suite 2: DeploymentGuard Rollback Evidence Verification ───────────────

def test_deployment_guard_rejects_status_string_alone():
    """DeploymentGuard must fail closed when rollback is asserted only as a status string without evidence."""
    dg = DeploymentGuard()
    res = dg.can_declare_resolved(
        ci_status="FAILED",
        merge_guard_status="APPROVED",
        pr_merged=True,
        deployment_status="FAILED",
        health_check_status="HEALTHY",
        rollback_status="SUCCESS",  # Raw string alone!
        rollback_record=None,
    )
    assert res["allowed"] is False
    assert res["authorized"] is False
    assert res["checks"]["rollback_evidence_verified"] is False
    assert any("status string alone" in r for r in res["reasons"])
    assert res["resolution_type"] == "RESOLUTION_BLOCKED_UNVERIFIED_ROLLBACK"


def test_deployment_guard_accepts_verified_rollback_record():
    """DeploymentGuard authorizes resolution when verifiable rollback record with verified health is supplied."""
    dg = DeploymentGuard()
    verified_record = {
        "rollback_id": "rb-12345",
        "status": "SUCCESS",
        "success": True,
        "health_verified": True,
        "health_status": "HEALTHY",
        "target_commit": "7f9a1b2",
        "attempt_number": 1,
    }
    res = dg.can_declare_resolved(
        ci_status="FAILED",
        merge_guard_status="APPROVED",
        pr_merged=True,
        deployment_status="FAILED",
        health_check_status="HEALTHY",
        rollback_record=verified_record,
    )
    assert res["allowed"] is True
    assert res["authorized"] is True
    assert res["resolution_type"] == "RESOLVED_VIA_ROLLBACK"
    assert res["checks"]["rollback_evidence_verified"] is True
    assert res["evidence"]["target_commit"] == "7f9a1b2"


def test_deployment_guard_rejects_malformed_rollback_record():
    """DeploymentGuard rejects rollback records missing valid target commit or failing health."""
    dg = DeploymentGuard()
    bad_record = {
        "rollback_id": "rb-12345",
        "status": "SUCCESS",
        "success": True,
        "health_verified": False,  # Health verification failed!
        "target_commit": "UNKNOWN",
        "attempt_number": 1,
    }
    res = dg.can_declare_resolved(
        ci_status="FAILED",
        merge_guard_status="APPROVED",
        pr_merged=True,
        deployment_status="FAILED",
        health_check_status="UNHEALTHY",
        rollback_record=bad_record,
    )
    assert res["allowed"] is False
    assert any("Rollback evidence verification failed" in r for r in res["reasons"])


# ── Test Suite 3: Remediation Orchestrator Input & Patch Safeguards ───────────

def test_orchestrator_rejects_path_traversal_inputs():
    """Orchestrator rejects invalid repo/branch containing path traversal or shell injections."""
    orch = RemediationOrchestrator()

    # Traversal in repository
    run_traversal_repo = {
        "repository": "../../../etc/passwd",
        "run_id": 9991,
        "branch": "main",
        "commit_sha": "a1b2c3d",
    }
    res_repo = orch.handle_remediation(run_traversal_repo)
    assert res_repo["status"] == "rejected"
    assert "Invalid run inputs" in res_repo["error"]

    # Traversal in branch
    run_traversal_branch = {
        "repository": "safe-owner/safe-repo",
        "run_id": 9992,
        "branch": "../../malicious/branch",
        "commit_sha": "a1b2c3d",
    }
    res_branch = orch.handle_remediation(run_traversal_branch)
    assert res_branch["status"] == "rejected"
    assert "Invalid run inputs" in res_branch["error"]


def test_orchestrator_rejects_remediation_targeting_protected_branch():
    """Orchestrator forbids remediation branch from directly targeting protected branches."""
    orch = RemediationOrchestrator()
    ok, err = orch._validate_run_inputs(
        repo="org/repo",
        branch="main",
        commit_sha="a1b2c3d",
        remediation_branch="main",  # Direct targeting of protected branch!
    )
    assert ok is False
    assert "cannot target protected branch directly" in err


def test_orchestrator_rejects_malformed_python_syntax_patch():
    """Orchestrator uses ast.parse to detect and reject Python syntax errors in synthesized patches."""
    orch = RemediationOrchestrator()
    malformed_analysis = {
        "target_file": "services/auth/token_validator.py",
        "fixed_content": "def broken_syntax(:\n    return True\n",  # Syntax error!
        "diff": "--- a/file\n+++ b/file",
        "confidence": 95,
    }
    ok, err = orch._validate_patch_output(malformed_analysis)
    assert ok is False
    assert "Python syntax error" in err


def test_orchestrator_rejects_destructive_patterns_in_patch():
    """Orchestrator rejects patches containing destructive system commands."""
    orch = RemediationOrchestrator()
    destructive_analysis = {
        "target_file": "services/auth/token_validator.py",
        "fixed_content": "import os\ndef clean():\n    os.system('rm -rf /')\n",
        "diff": "--- a/file\n+++ b/file",
        "confidence": 95,
    }
    ok, err = orch._validate_patch_output(destructive_analysis)
    assert ok is False
    assert "Destructive pattern detected" in err


def test_orchestrator_rejects_protected_path_patch():
    """Orchestrator rejects patches attempting to modify workflow or secret files."""
    orch = RemediationOrchestrator()
    protected_analysis = {
        "target_file": ".github/workflows/deploy.yml",
        "fixed_content": "name: Deploy\non: push\n",
        "diff": "--- a/file\n+++ b/file",
        "confidence": 95,
    }
    ok, err = orch._validate_patch_output(protected_analysis)
    assert ok is False
    assert "targets protected sensitive path" in err


def test_orchestrator_merge_idempotency_and_audit():
    """Orchestrator records structured audit log and enforces idempotency on merge actions."""
    from data_store import store
    run_id = 998877
    incident_id = f"INC-{run_id}"
    store.incidents = [i for i in store.incidents if i.get("id") != incident_id]
    if hasattr(store, "_incident_metadata"):
        store._incident_metadata.pop(incident_id, None)

    orch = RemediationOrchestrator()
    run_data = {
        "repository": "SentinelOps-AuditTest",
        "run_id": run_id,
        "branch": "main",
        "commit_sha": "c1d2e3f",
    }
    res1 = orch.handle_remediation(
        run_data=run_data,
        override_ci_status="SUCCESS",
        override_merge_success=True,
        override_deployment_status="SUCCESS",
        override_health_status="HEALTHY",
    )
    assert res1["status"] == "resolved"
    assert len(orch._audit_records) >= 2  # Merge and Deployment audits recorded

    merge_audits = [a for a in orch._audit_records if a["action"] == "MERGE_PULL_REQUEST"]
    assert len(merge_audits) >= 1
    assert merge_audits[0]["repo"] == "SentinelOps-AuditTest"
    assert "audit_id" in merge_audits[0]
    assert merge_audits[0]["idempotency_key"] in orch._executed_merges

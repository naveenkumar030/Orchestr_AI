"""
Comprehensive Unit & Integration Test Suite for Phase 4:
Confidence Gate, Risk Assessment, and Human Approval for SentinelOps.
"""

import os
import sys
from typing import Any

CURRENT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if CURRENT_DIR not in sys.path:
    sys.path.insert(0, CURRENT_DIR)

from services.confidence_gate import ConfidenceGate, confidence_gate
from services.human_approval_service import HumanApprovalService
from services.risk_assessor import risk_assessor
from services.sentinel_guard import sentinel_guard


# Fixture helpers to generate standard test artifacts
def sample_diagnosis(confidence: float = 0.94, category: str = "dependency_error") -> dict[str, Any]:
    return {
        "category": category,
        "root_cause": "Dependency version mismatch",
        "confidence": confidence,
        "evidence": ["npm ERR! ERESOLVE could not resolve peer dependency"],
        "affected_files": ["package.json"],
        "affected_components": ["npm-packages"],
        "suggested_fix_direction": "Pin @stripe/stripe-node to ^14.1.0",
    }


def sample_fix(confidence: float = 0.90, fix_type: str = "dependency", affected_files=None, patch=None) -> dict[str, Any]:
    files = affected_files or ["package.json"]
    diff_patch = patch or (
        "--- a/package.json\n+++ b/package.json\n@@ -28,3 +28,3 @@\n-    \"@stripe/stripe-node\": \"^12.1.0\",\n+    \"@stripe/stripe-node\": \"^14.1.0\",\n"
    )
    return {
        "fix_type": fix_type,
        "description": "Upgrade @stripe/stripe-node to ^14.1.0",
        "affected_files": files,
        "patch": diff_patch,
        "reason": "Reconciles peer dependencies with node20 runtime",
        "confidence": confidence,
    }


def sample_critic(score: float = 0.89, approved: bool = True, security_concerns=None, issues=None) -> dict[str, Any]:
    return {
        "approved": approved,
        "score": score,
        "issues": issues or [],
        "reason": "Patch verified safe and minimal." if approved else "Critic rejected unsafe or invalid patch.",
        "recommended_changes": [],
        "security_concerns": security_concerns or [],
        "requires_human_review": not approved or score < 0.70,
    }


# ==============================================================================
# Phase 4 Core Test Scenarios (1 to 18)
# ==============================================================================

def test_scenario_1_high_confidence_safe_fix_approved():
    """1. High-confidence safe fix (all thresholds met, low risk) -> APPROVED."""
    diag = sample_diagnosis(confidence=0.95)
    fix = sample_fix(confidence=0.92)
    crit = sample_critic(score=0.90, approved=True)
    risk = {"risk_level": "low", "factors": [], "security_concerns": [], "destructive_patterns_detected": False}

    result = confidence_gate.evaluate(diagnosis=diag, fix=fix, critic=crit, risk_assessment=risk, target_branch="sentinelops/fix-safe")

    assert result["decision"] == "approved"
    assert result["approval_status"] == "auto_approved"
    assert result["requires_human_review"] is False
    assert len(result["security_findings"]) == 0


def test_scenario_2_low_diagnosis_confidence_human_review():
    """2. Low diagnosis confidence (< 0.85) -> HUMAN REVIEW REQUIRED."""
    diag = sample_diagnosis(confidence=0.65)
    fix = sample_fix(confidence=0.92)
    crit = sample_critic(score=0.90, approved=True)

    result = confidence_gate.evaluate(diagnosis=diag, fix=fix, critic=crit)

    assert result["decision"] == "human_review_required"
    assert result["approval_status"] == "pending_review"
    assert result["requires_human_review"] is True
    assert any("Diagnosis confidence" in r for r in result["reasons"])


def test_scenario_3_low_fix_confidence_human_review():
    """3. Low fix confidence (< 0.85) -> HUMAN REVIEW REQUIRED."""
    diag = sample_diagnosis(confidence=0.95)
    fix = sample_fix(confidence=0.72)
    crit = sample_critic(score=0.90, approved=True)

    result = confidence_gate.evaluate(diagnosis=diag, fix=fix, critic=crit)

    assert result["decision"] == "human_review_required"
    assert result["approval_status"] == "pending_review"
    assert result["requires_human_review"] is True
    assert any("Fix confidence" in r for r in result["reasons"])


def test_scenario_4_low_critic_score_human_review():
    """4. Low critic score (< 0.70) -> REJECTED or HUMAN REVIEW REQUIRED."""
    diag = sample_diagnosis(confidence=0.95)
    fix = sample_fix(confidence=0.90)
    crit = sample_critic(score=0.60, approved=False)

    result = confidence_gate.evaluate(diagnosis=diag, fix=fix, critic=crit)

    assert result["decision"] == "rejected"
    assert result["approval_status"] == "auto_rejected"


def test_scenario_5_critic_rejected_rejected():
    """5. Critic rejected -> REJECTED."""
    diag = sample_diagnosis(confidence=0.95)
    fix = sample_fix(confidence=0.90)
    crit = sample_critic(score=0.50, approved=False, issues=["Introduces breaking API change"])

    result = confidence_gate.evaluate(diagnosis=diag, fix=fix, critic=crit)

    assert result["decision"] == "rejected"
    assert result["approval_status"] == "auto_rejected"
    assert result["critic_approved"] is False


def test_scenario_6_medium_risk_fix_human_review():
    """6. Medium-risk fix (multiple files or dependency manifest update) -> HUMAN REVIEW REQUIRED."""
    diag = sample_diagnosis(confidence=0.95)
    fix = sample_fix(confidence=0.92, fix_type="dependency")
    crit = sample_critic(score=0.90, approved=True)
    risk = {"risk_level": "medium", "factors": ["Modifies dependency manifest"], "security_concerns": [], "destructive_patterns_detected": False}

    result = confidence_gate.evaluate(diagnosis=diag, fix=fix, critic=crit, risk_assessment=risk)

    assert result["decision"] == "human_review_required"
    assert result["approval_status"] == "pending_review"
    assert result["requires_human_review"] is True
    assert result["risk_level"] == "medium"


def test_scenario_7_high_risk_fix_human_review():
    """7. High-risk fix (auth/database/workflow change or large patch) -> HUMAN REVIEW REQUIRED."""
    diag = sample_diagnosis(confidence=0.95)
    fix = sample_fix(confidence=0.92, affected_files=["services/auth/token_validator.py"])
    crit = sample_critic(score=0.90, approved=True)
    
    # Assess risk on high-risk auth file
    risk = risk_assessor.assess(
        patch="--- a/services/auth/token_validator.py\n+++ b/services/auth/token_validator.py\n@@ -10,1 +10,1 @@\n-  return False\n+  return True\n",
        affected_files=["services/auth/token_validator.py"],
        target_branch="main",
    )

    assert risk["risk_level"] == "high"

    result = confidence_gate.evaluate(diagnosis=diag, fix=fix, critic=crit, risk_assessment=risk)

    assert result["decision"] == "human_review_required"
    assert result["approval_status"] == "pending_review"
    assert result["requires_human_review"] is True
    assert result["risk_level"] == "high"


def test_scenario_8_critical_security_issue_rejected():
    """8. Critical security issue -> REJECTED."""
    diag = sample_diagnosis(confidence=0.95)
    fix = sample_fix(confidence=0.90, patch="--- a/server.js\n+++ b/server.js\n@@ -1,1 +1,1 @@\n+eval(req.body.code);\n")
    crit = sample_critic(score=0.30, approved=False, security_concerns=["Unsafe dynamic code execution (eval)"])

    risk = risk_assessor.assess(patch=fix["patch"], affected_files=["server.js"])
    assert risk["risk_level"] == "critical"

    result = confidence_gate.evaluate(diagnosis=diag, fix=fix, critic=crit, risk_assessment=risk)

    assert result["decision"] == "rejected"
    assert result["approval_status"] == "auto_rejected"
    assert result["requires_human_review"] is True


def test_scenario_9_credential_exposure_rejected():
    """9. Credential exposure -> REJECTED."""
    diag = sample_diagnosis(confidence=0.95)
    fix = sample_fix(
        confidence=0.90,
        patch="--- a/config.py\n+++ b/config.py\n@@ -1,1 +1,1 @@\n+AWS_SECRET_ACCESS_KEY = 'AKIA1234567890SECRETKEY'\n",
    )
    crit = sample_critic(score=0.40, approved=False, security_concerns=["Credential / secret exposure in patch"])

    risk = risk_assessor.assess(patch=fix["patch"], affected_files=["config.py"])
    assert risk["risk_level"] == "critical"
    assert len(risk["security_concerns"]) > 0

    result = confidence_gate.evaluate(diagnosis=diag, fix=fix, critic=crit, risk_assessment=risk)

    assert result["decision"] == "rejected"
    assert result["approval_status"] == "auto_rejected"


def test_scenario_10_destructive_command_rejected():
    """10. Destructive command (rm -rf, DROP TABLE) -> REJECTED."""
    # Test rm -rf
    risk_rm = risk_assessor.assess(
        patch="--- a/deploy.sh\n+++ b/deploy.sh\n@@ -1,1 +1,1 @@\n+rm -rf /var/app/data\n",
        affected_files=["deploy.sh"],
    )
    assert risk_rm["risk_level"] == "critical"
    assert risk_rm["destructive_patterns_detected"] is True

    # Test DROP TABLE
    risk_sql = risk_assessor.assess(
        patch="--- a/schema.sql\n+++ b/schema.sql\n@@ -1,1 +1,1 @@\n+DROP TABLE users;\n",
        affected_files=["schema.sql"],
    )
    assert risk_sql["risk_level"] == "critical"
    assert risk_sql["destructive_patterns_detected"] is True

    result = confidence_gate.evaluate(
        diagnosis=sample_diagnosis(),
        fix=sample_fix(patch="+rm -rf /"),
        critic=sample_critic(approved=False),
        risk_assessment=risk_rm,
    )
    assert result["decision"] == "rejected"


def test_scenario_11_missing_confidence_value_fail_closed():
    """11. Missing confidence value (null/missing) -> fail-closed to HUMAN REVIEW REQUIRED."""
    # Null diagnosis confidence
    diag_null = {"category": "dependency_error", "root_cause": "test", "confidence": None}
    res1 = confidence_gate.evaluate(diagnosis=diag_null, fix=sample_fix(), critic=sample_critic())
    assert res1["decision"] == "human_review_required"
    assert res1["approval_status"] == "pending_review"
    assert res1["requires_human_review"] is True

    # Null fix confidence
    fix_null = {"fix_type": "code", "description": "test", "confidence": None, "patch": "", "affected_files": []}
    res2 = confidence_gate.evaluate(diagnosis=sample_diagnosis(), fix=fix_null, critic=sample_critic())
    assert res2["decision"] == "human_review_required"


def test_scenario_12_missing_critic_result_fail_closed():
    """12. Missing critic result (None or empty) -> fail-closed to HUMAN REVIEW REQUIRED."""
    res = confidence_gate.evaluate(diagnosis=sample_diagnosis(), fix=sample_fix(), critic=None)
    assert res["decision"] == "human_review_required"
    assert res["approval_status"] == "pending_review"
    assert res["requires_human_review"] is True


def test_scenario_13_human_approves_pending_review():
    """13. Human approves pending review -> approved_by_human."""
    svc = HumanApprovalService()
    inc_id = "INC-TEST-13"

    # Initialize safety gate state
    safety_res = {"decision": "human_review_required", "approval_status": "pending_review", "risk_level": "medium"}
    svc.initialize_record(incident_id=inc_id, safety_gate_result=safety_res)

    res = svc.submit_decision(incident_id=inc_id, decision="approve", comment="Verified with QA", approver="lead-devops")

    assert res["success"] is True
    assert res["approval_status"] == "approved_by_human"
    assert res["approved_by"] == "lead-devops"
    assert res["comment"] == "Verified with QA"

    # Verify audit trail
    state = svc.get_approval_state(inc_id)
    assert state["approval_status"] == "approved_by_human"
    assert len(state["audit_trail"]) == 2


def test_scenario_14_human_rejects_pending_review():
    """14. Human rejects pending review -> rejected_by_human."""
    svc = HumanApprovalService()
    inc_id = "INC-TEST-14"

    safety_res = {"decision": "human_review_required", "approval_status": "pending_review", "risk_level": "high"}
    svc.initialize_record(incident_id=inc_id, safety_gate_result=safety_res)

    res = svc.submit_decision(incident_id=inc_id, decision="reject", comment="Too risky for current release window", approver="sre-oncall")

    assert res["success"] is True
    assert res["approval_status"] == "rejected_by_human"
    assert res["approved_by"] == "sre-oncall"


def test_scenario_15_approval_cannot_happen_twice():
    """15. Approval idempotency: Cannot approve twice."""
    svc = HumanApprovalService()
    inc_id = "INC-TEST-15"

    safety_res = {"decision": "human_review_required", "approval_status": "pending_review"}
    svc.initialize_record(incident_id=inc_id, safety_gate_result=safety_res)

    # First approval
    res1 = svc.submit_decision(incident_id=inc_id, decision="approve", comment="First approval")
    assert res1["success"] is True

    # Second approval attempt must be blocked
    res2 = svc.submit_decision(incident_id=inc_id, decision="approve", comment="Duplicate approval attempt")
    assert res2["success"] is False
    assert "already been finalized" in res2["error"]


def test_scenario_16_rejection_cannot_be_silently_converted_to_approval():
    """16. Rejection cannot be silently converted to approval without re-running pipeline."""
    svc = HumanApprovalService()
    inc_id = "INC-TEST-16"

    # Initialize auto_rejected state
    safety_res = {"decision": "rejected", "approval_status": "auto_rejected", "risk_level": "critical"}
    svc.initialize_record(incident_id=inc_id, safety_gate_result=safety_res)

    # Operator attempts to override hard security block
    res = svc.submit_decision(incident_id=inc_id, decision="approve", comment="Operator override attempt")
    assert res["success"] is False
    assert "Cannot approve an auto-rejected fix" in res["error"]


def test_scenario_17_api_failure_does_not_result_in_approval():
    """17. API failure / exception in evaluation does not result in false approval."""
    gate = ConfidenceGate()
    # Pass garbage input
    res = gate.evaluate(diagnosis="not-a-dict", fix=None, critic=None)
    assert res["decision"] == "human_review_required"
    assert res["approval_status"] == "pending_review"
    assert res["decision"] != "approved"


def test_scenario_18_sentinelguard_protection_remains_active():
    """18. Existing SentinelGuard blocks protected branches and sensitive paths."""
    # Branch protection check
    branch_ok, msg = sentinel_guard.check_branch_protection("main")
    assert branch_ok is False
    assert "protected branch" in msg

    # File protection check
    file_ok, fmsg = sentinel_guard.check_file_protection(".env.production")
    assert file_ok is False
    assert "protected" in fmsg or "sensitive" in fmsg


# ==============================================================================
# Phase 4 Acceptance Test Scenarios (A through E)
# ==============================================================================

def test_acceptance_scenario_a_safe_dependency_fix():
    """
    Scenario A:
      Safe dependency fix:
      Diagnosis = 0.94, Fix = 0.91, Critic = 0.89, Risk = low, Security = clean
      Expected: APPROVED
    """
    diag = sample_diagnosis(confidence=0.94)
    fix = sample_fix(confidence=0.91)
    crit = sample_critic(score=0.89, approved=True)
    risk = {"risk_level": "low", "factors": [], "security_concerns": [], "destructive_patterns_detected": False}

    res = confidence_gate.evaluate(diagnosis=diag, fix=fix, critic=crit, risk_assessment=risk)
    assert res["decision"] == "approved"
    assert res["approval_status"] == "auto_approved"


def test_acceptance_scenario_b_uncertain_diagnosis():
    """
    Scenario B:
      Uncertain diagnosis:
      Diagnosis = 0.62, Fix = 0.90, Critic = 0.91
      Expected: HUMAN_REVIEW_REQUIRED
    """
    diag = sample_diagnosis(confidence=0.62)
    fix = sample_fix(confidence=0.90)
    crit = sample_critic(score=0.91, approved=True)

    res = confidence_gate.evaluate(diagnosis=diag, fix=fix, critic=crit)
    assert res["decision"] == "human_review_required"
    assert res["approval_status"] == "pending_review"


def test_acceptance_scenario_c_unsafe_fix():
    """
    Scenario C:
      Unsafe fix:
      Diagnosis = 0.94, Fix = 0.95, Critic = rejected, Security = critical
      Expected: REJECTED
    """
    diag = sample_diagnosis(confidence=0.94)
    fix = sample_fix(confidence=0.95)
    crit = sample_critic(score=0.40, approved=False, security_concerns=["Critical security issue"])
    risk = {"risk_level": "critical", "factors": ["Destructive command"], "security_concerns": ["Critical security issue"], "destructive_patterns_detected": True}

    res = confidence_gate.evaluate(diagnosis=diag, fix=fix, critic=crit, risk_assessment=risk)
    assert res["decision"] == "rejected"
    assert res["approval_status"] == "auto_rejected"


def test_acceptance_scenario_d_medium_risk_database_change():
    """
    Scenario D:
      Medium-risk database change:
      Diagnosis = 0.95, Fix = 0.92, Critic = 0.90, Risk = high
      Expected: HUMAN_REVIEW_REQUIRED
    """
    diag = sample_diagnosis(confidence=0.95)
    fix = sample_fix(confidence=0.92, affected_files=["migrations/002_add_index.sql"])
    crit = sample_critic(score=0.90, approved=True)
    risk = {"risk_level": "high", "factors": ["Database migration"], "security_concerns": [], "destructive_patterns_detected": False}

    res = confidence_gate.evaluate(diagnosis=diag, fix=fix, critic=crit, risk_assessment=risk)
    assert res["decision"] == "human_review_required"
    assert res["approval_status"] == "pending_review"


def test_acceptance_scenario_e_missing_data():
    """
    Scenario E:
      Missing data:
      Diagnosis confidence = null
      Expected: HUMAN_REVIEW_REQUIRED
    """
    diag = {"category": "dependency_error", "root_cause": "test", "confidence": None}
    fix = sample_fix(confidence=0.90)
    crit = sample_critic(score=0.88, approved=True)

    res = confidence_gate.evaluate(diagnosis=diag, fix=fix, critic=crit)
    assert res["decision"] == "human_review_required"
    assert res["approval_status"] == "pending_review"

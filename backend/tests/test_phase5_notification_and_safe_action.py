"""
Comprehensive Unit & Integration Test Suite for Phase 5:
Notification and Safe Action Layer for SentinelOps.
"""

import os
import sys
from typing import Any
from unittest.mock import MagicMock, patch

CURRENT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if CURRENT_DIR not in sys.path:
    sys.path.insert(0, CURRENT_DIR)

from services.github_action_service import (
    GitHubActionService,
)
from services.slack_notification_service import (
    NotificationStatus,
    SlackNotificationService,
)


# Helpers to generate realistic reasoning artifacts for Phase 5 tests
def sample_diagnosis(confidence: float = 0.95, category: str = "dependency_error") -> dict[str, Any]:
    return {
        "category": category,
        "root_cause": "Conflicting npm peer dependency tree for @stripe/stripe-node",
        "confidence": confidence,
        "evidence": ["npm ERR! ERESOLVE could not resolve peer dependency tree"],
        "affected_files": ["package.json"],
        "affected_components": ["npm-packages"],
        "suggested_fix_direction": "Upgrade @stripe/stripe-node to ^14.1.0",
    }


def sample_fix(confidence: float = 0.94, patch: str = None, affected_files=None) -> dict[str, Any]:
    files = affected_files or ["package.json"]
    diff = patch or (
        "--- a/package.json\n"
        "+++ b/package.json\n"
        "@@ -28,3 +28,3 @@\n"
        "-    \"@stripe/stripe-node\": \"^12.1.0\",\n"
        "+    \"@stripe/stripe-node\": \"^14.1.0\",\n"
    )
    return {
        "fix_type": "dependency",
        "description": "Upgrade @stripe/stripe-node to ^14.1.0 in package.json",
        "affected_files": files,
        "patch": diff,
        "reason": "Resolves npm peer dependency conflict with @types/node",
        "confidence": confidence,
    }


def sample_critic(score: float = 0.93, approved: bool = True, security_concerns=None) -> dict[str, Any]:
    return {
        "approved": approved,
        "score": score,
        "issues": [] if approved else ["Unresolved test failure"],
        "reason": "Proposed patch is minimal and safe." if approved else "Critic verification rejected.",
        "recommended_changes": [],
        "security_concerns": security_concerns or [],
        "requires_human_review": not approved or score < 0.70,
    }


def sample_reasoning_result(status: str = "approved", approval_status: str = "auto_approved", risk: str = "low") -> dict[str, Any]:
    diag = sample_diagnosis()
    fix = sample_fix()
    critic = sample_critic()
    return {
        "status": status,
        "approval_status": approval_status,
        "incident_id": "INC-TEST-001",
        "repository": "naveenkumar030/SentinelOps",
        "workflow_name": "CI / Test & Build",
        "commit_sha": "a1b2c3d4e5f6",
        "run_id": 892401,
        "diagnosis": diag,
        "fix": fix,
        "critic": critic,
        "risk_assessment": {
            "risk_level": risk,
            "factors": ["Minimal single-file change"],
            "file_risks": {"package.json": "medium"},
            "diff_stats": {"lines_added": 1, "lines_deleted": 1, "total_lines": 2},
            "security_concerns": [],
            "destructive_patterns_detected": False,
            "requires_human_review": (risk != "low"),
        },
        "safety_gate": {
            "decision": status,
            "approval_status": approval_status,
            "risk_level": risk,
            "diagnosis_confidence": 0.95,
            "fix_confidence": 0.94,
            "critic_score": 0.93,
            "critic_approved": True,
            "security_findings": [],
            "reasons": ["All safety and confidence gates passed."],
            "requires_human_review": (risk != "low"),
        },
        "attempts": 1,
        "refinement_history": [],
        "agent_timeline": [],
        "execution_metrics": {
            "total_duration_ms": 450,
            "attempts_count": 1,
            "final_critic_score": 0.93,
            "is_approved": (status == "approved"),
            "requires_human_review": (status == "human_review_required"),
            "risk_level": risk,
            "approval_status": approval_status,
        },
    }


# ==============================================================================
# SECTION 1: SLACK NOTIFICATION LAYER TESTS (1-8)
# ==============================================================================

class TestSlackNotificationService:
    """Unit and isolation tests for SlackNotificationService."""

    def test_01_slack_payload_format_auto_approved(self):
        """Test formatting of AUTO_APPROVED Slack Block Kit payload."""
        service = SlackNotificationService(webhook_url="https://hooks.slack.com/services/dummy")
        data = sample_reasoning_result(status="approved", approval_status="auto_approved")
        
        payload = service.format_slack_payload(event_type="AUTO_APPROVED", reasoning_data=data)
        assert "blocks" in payload
        assert len(payload["blocks"]) >= 3
        # Check title block
        title_text = payload["blocks"][0]["text"]["text"]
        assert "AUTO-APPROVED" in title_text
        assert "INC-TEST-001" in title_text

    def test_02_slack_payload_format_human_review_required(self):
        """Test formatting of HUMAN_REVIEW_REQUIRED Slack Block Kit payload."""
        service = SlackNotificationService(webhook_url="https://hooks.slack.com/services/dummy")
        data = sample_reasoning_result(status="human_review_required", approval_status="pending_review", risk="medium")
        
        payload = service.format_slack_payload(event_type="HUMAN_REVIEW_REQUIRED", reasoning_data=data)
        assert "blocks" in payload
        title_text = payload["blocks"][0]["text"]["text"]
        assert "HUMAN REVIEW REQUIRED" in title_text

    def test_03_slack_payload_format_rejected(self):
        """Test formatting of REJECTED Slack Block Kit payload."""
        service = SlackNotificationService(webhook_url="https://hooks.slack.com/services/dummy")
        data = sample_reasoning_result(status="rejected", approval_status="auto_rejected")
        data["critic"]["approved"] = False
        
        payload = service.format_slack_payload(event_type="REJECTED", reasoning_data=data)
        assert "blocks" in payload
        title_text = payload["blocks"][0]["text"]["text"]
        assert "REMEDIATION REJECTED" in title_text

    def test_04_slack_payload_human_decisions(self):
        """Test formatting of APPROVED_BY_HUMAN and REJECTED_BY_HUMAN Slack payloads."""
        service = SlackNotificationService(webhook_url="https://hooks.slack.com/services/dummy")
        data = sample_reasoning_result()
        data["human_approval"] = {
            "approved_by": "lead-devops",
            "approval_comment": "Verified lockfile patch on staging",
        }
        
        payload_appr = service.format_slack_payload(event_type="APPROVED_BY_HUMAN", reasoning_data=data)
        assert "APPROVED BY HUMAN" in payload_appr["blocks"][0]["text"]["text"]
        
        payload_rej = service.format_slack_payload(event_type="REJECTED_BY_HUMAN", reasoning_data=data)
        assert "REJECTED BY HUMAN" in payload_rej["blocks"][0]["text"]["text"]

    def test_05_secret_sanitization_in_slack_payload(self):
        """Verify that any secret keys in the root cause, patch, or logs are sanitized."""
        service = SlackNotificationService(webhook_url="https://hooks.slack.com/services/dummy")
        data = sample_reasoning_result()
        # Inject secrets in diagnosis and fix
        data["diagnosis"]["root_cause"] = "Stripe token sk_live_51Abc1234567890abcdef failed validation"
        data["fix"]["description"] = "Replace ghp_99887766554433221100aabbccddeeff0011 key"
        
        payload = service.format_slack_payload(event_type="AUTO_APPROVED", reasoning_data=data)
        raw_text = str(payload)
        
        assert "sk_live_51Abc1234567890abcdef" not in raw_text
        assert "ghp_99887766554433221100aabbccddeeff0011" not in raw_text
        assert "[REDACTED_STRIPE_KEY]" in raw_text or "[REDACTED" in raw_text

    def test_06_duplicate_notification_prevention(self):
        """Verify that duplicate notifications with the same key are debounced and skipped."""
        service = SlackNotificationService(webhook_url="https://hooks.slack.com/services/dummy")
        data = sample_reasoning_result()
        
        with patch.object(service, "_send_http_request", return_value=(True, 200, "ok")):
            res1 = service.send_notification(event_type="AUTO_APPROVED", reasoning_data=data)
            assert res1["status"] == NotificationStatus.SENT.value
            
            # Second call with the same incident and event type must be skipped as duplicate
            res2 = service.send_notification(event_type="AUTO_APPROVED", reasoning_data=data)
            assert res2["status"] == NotificationStatus.SKIPPED_DUPLICATE.value

    def test_07_slack_disabled_when_webhook_missing(self):
        """Verify that if webhook URL is not set, service returns SKIPPED_DISABLED without throwing."""
        service = SlackNotificationService(webhook_url="")
        data = sample_reasoning_result()
        
        res = service.send_notification(event_type="AUTO_APPROVED", reasoning_data=data)
        assert res["status"] == NotificationStatus.SKIPPED_DISABLED.value
        assert "not configured" in res["message"]

    def test_08_slack_error_resilience_and_isolation(self):
        """Verify HTTP 400, 500, 429 and network timeouts do NOT raise unhandled exceptions."""
        service = SlackNotificationService(webhook_url="https://hooks.slack.com/services/dummy")
        data = sample_reasoning_result()
        
        # Test HTTP 500
        with patch.object(service, "_send_http_request", return_value=(False, 500, "Internal Server Error")):
            res = service.send_notification(event_type="AUTO_APPROVED", reasoning_data=data)
            assert res["status"] == NotificationStatus.FAILED.value
            assert "HTTP 500" in res["error"]
            
        # Test timeout exception
        with patch.object(service, "_send_http_request", side_effect=TimeoutError("Connection timed out")):
            res_timeout = service.send_notification(event_type="HUMAN_REVIEW_REQUIRED", reasoning_data=data)
            assert res_timeout["status"] == NotificationStatus.FAILED.value
            assert "timed out" in res_timeout["error"].lower()


# ==============================================================================
# SECTION 2: SAFE GITHUB ACTION LAYER TESTS (9-20)
# ==============================================================================

class TestGitHubActionService:
    """Precondition checks, branch isolation, and safe draft PR creation tests."""

    def test_09_all_10_preconditions_verified_on_auto_approved(self):
        """Verify that an auto-approved low-risk fix passes all 10 preconditions."""
        service = GitHubActionService()
        data = sample_reasoning_result(status="approved", approval_status="auto_approved", risk="low")
        
        preconditions = service.verify_action_preconditions(data)
        assert preconditions["all_passed"] is True
        assert len(preconditions["reasons"]) == 0
        assert preconditions["checks"]["approval_status_valid"] is True
        assert preconditions["checks"]["critic_approved"] is True
        assert preconditions["checks"]["sentinel_guard_safe"] is True
        assert preconditions["checks"]["diff_valid"] is True
        assert preconditions["checks"]["no_path_traversal"] is True

    def test_10_block_action_if_not_approved(self):
        """Verify action is blocked if status is human_review_required and no approval given."""
        service = GitHubActionService()
        data = sample_reasoning_result(status="human_review_required", approval_status="pending_review", risk="medium")
        
        preconditions = service.verify_action_preconditions(data)
        assert preconditions["all_passed"] is False
        assert preconditions["checks"]["approval_status_valid"] is False
        assert any("Approval gate not met" in r for r in preconditions["reasons"])

    def test_11_block_action_if_critic_rejected(self):
        """Verify action is blocked if critic rejected the proposed patch."""
        service = GitHubActionService()
        data = sample_reasoning_result(status="approved", approval_status="auto_approved")
        data["critic"]["approved"] = False
        
        preconditions = service.verify_action_preconditions(data)
        assert preconditions["all_passed"] is False
        assert preconditions["checks"]["critic_approved"] is False

    def test_12_block_action_if_confidence_below_threshold(self):
        """Verify action is blocked if diagnosis, fix or critic scores fall below thresholds."""
        service = GitHubActionService()
        data = sample_reasoning_result(status="approved", approval_status="auto_approved")
        data["diagnosis"]["confidence"] = 0.70  # Below 0.85 threshold
        
        preconditions = service.verify_action_preconditions(data)
        assert preconditions["all_passed"] is False
        assert preconditions["checks"]["diagnosis_confidence_met"] is False

    def test_13_block_action_on_path_traversal(self):
        """Verify action is blocked if patch tries to escape working directory with ../."""
        service = GitHubActionService()
        data = sample_reasoning_result(status="approved", approval_status="auto_approved")
        data["fix"]["affected_files"] = ["../../etc/shadow"]
        data["fix"]["patch"] = "--- a/../../etc/shadow\n+++ b/../../etc/shadow\n@@ -1 +1 @@\n-root\n+hacked\n"
        
        preconditions = service.verify_action_preconditions(data)
        assert preconditions["all_passed"] is False
        assert preconditions["checks"]["no_path_traversal"] is False
        assert any("Path traversal" in r for r in preconditions["reasons"])

    def test_14_block_action_on_restricted_files(self):
        """Verify action is blocked if patch modifies .github/workflows or .git files."""
        service = GitHubActionService()
        data = sample_reasoning_result(status="approved", approval_status="auto_approved")
        data["fix"]["affected_files"] = [".github/workflows/deploy.yml"]
        
        preconditions = service.verify_action_preconditions(data)
        assert preconditions["all_passed"] is False
        assert preconditions["checks"]["no_restricted_files"] is False

    def test_15_block_action_on_sentinel_guard_violation(self):
        """Verify action is blocked if patch contains destructive commands (rm -rf)."""
        service = GitHubActionService()
        data = sample_reasoning_result(status="approved", approval_status="auto_approved")
        data["fix"]["patch"] = "--- a/clean.sh\n+++ b/clean.sh\n@@ -1 +1 @@\n+rm -rf / --no-preserve-root\n"
        
        preconditions = service.verify_action_preconditions(data)
        assert preconditions["all_passed"] is False
        assert preconditions["checks"]["sentinel_guard_safe"] is False

    def test_16_block_action_on_malformed_diff(self):
        """Verify action is blocked if patch does not contain unified diff headers (--- / +++)."""
        service = GitHubActionService()
        data = sample_reasoning_result(status="approved", approval_status="auto_approved")
        data["fix"]["patch"] = "Invalid plain text without diff headers"
        
        preconditions = service.verify_action_preconditions(data)
        assert preconditions["all_passed"] is False
        assert preconditions["checks"]["diff_valid"] is False

    def test_17_generate_isolated_branch_name(self):
        """Verify isolation branch follows sentinelops/fix/{id}-{hash} format and never main."""
        service = GitHubActionService()
        branch = service.generate_isolation_branch(incident_id="INC-8924", run_id=892401)
        
        assert branch.startswith("sentinelops/fix/")
        assert "main" not in branch
        assert "master" not in branch
        assert len(branch) > len("sentinelops/fix/")

    def test_18_draft_pr_body_generation(self):
        """Verify Draft PR body includes all required diagnostic, risk, and verification sections."""
        service = GitHubActionService()
        data = sample_reasoning_result()
        
        body = service.generate_draft_pr_body(data, branch_name="sentinelops/fix/inc-8924-a1b2c3")
        assert "## 🛡️ SentinelOps Autonomous Remediation (DRAFT)" in body
        assert "### 1. Root Cause Analysis" in body
        assert "### 2. Proposed Changes & Diff" in body
        assert "### 3. Safety & Verification Gate" in body
        assert "### 4. Human Operator Review & Sign-Off" in body
        assert "AUTO_APPROVED" in body or "APPROVED" in body

    def test_19_create_draft_pr_calls_github_with_draft_true(self):
        """Verify github_service.create_pull_request is called with draft=True and dedicated branch."""
        service = GitHubActionService()
        data = sample_reasoning_result(status="approved", approval_status="auto_approved")
        
        mock_gh = MagicMock()
        mock_gh.create_branch.return_value = {"ref": "refs/heads/sentinelops/fix/inc-test-001"}
        mock_gh.apply_patch_to_branch.return_value = {"status": "success", "commit_sha": "d4e5f6a1b2c3"}
        mock_gh.create_pull_request.return_value = {
            "status": "success",
            "pr_number": 184,
            "pr_url": "https://github.com/naveenkumar030/SentinelOps/pull/184",
            "draft": True,
        }
        
        with patch("services.github_action_service.github_service", mock_gh):
            result = service.create_safe_draft_pr(data, target_branch="main")
            
            assert result["status"] == "success"
            assert result["pr_number"] == 184
            assert result["draft"] is True
            # Verify create_pull_request was called with draft=True
            _, kwargs = mock_gh.create_pull_request.call_args
            assert kwargs.get("draft") is True
            assert kwargs.get("base") == "main"
            assert kwargs.get("head").startswith("sentinelops/fix/")

    def test_20_prevent_duplicate_draft_pr_creation(self):
        """Verify that duplicate PR creation for the same incident/branch is prevented."""
        service = GitHubActionService()
        data = sample_reasoning_result(status="approved", approval_status="auto_approved")
        
        mock_gh = MagicMock()
        mock_gh.create_branch.return_value = {"ref": "refs/heads/sentinelops/fix/inc-test-001"}
        mock_gh.apply_patch_to_branch.return_value = {"status": "success"}
        mock_gh.create_pull_request.return_value = {
            "status": "success",
            "pr_number": 184,
            "pr_url": "https://github.com/naveenkumar030/SentinelOps/pull/184",
            "draft": True,
        }
        
        with patch("services.github_action_service.github_service", mock_gh):
            # First execution succeeds
            res1 = service.create_safe_draft_pr(data)
            assert res1["status"] == "success"
            
            # Second execution with same data returns skipped duplicate
            res2 = service.create_safe_draft_pr(data)
            assert res2["status"] == "skipped"
            assert "Duplicate Draft PR prevented" in res2["message"]


# ==============================================================================
# SECTION 3: INTEGRATION & SAFETY GUARANTEE TESTS (21-25)
# ==============================================================================

class TestPhase5SafetyAndAcceptanceScenarios:
    """Acceptance scenarios A through E and safety posture guarantees."""

    def test_21_never_push_or_merge_to_main_branch_directly(self):
        """Verify that the safe action layer never pushes commits directly to main."""
        service = GitHubActionService()
        data = sample_reasoning_result(status="approved", approval_status="auto_approved")
        
        mock_gh = MagicMock()
        mock_gh.create_pull_request.return_value = {"pr_number": 185, "pr_url": "...", "draft": True}
        
        with patch("services.github_action_service.github_service", mock_gh):
            result = service.create_safe_draft_pr(data, target_branch="main")
            
            # Verify branch created is an isolated fix branch, NOT main
            branch_created = result.get("branch_name")
            assert branch_created.startswith("sentinelops/fix/")
            assert branch_created != "main"
            
            # Verify no merge method was ever called on GitHub service
            assert not hasattr(mock_gh, "merge_pull_request") or not mock_gh.merge_pull_request.called

    def test_22_slack_failure_never_affects_confidence_or_safety(self):
        """Verify that complete Slack failure leaves reasoning decisions and confidence untouched."""
        slack_svc = SlackNotificationService(webhook_url="https://hooks.slack.com/services/broken")
        data = sample_reasoning_result(status="approved", approval_status="auto_approved")
        
        initial_confidence = data["diagnosis"]["confidence"]
        initial_status = data["status"]
        
        with patch.object(slack_svc, "_send_http_request", side_effect=Exception("Slack gateway down")):
            res = slack_svc.send_notification("AUTO_APPROVED", data)
            assert res["status"] == NotificationStatus.FAILED.value
            
            # Verify pipeline state and confidence were completely unmodified
            assert data["diagnosis"]["confidence"] == initial_confidence
            assert data["status"] == initial_status

    def test_23_scenario_a_auto_approved_e2e(self):
        """Scenario A: High confidence (0.95), low risk -> Auto-Approved -> Slack dispatched + Draft PR created."""
        slack_svc = SlackNotificationService(webhook_url="https://hooks.slack.com/dummy")
        gh_action_svc = GitHubActionService()
        
        data = sample_reasoning_result(status="approved", approval_status="auto_approved", risk="low")
        
        mock_gh = MagicMock()
        mock_gh.create_branch.return_value = {"ref": "refs/heads/sentinelops/fix/inc-a"}
        mock_gh.apply_patch_to_branch.return_value = {"status": "success"}
        mock_gh.create_pull_request.return_value = {"status": "success", "pr_number": 201, "pr_url": "...", "draft": True}
        
        with patch.object(slack_svc, "_send_http_request", return_value=(True, 200, "ok")):
            with patch("services.github_action_service.github_service", mock_gh):
                # 1. Dispatch Slack
                slack_res = slack_svc.send_notification("AUTO_APPROVED", data)
                assert slack_res["status"] == NotificationStatus.SENT.value
                
                # 2. Create Draft PR
                pr_res = gh_action_svc.create_safe_draft_pr(data)
                assert pr_res["status"] == "success"
                assert pr_res["pr_number"] == 201

    def test_24_scenario_b_human_review_required_flow(self):
        """Scenario B: Medium risk -> Human review required -> Action blocked until operator approves -> Draft PR created."""
        slack_svc = SlackNotificationService(webhook_url="https://hooks.slack.com/dummy")
        gh_action_svc = GitHubActionService()
        
        # 1. Initial medium-risk decision
        data = sample_reasoning_result(status="human_review_required", approval_status="pending_review", risk="medium")
        
        # Action must be blocked initially
        preconditions = gh_action_svc.verify_action_preconditions(data)
        assert preconditions["all_passed"] is False
        
        # 2. Operator submits approval
        data["approval_status"] = "approved_by_human"
        data["status"] = "approved"
        data["human_approval"] = {
            "approved_by": "sr-sre",
            "approval_comment": "Verified lockfile patch on staging sandbox",
        }
        
        mock_gh = MagicMock()
        mock_gh.create_branch.return_value = {"ref": "refs/heads/sentinelops/fix/inc-b"}
        mock_gh.apply_patch_to_branch.return_value = {"status": "success"}
        mock_gh.create_pull_request.return_value = {"status": "success", "pr_number": 202, "pr_url": "...", "draft": True}
        
        with patch.object(slack_svc, "_send_http_request", return_value=(True, 200, "ok")):
            with patch("services.github_action_service.github_service", mock_gh):
                # Notification for approval
                slack_res = slack_svc.send_notification("APPROVED_BY_HUMAN", data)
                assert slack_res["status"] == NotificationStatus.SENT.value
                
                # Draft PR should now succeed
                pr_res = gh_action_svc.create_safe_draft_pr(data)
                assert pr_res["status"] == "success"
                assert pr_res["pr_number"] == 202

    def test_25_scenario_c_critic_rejection_blocks_all_actions(self):
        """Scenario C: Critic rejects patch -> Notification sent as REJECTED -> Draft PR action strictly BLOCKED."""
        slack_svc = SlackNotificationService(webhook_url="https://hooks.slack.com/dummy")
        gh_action_svc = GitHubActionService()
        
        data = sample_reasoning_result(status="rejected", approval_status="auto_rejected")
        data["critic"]["approved"] = False
        data["critic"]["score"] = 0.45
        
        with patch.object(slack_svc, "_send_http_request", return_value=(True, 200, "ok")):
            slack_res = slack_svc.send_notification("REJECTED", data)
            assert slack_res["status"] == NotificationStatus.SENT.value
            
            pr_res = gh_action_svc.create_safe_draft_pr(data)
            assert pr_res["status"] == "blocked"
            assert any("Critic" in r for r in pr_res.get("blocking_reasons", [])) or pr_res.get("checks", {}).get("critic_approved") is False


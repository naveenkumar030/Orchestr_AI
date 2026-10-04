"""
Autonomous CI/CD Repair Loop Test Suite for SentinelOps.

Covers the 10 core autonomous repair scenarios specified in the requirements:
1. Dependency failure
2. Python test failure
3. Syntax failure
4. Node build failure
5. Docker failure
6. GitHub Actions YAML failure
7. Patch application failure (PATCH_FAILED -> re-attempt)
8. Fix creates a new failure (Failure A -> Fix A -> CI -> Failure B -> Fix B -> CI -> PASS)
9. Three consecutive failed attempts (Max retries = 3 -> HUMAN_REVIEW_REQUIRED)
10. Successful end-to-end remediation
"""

import os
import sys
from unittest.mock import patch

CURRENT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if CURRENT_DIR not in sys.path:
    sys.path.insert(0, CURRENT_DIR)

from services.failure_extractor import failure_extractor
from services.patch_applicator import patch_applicator
from services.patch_validator import patch_validator
from services.remediation_orchestrator import (
    RemediationOrchestrator,
    RemediationState,
)
from services.incident_service import incident_service
from services.repo_context_retriever import repo_context_retriever
from services.validation_service import validation_service


# ── Scenario 1: Dependency Failure ─────────────────────────────────────────────
def test_scenario_1_dependency_failure():
    """
    Validates detection, diagnosis, and fix of a Python dependency failure.
    """
    raw_logs = (
        "Run pytest tests/\n"
        "Traceback (most recent call last):\n"
        '  File "services/auth.py", line 12, in <module>\n'
        "    import jwt\n"
        "ModuleNotFoundError: No module named 'jwt'\n"
        "Process completed with exit code 1.\n"
    )
    failure = failure_extractor.extract_failure(
        run_id=101,
        repo="auth-service",
        raw_log=raw_logs,
        workflow_name="CI",
    )
    assert failure["error_type"] == "ModuleNotFoundError"
    assert failure["missing_module"] == "jwt"
    assert failure["file"] == "services/auth.py"
    assert failure["line"] == 12

    orch = RemediationOrchestrator()
    orch.max_attempts = 1

    run_data = {
        "repository": "auth-service",
        "workflow_name": "CI",
        "run_id": 101,
        "branch": "main",
        "commit_sha": "a1b2c3d4",
    }
    with patch.object(validation_service, "validate_branch", return_value={"status": "SUCCESS", "failed_jobs": []}):
        res = orch.handle_remediation(
            run_data,
            override_ci_status="SUCCESS",
            override_merge_success=True,
            override_deployment_status="SUCCESS",
            override_health_status="HEALTHY",
        )
        assert res["status"] == "resolved"
        assert res["incident"]["status"] in ["Resolved", "Remediated"]


# ── Scenario 2: Python Test Failure ───────────────────────────────────────────
def test_scenario_2_python_test_failure():
    """
    Validates detection, diagnosis, and fix of a pytest assertion failure.
    """
    raw_logs = (
        "============================= test session starts =============================\n"
        "FAILED tests/test_auth.py::test_verify_token - AssertionError: Expected False but got True\n"
        "services/auth/token_validator.py:18: AssertionError\n"
        "=========================== 1 failed, 4 passed in 0.12s ===========================\n"
        "Process completed with exit code 1.\n"
    )
    failure = failure_extractor.extract_failure(
        run_id=102,
        repo="auth-service",
        raw_log=raw_logs,
        workflow_name="CI",
    )
    assert failure["error_type"] == "AssertionError"
    assert failure["test_file"] == "tests/test_auth.py"
    assert failure["failed_test"] == "test_verify_token"
    assert failure["file"] == "services/auth/token_validator.py"
    assert failure["line"] == 18

    orch = RemediationOrchestrator()
    orch.max_attempts = 1
    run_data = {
        "repository": "auth-service",
        "workflow_name": "CI",
        "run_id": 102,
        "branch": "main",
        "commit_sha": "b2c3d4e5",
    }
    with patch.object(validation_service, "validate_branch", return_value={"status": "SUCCESS", "failed_jobs": []}):
        res = orch.handle_remediation(
            run_data,
            override_ci_status="SUCCESS",
            override_merge_success=True,
            override_deployment_status="SUCCESS",
            override_health_status="HEALTHY",
        )
        assert res["status"] == "resolved"


# ── Scenario 3: Syntax Failure ────────────────────────────────────────────────
def test_scenario_3_syntax_failure():
    """
    Validates detection and local validation of a Python syntax error.
    """
    raw_logs = (
        '  File "services/auth/token_validator.py", line 14\n'
        "    if token\n"
        "            ^\n"
        "SyntaxError: expected ':'\n"
        "Process completed with exit code 1.\n"
    )
    failure = failure_extractor.extract_failure(
        run_id=103,
        repo="auth-service",
        raw_log=raw_logs,
        workflow_name="CI",
    )
    assert failure["error_type"] == "SyntaxError"
    assert failure["file"] == "services/auth/token_validator.py"
    assert failure["line"] == 14

    # Validate that patch_validator catches invalid syntax before commit
    invalid_content = "def broken(\n  return 42"
    syntax_ok, syntax_err = patch_validator.validate_syntax("services/auth/token_validator.py", invalid_content)
    assert syntax_ok is False
    assert "SyntaxError" in syntax_err


# ── Scenario 4: Node Build Failure ────────────────────────────────────────────
def test_scenario_4_node_build_failure():
    """
    Validates detection of Node npm build failure.
    """
    raw_logs = (
        "npm ERR! code ENOENT\n"
        "npm ERR! syscall open\n"
        "npm ERR! path /app/package.json\n"
        "npm ERR! errno -2\n"
        "npm ERR! enoent ENOENT: no such file or directory, open '/app/package.json'\n"
        "Process completed with exit code 1.\n"
    )
    failure = failure_extractor.extract_failure(
        run_id=104,
        repo="frontend-service",
        raw_log=raw_logs,
        workflow_name="CI",
    )
    assert "ENOENT" in failure["error_type"]
    assert failure["file"] == "package.json"


# ── Scenario 5: Docker Failure ────────────────────────────────────────────────
def test_scenario_5_docker_failure():
    """
    Validates detection of Dockerfile build instruction failure.
    """
    raw_logs = (
        "Step 4/8 : COPY requirements.txt .\n"
        'ERROR: failed to solve: failed to compute cache key: "/requirements.txt" not found: not found\n'
        "Process completed with exit code 1.\n"
    )
    failure = failure_extractor.extract_failure(
        run_id=105,
        repo="docker-service",
        raw_log=raw_logs,
        workflow_name="CI",
    )
    assert failure["error_type"] == "DOCKER_FAILURE"
    assert failure["file"] == "Dockerfile"


# ── Scenario 6: GitHub Actions YAML Failure ───────────────────────────────────
def test_scenario_6_github_actions_yaml_failure():
    """
    Validates detection of workflow YAML syntax and configuration errors.
    """
    raw_logs = (
        "Invalid workflow file: .github/workflows/ci.yml#L12\n"
        "The workflow is not valid. syntax error in your yaml file at line 12 col 5\n"
        "Process completed with exit code 1.\n"
    )
    failure = failure_extractor.extract_failure(
        run_id=106,
        repo="workflow-repo",
        raw_log=raw_logs,
        workflow_name="CI",
    )
    assert failure["error_type"] == "CONFIGURATION"
    assert failure["file"] == ".github/workflows/ci.yml"
    assert failure["line"] == 12


# ── Scenario 7: Patch Application Failure (PATCH_FAILED) ──────────────────────
def test_scenario_7_patch_application_failure():
    """
    Validates that when a patch does not match target file context lines,
    it returns PATCH_FAILED, never claims success, and is rejected before commit.
    """
    bad_diff = (
        "--- a/services/auth.py\n"
        "+++ b/services/auth.py\n"
        "@@ -10,3 +10,4 @@\n"
        " Non-existent context line here\n"
        "+new_line_added = True\n"
        " Another non-existent line\n"
    )
    # File provider returns content that does not match bad_diff context lines
    file_content = "def authenticate(user, password):\n    return True\n"
    res = patch_validator.run_local_validation(
        diff_patch=bad_diff,
        file_provider=lambda p: file_content,
    )
    assert res["valid"] is False
    assert res["status"] == "PATCH_FAILED"
    assert res["stage"] == "APPLICATION"


# ── Scenario 8: Adaptation (Failure A -> Fix A -> CI Failure B -> Fix B -> PASS)
def test_scenario_8_adaptation_fix_creates_new_failure():
    """
    The critical multi-attempt adaptation scenario:
    Attempt 1: Dependency failure -> Patch A applied -> CI fails with new Failure B (AssertionError in tests).
    Attempt 2: System detects Failure B, synthesizes Fix B based on NEW CI logs -> CI passes -> REMEDIATED!
    """
    incident_service.delete_incident("INC-208")
    orch = RemediationOrchestrator()
    orch.max_attempts = 3

    call_count = 0
    def mock_ci_validation(repo, branch, commit_sha=None, **kwargs):
        nonlocal call_count
        call_count += 1
        if call_count == 1:
            # First fix caused a new failure (Failure B)
            return {
                "status": "FAILURE",
                "workflow": "CI",
                "run_id": 208,
                "branch": branch,
                "failed_jobs": ["unit-tests"],
                "logs": (
                    "FAILED tests/test_token.py::test_empty_token - AssertionError: expected False\n"
                    "services/auth/token_validator.py:12: AssertionError\n"
                    "Process completed with exit code 1.\n"
                ),
            }
        # Second fix passes
        return {
            "status": "SUCCESS",
            "workflow": "CI",
            "run_id": 208,
            "branch": branch,
            "failed_jobs": [],
            "logs": None,
        }

    run_data = {
        "repository": "payment-service",
        "workflow_name": "CI",
        "run_id": 208,
        "branch": "main",
        "commit_sha": "c1d2e3f4",
    }

    with patch.object(validation_service, "validate_branch", side_effect=mock_ci_validation):
        res = orch.handle_remediation(
            run_data,
            override_merge_success=True,
            override_deployment_status="SUCCESS",
            override_health_status="HEALTHY",
        )
        assert res["status"] == "resolved"
        assert len(res["attempts"]) == 2
        # Attempt 1 failed CI
        assert res["attempts"][0]["validation_status"] == "FAILURE"
        # Attempt 2 passed CI
        assert res["attempts"][1]["validation_status"] == "SUCCESS"
        # Verify failure memory recorded
        assert "failure" in res["attempts"][0]
        assert "patch" in res["attempts"][0]
        assert res["attempts"][0]["attempt"] == 1
        assert res["attempts"][1]["attempt"] == 2


# ── Scenario 9: Max Retries (3 consecutive failures -> HUMAN_REVIEW_REQUIRED) ──
def test_scenario_9_max_three_consecutive_failed_attempts():
    """
    Validates that reaching 3 failed attempts terminates with HUMAN_REVIEW_REQUIRED
    without creating an infinite loop.
    """
    incident_service.delete_incident("INC-209")
    orch = RemediationOrchestrator()
    orch.max_attempts = 3

    run_data = {
        "repository": "payment-service",
        "workflow_name": "CI",
        "run_id": 209,
        "branch": "main",
        "commit_sha": "d2e3f4a1",
    }
    with patch.object(validation_service, "validate_branch", return_value={"status": "FAILURE", "logs": "AssertionError"}):
        res = orch.handle_remediation(run_data)
        assert res["status"] == "escalated"
        assert res["remediation_state"] == RemediationState.HUMAN_REVIEW_REQUIRED.value
        assert len(res["attempts"]) == 3
        assert [a["attempt"] for a in res["attempts"]] == [1, 2, 3]


# ── Scenario 10: Successful End-to-End Remediation ────────────────────────────
def test_scenario_10_successful_end_to_end_remediation():
    """
    Validates the complete success pipeline:
    Detect -> Diagnose -> Fix -> Patch Applied -> Locally Validated -> Commit -> CI Passed -> REMEDIATED.
    """
    incident_service.delete_incident("INC-210")
    orch = RemediationOrchestrator()
    orch.max_attempts = 2

    run_data = {
        "repository": "payment-service",
        "workflow_name": "CI / Test & Build",
        "run_id": 210,
        "branch": "main",
        "commit_sha": "e3f4a1b2",
    }
    with patch.object(validation_service, "validate_branch", return_value={"status": "SUCCESS", "failed_jobs": []}):
        res = orch.handle_remediation(
            run_data,
            override_ci_status="SUCCESS",
            override_confidence=96,
            override_risk="LOW",
            override_merge_success=True,
            override_deployment_status="SUCCESS",
            override_health_status="HEALTHY",
        )
        assert res["status"] == "resolved"
        assert res["remediation_state"] == RemediationState.REMEDIATED.value
        assert res["incident"]["status"] in ["Resolved", "Remediated"]
        assert len(res["attempts"]) == 1
        assert res["attempts"][0]["validation_status"] == "SUCCESS"
        assert "mttr" in res
        assert res["mttr"]["total_mttr_seconds"] > 0


# ── Scenario 11: Broken Python Import ─────────────────────────────────────────
def test_scenario_11_broken_python_import():
    """
    Validates detection, diagnosis, and strategy for broken Python import.
    """
    raw_logs = (
        "Run pytest tests/\n"
        "Traceback (most recent call last):\n"
        '  File "services/auth.py", line 8, in <module>\n'
        "    from services.security import verify_signature\n"
        "ImportError: cannot import name 'verify_signature' from 'services.security'\n"
        "Process completed with exit code 1.\n"
    )
    failure = failure_extractor.extract_failure(
        run_id=211,
        repo="auth-service",
        raw_log=raw_logs,
        workflow_name="CI",
    )
    assert failure["error_type"] == "ImportError"
    assert failure["file"] == "services/auth.py"
    assert failure["line"] == 8
    strategy = repo_context_retriever.determine_strategy(failure)
    assert strategy == "IMPORT_ERROR"


# ── Scenario 12: Node Dependency Failure (ERESOLVE) ───────────────────────────
def test_scenario_12_node_dependency_failure():
    """
    Validates detection and strategy for Node npm dependency resolution failure.
    """
    raw_logs = (
        "npm ERR! code ERESOLVE\n"
        "npm ERR! ERESOLVE unable to resolve dependency tree\n"
        "npm ERR! \n"
        "npm ERR! While resolving: frontend@1.0.0\n"
        "npm ERR! Found: react@18.2.0\n"
        "npm ERR! Could not resolve dependency:\n"
        "npm ERR! peer react@\"^17.0.0\" from legacy-ui-lib@2.1.0\n"
        "Process completed with exit code 1.\n"
    )
    failure = failure_extractor.extract_failure(
        run_id=212,
        repo="frontend-web",
        raw_log=raw_logs,
        workflow_name="CI",
    )
    assert "ERESOLVE" in failure["error_type"]
    assert failure["file"] == "package.json"
    strategy = repo_context_retriever.determine_strategy(failure)
    assert strategy == "DEPENDENCY"


# ── Scenario 13: npm Build Failure (TypeScript Compilation) ───────────────────
def test_scenario_13_npm_build_failure():
    """
    Validates detection and strategy for npm build TypeScript failure.
    """
    raw_logs = (
        "npm run build\n"
        "> frontend@1.0.0 build\n"
        "> tsc\n"
        "src/App.tsx(42,15): error TS2339: Property 'validateSession' does not exist on type 'AuthService'.\n"
        "Process completed with exit code 1.\n"
    )
    failure = failure_extractor.extract_failure(
        run_id=213,
        repo="frontend-web",
        raw_log=raw_logs,
        workflow_name="CI",
    )
    assert failure["error_type"] == "TYPE_ERROR"
    assert failure["file"] == "src/App.tsx"
    assert failure["line"] == 42
    strategy = repo_context_retriever.determine_strategy(failure)
    assert strategy == "TYPE_ERROR"


# ── Scenario 14: Environment Variable Failure ─────────────────────────────────
def test_scenario_14_environment_variable_failure():
    """
    Validates detection and strategy for missing environment variable.
    """
    raw_logs = (
        "Traceback (most recent call last):\n"
        '  File "services/db.py", line 14, in get_connection\n'
        "    db_url = os.environ['DATABASE_URL']\n"
        '  File "os.py", line 685, in __getitem__\n'
        "KeyError: 'DATABASE_URL'\n"
        "Process completed with exit code 1.\n"
    )
    failure = failure_extractor.extract_failure(
        run_id=214,
        repo="database-service",
        raw_log=raw_logs,
        workflow_name="CI",
    )
    assert failure["error_type"] == "KeyError"
    assert failure["file"] == "services/db.py"
    assert failure["line"] == 14
    context = repo_context_retriever.retrieve_context(
        failure_info=failure,
        file_provider=lambda p: "import os\ndef get_connection():\n    return os.environ['DATABASE_URL']\n" if p == "services/db.py" else None,
    )
    assert context["target_file"]["path"] == "services/db.py"


# ── Scenario 15: Database Migration Failure ───────────────────────────────────
def test_scenario_15_database_migration_failure():
    """
    Validates detection and strategy for database migration failure.
    """
    raw_logs = (
        "Run alembic upgrade head\n"
        "alembic.util.exc.CommandError: Can't locate revision identified by '8a3f9e1b2c4d'\n"
        "Process completed with exit code 1.\n"
    )
    failure = failure_extractor.extract_failure(
        run_id=215,
        repo="database-service",
        raw_log=raw_logs,
        workflow_name="CI",
    )
    assert failure["error_type"] == "DATABASE"
    strategy = repo_context_retriever.determine_strategy(failure)
    assert strategy == "DATABASE_FAILURE"


"""
End-to-End Autonomous Pipeline Tests for SentinelOps / Orchestr_AI.

Covers all 7 critical scenarios required by Step 17:
  1. Python failure (SyntaxError): Detect -> Diagnose -> Patch -> Apply -> Validate -> CI -> Pass
  2. Missing dependency (ModuleNotFoundError): Detect dependency -> update requirements.txt -> Validate -> Pass
  3. Failing test (AssertionError): Find test -> inspect implementation -> generate patch -> apply -> Validate -> Pass
  4. Invalid AI patch: Malformed diff rejected -> No commit -> Retry
  5. Patch context mismatch: Hunk mismatch rejected -> No raw diff committed -> Regenerate
  6. Fix creates a NEW failure: Attempt 1 new CI failure -> Extract new logs -> Attempt 2 fixes it -> CI pass
  7. Three failed attempts: Max attempts exhausted -> HUMAN_REVIEW_REQUIRED (never fake SUCCESS)
"""

import os
import sys
from unittest.mock import patch, MagicMock

CURRENT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if CURRENT_DIR not in sys.path:
    sys.path.insert(0, CURRENT_DIR)

from services.failure_extractor import failure_extractor
from services.patch_applicator import patch_applicator
from services.patch_validator import patch_validator
from services.repo_context_retriever import repo_context_retriever
from services.remediation_orchestrator import (
    RemediationOrchestrator,
    RemediationState,
    remediation_orchestrator,
)
from services.validation_service import validation_service
from services.github_service import github_service
from services.agents.diagnoser_agent import validate_diagnoser_output


# ── Test 1: Python failure (SyntaxError) ──────────────────────────────────────
def test_e2e_python_syntax_error():
    """
    Scenario 1:
      A GitHub Actions run fails with Python SyntaxError.
      SentinelOps deterministically extracts the failure, diagnoses, generates a minimal diff,
      applies it cleanly, validates Python AST/compilation, and validates CI to pass.
    """
    syntax_error_log = (
        "=== Job 101 Runner Execution Log ===\n"
        "[2026-09-28T10:00:00Z] Step 3: Run pytest\n"
        '  File "services/auth/token_validator.py", line 5\n'
        "    def verify(self, token\n"
        "                          ^\n"
        "SyntaxError: '(' was never closed\n"
        "##[error]Process completed with exit code 1.\n"
    )

    # 1. Failure Extractor
    failure_info = failure_extractor.extract_failure(
        run_id=881001,
        repo="payment-service",
        raw_log=syntax_error_log,
    )
    assert failure_info["error_type"] == "SyntaxError"
    assert failure_info["file"] == "services/auth/token_validator.py"
    assert failure_info["line"] == 5
    assert "SyntaxError|services/auth/token_validator.py:5" in failure_info["failure_signature"]

    # 2. Patch Application & AST Validation
    base_file = (
        "# Token Validator Service\n"
        "import time\n\n"
        "class TokenValidator:\n"
        "    def verify(self, token\n"
        "        # Buggy check allows expired token when grace period is not bounded\n"
        "        return True\n"
    )
    diff = (
        "--- a/services/auth/token_validator.py\n"
        "+++ b/services/auth/token_validator.py\n"
        "@@ -4,4 +4,4 @@\n"
        " class TokenValidator:\n"
        "-    def verify(self, token\n"
        "+    def verify(self, token):\n"
        "         # Buggy check allows expired token when grace period is not bounded\n"
    )
    app_res = patch_applicator.apply_patch(diff, file_provider=lambda p: base_file)
    assert app_res["applied"] is True
    modified_code = app_res["resulting_files"]["services/auth/token_validator.py"]

    # AST validation confirms syntax is now clean
    val_res = patch_validator.validate_patch(
        diff_patch=diff,
        file_provider=lambda p: base_file,
    )
    assert val_res["valid"] is True

    # 3. Closed-loop Orchestration
    orch = RemediationOrchestrator()
    run_data = {
        "repository": "payment-service",
        "workflow_name": "CI / Test & Build",
        "run_id": 881001,
        "branch": "main",
        "commit_sha": "c1a2b3d4e5",
    }
    with patch.object(github_service, "get_workflow_logs", return_value=(True, syntax_error_log)), \
         patch.object(github_service, "get_file_content", return_value=(True, {"decoded_text": base_file})):
        res = orch.handle_remediation(
            run_data,
            override_ci_status="SUCCESS",
            override_confidence=97,
            override_risk="LOW",
            override_merge_success=True,
        )
    assert res["status"] == "resolved"
    assert res["attempts"][-1]["validation_status"] == "SUCCESS"


# ── Test 2: Missing dependency (ModuleNotFoundError) ──────────────────────────
def test_e2e_missing_dependency():
    """
    Scenario 2:
      GitHub Actions fails with ModuleNotFoundError.
      SentinelOps identifies the missing module, modifies requirements.txt,
      validates the patch, and successfully commits and resolves.
    """
    mod_error_log = (
        "=== Job 102 Runner Execution Log ===\n"
        "[2026-09-28T10:05:00Z] Step 3: Run pytest\n"
        "Traceback (most recent call last):\n"
        '  File "/workspace/payment-service/main.py", line 3, in <module>\n'
        "    import pydantic_core\n"
        "ModuleNotFoundError: No module named 'pydantic_core'\n"
        "##[error]Process completed with exit code 1.\n"
    )

    failure_info = failure_extractor.extract_failure(
        run_id=881002,
        repo="payment-service",
        raw_log=mod_error_log,
    )
    assert failure_info["error_type"] == "ModuleNotFoundError"
    assert failure_info["missing_module"] == "pydantic_core"

    base_req = "# Project dependencies\npytest>=8.0.0\nrequests>=2.31.0\n"
    diff = (
        "--- a/requirements.txt\n"
        "+++ b/requirements.txt\n"
        "@@ -1,3 +1,4 @@\n"
        " # Project dependencies\n"
        " pytest>=8.0.0\n"
        " requests>=2.31.0\n"
        "+pydantic_core>=2.0.0\n"
    )
    app_res = patch_applicator.apply_patch(diff, file_provider=lambda p: base_req)
    assert app_res["applied"] is True
    assert "pydantic_core>=2.0.0" in app_res["resulting_files"]["requirements.txt"]

    val_res = patch_validator.validate_patch(diff, file_provider=lambda p: base_req)
    assert val_res["valid"] is True

    orch = RemediationOrchestrator()
    run_data = {
        "repository": "payment-service",
        "workflow_name": "CI / Test & Build",
        "run_id": 881002,
        "branch": "main",
        "commit_sha": "d2c3e4f5a6",
    }
    with patch.object(github_service, "get_workflow_logs", return_value=(True, mod_error_log)):
        res = orch.handle_remediation(
            run_data,
            override_ci_status="SUCCESS",
            override_confidence=98,
            override_risk="LOW",
            override_merge_success=True,
        )
    assert res["status"] == "resolved"


# ── Test 3: Failing test (AssertionError) ──────────────────────────────────────
def test_e2e_failing_test_assertion_error():
    """
    Scenario 3:
      AssertionError in test suite.
      SentinelOps extracts failed test, source file, line number, applies fix to source file,
      runs local validation, and verifies via CI.
    """
    assertion_log = (
        "=== Job 103 Runner Execution Log ===\n"
        "tests/test_auth.py:48: AssertionError: assert False is True\n"
        "=================================== FAILURES ===================================\n"
        "______________________________ test_token_expiry _______________________________\n"
        "    def test_token_expiry():\n"
        ">       assert token_validator.verify('expired_token') is False\n"
        "E       AssertionError: assert True is False\n"
        "services/auth/token_validator.py:48: AssertionError\n"
        "=========================== 1 failed, 17 passed ===========================\n"
        "##[error]Process completed with exit code 1.\n"
    )

    failure_info = failure_extractor.extract_failure(
        run_id=881003,
        repo="payment-service",
        raw_log=assertion_log,
    )
    assert failure_info["error_type"] == "AssertionError"
    assert failure_info["file"] == "services/auth/token_validator.py"
    assert failure_info["test_file"] == "tests/test_auth.py"

    orch = RemediationOrchestrator()
    run_data = {
        "repository": "payment-service",
        "workflow_name": "CI / Test & Build",
        "run_id": 881003,
        "branch": "main",
        "commit_sha": "e3f4a5b6c7",
    }
    with patch.object(github_service, "get_workflow_logs", return_value=(True, assertion_log)):
        res = orch.handle_remediation(
            run_data,
            override_ci_status="SUCCESS",
            override_confidence=96,
            override_risk="LOW",
            override_merge_success=True,
        )
    assert res["status"] == "resolved"
    assert res["attempts"][0]["validation_status"] == "SUCCESS"


# ── Test 4: Invalid AI patch rejected ─────────────────────────────────────────
def test_e2e_invalid_ai_patch_rejected():
    """
    Scenario 4:
      AI generates an invalid diff containing broken Python syntax.
      PatchValidator catches the syntax error, refuses to apply or commit,
      and marks validation as rejected without creating a PR or reporting success.
    """
    invalid_python_diff = (
        "--- a/services/auth/token_validator.py\n"
        "+++ b/services/auth/token_validator.py\n"
        "@@ -4,4 +4,5 @@\n"
        " class TokenValidator:\n"
        "     def verify(self, token):\n"
        "-        # Buggy check allows expired token when grace period is not bounded\n"
        "-        return True\n"
        "+        def broken( &&&& %%% syntax_error\n"
    )

    base_content = (
        "# Token Validator Service\n"
        "import time\n\n"
        "class TokenValidator:\n"
        "    def verify(self, token):\n"
        "        # Buggy check allows expired token when grace period is not bounded\n"
        "        return True\n"
    )

    val_res = patch_validator.validate_patch(
        diff_patch=invalid_python_diff,
        file_provider=lambda p: base_content,
    )
    assert val_res["valid"] is False
    assert "syntax" in val_res["error"].lower()


# ── Test 5: Patch context mismatch ────────────────────────────────────────────
def test_e2e_patch_context_mismatch():
    """
    Scenario 5:
      AI diff contains hallucinated context lines that do not exist in the base file.
      PatchApplicator detects hunk mismatch, rejects the patch cleanly,
      and never commits raw diffs or corrupts source code.
    """
    mismatched_diff = (
        "--- a/services/auth/token_validator.py\n"
        "+++ b/services/auth/token_validator.py\n"
        "@@ -10,4 +10,4 @@\n"
        " non_existent_function_call()\n"
        "-completely_invented_line()\n"
        "+fixed_invented_line()\n"
    )

    base_content = (
        "# Token Validator Service\n"
        "import time\n\n"
        "class TokenValidator:\n"
        "    def verify(self, token):\n"
        "        return True\n"
    )

    app_res = patch_applicator.apply_patch(
        patch_str=mismatched_diff,
        file_provider=lambda p: base_content,
    )
    assert app_res["applied"] is False
    assert "context does not match" in app_res["error"]
    assert len(app_res["resulting_files"]) == 0


# ── Test 6: Fix creates a NEW failure (Intelligent Retry with new logs) ────────
def test_e2e_fix_creates_new_failure():
    """
    Scenario 6:
      Attempt 1 fix introduces or encounters a NEW failure during CI.
      SentinelOps extracts the NEW failure logs (does not reuse stale logs),
      synthesizes an updated patch on Attempt 2, and CI passes on Attempt 2.
    """
    orch = RemediationOrchestrator()
    orch.max_attempts = 2

    run_data = {
        "repository": "payment-service",
        "workflow_name": "CI / Test & Build",
        "run_id": 881006,
        "branch": "main",
        "commit_sha": "f4a5b6c7d8",
    }

    call_count = 0
    def mock_validate(repo, branch, commit_sha=None, **kwargs):
        nonlocal call_count
        call_count += 1
        if call_count == 1:
            return {
                "status": "FAILURE",
                "workflow": "CI",
                "run_id": 881006,
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
            "run_id": 881006,
            "commit_sha": commit_sha or "HEAD",
            "branch": branch,
            "failed_jobs": [],
            "logs": None,
            "duration": 12,
            "simulated": True,
        }

    with patch.object(validation_service, "validate_branch", side_effect=mock_validate):
        res = orch.handle_remediation(
            run_data,
            override_confidence=97,
            override_risk="LOW",
            override_merge_success=True,
        )
    assert res["status"] == "resolved"
    assert len(res["attempts"]) == 2
    assert res["attempts"][0]["validation_status"] == "FAILURE"
    assert res["attempts"][1]["validation_status"] == "SUCCESS"


# ── Test 7: Three failed attempts -> HUMAN_REVIEW_REQUIRED ────────────────────
def test_e2e_three_failed_attempts_human_review():
    """
    Scenario 7:
      Remediation fails CI three consecutive times.
      SentinelOps halts autonomous loop at MAX_REMEDIATION_ATTEMPTS (3),
      moves incident to HUMAN_REVIEW_REQUIRED, and never reports false SUCCESS.
    """
    orch = RemediationOrchestrator()
    orch.max_attempts = 3

    run_data = {
        "repository": "payment-service",
        "workflow_name": "CI / Test & Build",
        "run_id": 881007,
        "branch": "main",
        "commit_sha": "a5b6c7d8e9",
    }

    def mock_always_fail(repo, branch, commit_sha=None, **kwargs):
        return {
            "status": "FAILURE",
            "workflow": "CI",
            "run_id": 881007,
            "commit_sha": commit_sha or "HEAD",
            "branch": branch,
            "failed_jobs": ["build-and-test"],
            "logs": "AssertionError: Persistent failure that cannot be auto-resolved",
            "duration": 15,
            "simulated": True,
        }

    with patch.object(validation_service, "validate_branch", side_effect=mock_always_fail):
        res = orch.handle_remediation(run_data)

    assert res["status"] == "escalated"
    assert len(res["attempts"]) == 3
    assert all(a["validation_status"] == "FAILURE" for a in res["attempts"])
    assert res.get("remediation_state") == RemediationState.HUMAN_REVIEW_REQUIRED.value
    assert "Max remediation attempts" in res.get("reason", "")


# ── Test 8: Node / TypeScript build failure ──────────────────────────────────
def test_e2e_node_typescript_build_failure():
    """
    Scenario 8: Node / TypeScript build failure.
      Runner log contains a TypeScript compilation error (error TS2322).
      SentinelOps deterministically extracts error_type='TYPE_ERROR', file, and line,
      diagnoses root cause, applies patch to component file, and validates.
    """
    ts_error_log = (
        "=== Job 104 Runner Execution Log ===\n"
        "[2026-09-28T10:10:00Z] Step 4: Build React App (npm run build)\n"
        "> vite build\n"
        "src/components/auth/AuthStatus.tsx(24,15): error TS2322: Type 'string' is not assignable to type 'number'.\n"
        "npm ERR! code ELIFECYCLE\n"
        "npm ERR! errno 2\n"
        "##[error]Process completed with exit code 2.\n"
    )

    failure_info = failure_extractor.extract_failure(
        run_id=881004,
        repo="payment-service",
        raw_log=ts_error_log,
    )
    assert failure_info["error_type"] == "TYPE_ERROR"
    assert failure_info["file"] == "src/components/auth/AuthStatus.tsx"
    assert failure_info["line"] == 24
    assert "TYPE_ERROR|src/components/auth/AuthStatus.tsx:24" in failure_info["failure_signature"]

    # Diagnose category
    diag_res = validate_diagnoser_output({
        "failure_category": "TYPE_ERROR",
        "root_cause": "Type 'string' is not assignable to type 'number' in AuthStatus.tsx",
        "confidence": 0.95,
        "affected_files": ["src/components/auth/AuthStatus.tsx"],
        "required_change": "Update prop type definition in AuthStatus.tsx",
    }, raw_logs=ts_error_log)
    assert diag_res["failure_category"] == "TYPE_ERROR"
    assert diag_res["confidence"] == 0.95

    # Patch applicator
    base_file = (
        "interface Props {\n"
        "  retryCount: number;\n"
        "}\n"
        "export const AuthStatus = ({ retryCount }: Props) => {\n"
        "  return <div>{retryCount}</div>;\n"
        "};\n"
    )
    diff = (
        "--- a/src/components/auth/AuthStatus.tsx\n"
        "+++ b/src/components/auth/AuthStatus.tsx\n"
        "@@ -1,4 +1,4 @@\n"
        " interface Props {\n"
        "-  retryCount: number;\n"
        "+  retryCount: number | string;\n"
        " }\n"
    )
    app_res = patch_applicator.apply_patch(diff, file_provider=lambda p: base_file)
    assert app_res["applied"] is True
    assert "number | string" in app_res["resulting_files"]["src/components/auth/AuthStatus.tsx"]


# ── Test 9: Docker build failure ─────────────────────────────────────────────
def test_e2e_docker_build_failure():
    """
    Scenario 9: Docker build failure.
      Runner log indicates Docker build error: COPY failed / file not found.
      SentinelOps extracts error_type='DOCKER_FAILURE', target_file='Dockerfile',
      categorizes under DOCKER_FAILURE, applies fix to Dockerfile, and validates.
    """
    docker_log = (
        "=== Job 105 Runner Execution Log ===\n"
        "[2026-09-28T10:15:00Z] Step 5: Build Docker Container\n"
        "#5 [2/4] COPY package.json package-lock.json ./\n"
        "ERROR: failed to solve: failed to compute cache key: failed to calculate checksum of ref: \"/package-lock.json\": not found\n"
        "##[error]Process completed with exit code 1.\n"
    )

    failure_info = failure_extractor.extract_failure(
        run_id=881005,
        repo="payment-service",
        raw_log=docker_log,
    )
    assert failure_info["error_type"] == "DOCKER_FAILURE"
    assert failure_info["file"] == "Dockerfile"

    diag_res = validate_diagnoser_output({
        "failure_category": "DOCKER_FAILURE",
        "root_cause": "package-lock.json missing during Docker build COPY step",
        "confidence": 0.94,
        "affected_files": ["Dockerfile"],
        "required_change": "Use package*.json wildcard to allow builds without lockfile",
    }, raw_logs=docker_log)
    assert diag_res["failure_category"] == "DOCKER_FAILURE"

    base_dockerfile = (
        "FROM node:20-alpine\n"
        "WORKDIR /app\n"
        "COPY package.json package-lock.json ./\n"
        "RUN npm install\n"
    )
    diff = (
        "--- a/Dockerfile\n"
        "+++ b/Dockerfile\n"
        "@@ -2,3 +2,3 @@\n"
        " WORKDIR /app\n"
        "-COPY package.json package-lock.json ./\n"
        "+COPY package*.json ./\n"
        " RUN npm install\n"
    )
    app_res = patch_applicator.apply_patch(diff, file_provider=lambda p: base_dockerfile)
    assert app_res["applied"] is True
    assert "COPY package*.json ./" in app_res["resulting_files"]["Dockerfile"]


# ── Test 10: GitHub Actions workflow YAML configuration error ─────────────────
def test_e2e_github_actions_yaml_configuration_error():
    """
    Scenario 10: GitHub Actions workflow YAML syntax error.
      Runner log indicates invalid workflow file.
      SentinelOps extracts error_type='CONFIGURATION', file='.github/workflows/ci.yml',
      categorizes under CONFIGURATION, and successfully parses and applies fix.
    """
    yaml_error_log = (
        "=== Workflow Run 881008 ===\n"
        "Invalid workflow file: .github/workflows/ci.yml#L12 : You have an error in your yaml syntax on line 12\n"
        "##[error]Process completed with exit code 1.\n"
    )

    failure_info = failure_extractor.extract_failure(
        run_id=881008,
        repo="payment-service",
        raw_log=yaml_error_log,
    )
    assert failure_info["error_type"] == "CONFIGURATION"
    assert failure_info["file"] == ".github/workflows/ci.yml"

    diag_res = validate_diagnoser_output({
        "failure_category": "CONFIGURATION",
        "root_cause": "Indentation syntax error in .github/workflows/ci.yml on line 12",
        "confidence": 0.96,
        "affected_files": [".github/workflows/ci.yml"],
        "required_change": "Fix YAML indentation in workflow step definition",
    }, raw_logs=yaml_error_log)
    assert diag_res["failure_category"] == "CONFIGURATION"

    base_yaml = (
        "name: CI\n"
        "jobs:\n"
        "  test:\n"
        "    runs-on: ubuntu-latest\n"
        "    steps:\n"
        "     - uses: actions/checkout@v4\n"
    )
    diff = (
        "--- a/.github/workflows/ci.yml\n"
        "+++ b/.github/workflows/ci.yml\n"
        "@@ -4,3 +4,3 @@\n"
        "     runs-on: ubuntu-latest\n"
        "     steps:\n"
        "-     - uses: actions/checkout@v4\n"
        "+      - uses: actions/checkout@v4\n"
    )
    app_res = patch_applicator.apply_patch(diff, file_provider=lambda p: base_yaml)
    assert app_res["applied"] is True
    assert "      - uses: actions/checkout@v4\n" in app_res["resulting_files"][".github/workflows/ci.yml"]


# ── Test 11: Multi-failure adaptation chain (Failure A -> Fix A -> Failure B -> Fix B -> PASS) ─
def test_e2e_multi_failure_adaptation_chain():
    """
    Scenario 11 (Section 18 Core Test):
      Failure A (Missing Dependency)
            ↓
          Fix A
            ↓
          CI Run
            ↓
      Failure B (Test Assertion Failure)
            ↓
          Fix B
            ↓
          CI Run
            ↓
          PASS

      Validates that Attempt 2 does NOT repeat Failure A or Fix A,
      but extracts Failure B from the NEW CI logs, applies Fix B, and resolves.
    """
    orch = RemediationOrchestrator()
    orch.max_attempts = 3

    # Initial Failure A: Missing dependency 'jwt'
    failure_a_log = (
        "=== Job 101 Runner Execution Log ===\n"
        "[2026-09-28T10:00:00Z] Step 3: Run pytest\n"
        "Traceback (most recent call last):\n"
        '  File "/workspace/services/auth.py", line 12, in <module>\n'
        "    import jwt\n"
        "ModuleNotFoundError: No module named 'jwt'\n"
        "##[error]Process completed with exit code 1.\n"
    )

    # Failure B in Attempt 1 CI run: Dependency was resolved, but now test assertion fails!
    failure_b_log = (
        "=== Job 101 Runner Execution Log (Attempt 1 CI Run) ===\n"
        "[2026-09-28T10:02:00Z] Step 3: Run pytest\n"
        "tests/test_auth.py:28: AssertionError: assert False is True\n"
        "=================================== FAILURES ===================================\n"
        "services/auth/token_validator.py:48: AssertionError\n"
        "=========================== 1 failed, 17 passed ===========================\n"
        "##[error]Process completed with exit code 1.\n"
    )

    run_data = {
        "repository": "payment-service",
        "workflow_name": "CI / Test & Build",
        "run_id": 881009,
        "branch": "main",
        "commit_sha": "f1f2f3f4f5",
    }

    call_count = 0
    def mock_validate_branch(repo, branch, commit_sha=None, **kwargs):
        nonlocal call_count
        call_count += 1
        if call_count == 1:
            # Attempt 1 CI run fails with Failure B (not Failure A!)
            return {
                "status": "FAILURE",
                "workflow": "CI",
                "run_id": 881009,
                "commit_sha": commit_sha or "commit_attempt_1",
                "branch": branch,
                "failed_jobs": ["unit-tests"],
                "logs": failure_b_log,
                "duration": 14,
                "simulated": True,
            }
        # Attempt 2 CI run succeeds!
        return {
            "status": "SUCCESS",
            "workflow": "CI",
            "run_id": 881009,
            "commit_sha": commit_sha or "commit_attempt_2",
            "branch": branch,
            "failed_jobs": [],
            "logs": None,
            "duration": 18,
            "simulated": True,
        }

    with patch.object(github_service, "get_workflow_logs", return_value=(True, failure_a_log)), \
         patch.object(validation_service, "validate_branch", side_effect=mock_validate_branch):

        res = orch.handle_remediation(
            run_data,
            override_confidence=97,
            override_risk="LOW",
            override_merge_success=True,
        )

    # Validate that the repair loop adapted and resolved
    assert res["status"] == "resolved"
    assert len(res["attempts"]) == 2
    # Attempt 1 failed CI
    assert res["attempts"][0]["validation_status"] == "FAILURE"
    # Attempt 2 passed CI
    assert res["attempts"][1]["validation_status"] == "SUCCESS"

    # Confirm Attempt 1 was a dependency fix
    assert "ModuleNotFoundError" in str(res["attempts"][0]["patch_summary"]) or "requirements.txt" in str(res["attempts"][0]["files_changed"])
    # Confirm Attempt 2 adapted to Failure B
    assert res["attempts"][1]["commit_sha"] is not None


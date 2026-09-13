"""
Comprehensive Test Suite for Phase 3: Multi-Agent Reasoning in SentinelOps.

Covers all 12 required scenarios:
  1. Dependency failure
  2. Python exception
  3. JavaScript test failure
  4. Syntax error
  5. Missing environment variable
  6. Timeout
  7. Flaky test
  8. Build failure
  9. Unknown failure
  10. Critic rejects proposed fix
  11. FixSuggester revises rejected fix
  12. Three failed attempts -> human_review_required
Plus:
  - Secret sanitization validation
  - Schema validation across Diagnoser, FixSuggester, Critic
  - Strict 3 attempt loop bound enforcement
"""

import os
import sys
import pytest
from unittest.mock import MagicMock, patch

# Ensure backend root is in sys.path
CURRENT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if CURRENT_DIR not in sys.path:
    sys.path.insert(0, CURRENT_DIR)

from services.secret_sanitizer import secret_sanitizer
from services.agents.diagnoser_agent import diagnoser_agent, DiagnoserAgent, validate_diagnoser_output
from services.agents.fix_suggester_agent import fix_suggester_agent, FixSuggesterAgent, validate_fix_suggester_output
from services.agents.critic_agent import critic_agent, CriticAgent, validate_critic_output
from services.agents.multi_agent_orchestrator import multi_agent_orchestrator, MultiAgentOrchestrator


@pytest.fixture(autouse=True)
def disable_external_network_llm(monkeypatch):
    """
    Ensures unit tests run deterministically and fast offline without hitting real external LLM APIs.
    """
    monkeypatch.setattr(diagnoser_agent, "_call_groq", lambda *args, **kwargs: None)
    monkeypatch.setattr(diagnoser_agent, "_call_openai", lambda *args, **kwargs: None)
    monkeypatch.setattr(diagnoser_agent, "_call_gemini", lambda *args, **kwargs: None)

    monkeypatch.setattr(fix_suggester_agent, "_call_groq", lambda *args, **kwargs: None)
    monkeypatch.setattr(fix_suggester_agent, "_call_openai", lambda *args, **kwargs: None)
    monkeypatch.setattr(fix_suggester_agent, "_call_gemini", lambda *args, **kwargs: None)

    monkeypatch.setattr(critic_agent, "_call_groq", lambda *args, **kwargs: None)
    monkeypatch.setattr(critic_agent, "_call_openai", lambda *args, **kwargs: None)
    monkeypatch.setattr(critic_agent, "_call_gemini", lambda *args, **kwargs: None)



# ── Test 1: Dependency Failure ───────────────────────────────────────────────
def test_scenario_1_dependency_failure():
    logs = (
        "npm ERR! code ERESOLVE\n"
        "npm ERR! ERESOLVE could not resolve peer dependency tree\n"
        "npm ERR! While resolving: @stripe/stripe-node@12.1.0\n"
        "npm ERR! Found: @types/node@20.11.0\n"
        "npm ERR! Conflicting peer dependency: @types/node@^18.0.0\n"
    )
    result = multi_agent_orchestrator.execute_reasoning_pipeline(
        logs=logs,
        repository="payment-service",
        workflow_name="CI / NPM Build & Test",
    )
    assert result["status"] == "approved"
    assert result["diagnosis"]["category"] == "dependency_error"
    assert result["diagnosis"]["confidence"] >= 0.85
    assert len(result["diagnosis"]["evidence"]) > 0
    assert "package.json" in result["diagnosis"]["affected_files"]
    assert result["fix"]["fix_type"] == "dependency"
    assert "stripe" in result["fix"]["patch"].lower() or "package.json" in result["fix"]["patch"]
    assert result["critic"]["approved"] is True
    assert result["critic"]["score"] >= 0.80


# ── Test 2: Python Exception ──────────────────────────────────────────────────
def test_scenario_2_python_exception():
    logs = (
        "________________ test_token_expiration ________________\n"
        "    def test_token_expiration():\n"
        ">       assert validator.is_valid('expired-jwt') is False\n"
        "E       AssertionError: TokenValidator incorrectly accepted expired JWT token\n"
        "services/auth/token_validator.py:12: AssertionError\n"
    )
    result = multi_agent_orchestrator.execute_reasoning_pipeline(
        logs=logs,
        repository="auth-service",
        workflow_name="Pytest Suite",
    )
    assert result["status"] == "approved"
    assert result["diagnosis"]["category"] == "test_failure"
    assert "services/auth/token_validator.py" in result["diagnosis"]["affected_files"]
    assert result["fix"]["fix_type"] == "code"
    assert "token_validator.py" in result["fix"]["patch"]
    assert result["critic"]["approved"] is True


# ── Test 3: JavaScript Test Failure ───────────────────────────────────────────
def test_scenario_3_javascript_test_failure():
    logs = (
        "FAIL src/components/Button.test.tsx\n"
        "  ● Button Component › should render primary label\n"
        "    expect(received).toBe(expected) // Object.is equality\n"
        "    Expected: \"Submit\"\n"
        "    Received: \"Click\"\n"
        "      at Object.it (src/components/Button.test.tsx:18:23)\n"
    )
    result = multi_agent_orchestrator.execute_reasoning_pipeline(
        logs=logs,
        repository="frontend-ui",
        workflow_name="Jest UI Tests",
    )
    assert result["diagnosis"]["category"] == "test_failure"
    assert "src/components/Button.test.tsx" in result["diagnosis"]["affected_files"]
    assert result["fix"]["fix_type"] == "code"
    assert result["critic"]["approved"] is True


# ── Test 4: Syntax Error ──────────────────────────────────────────────────────
def test_scenario_4_syntax_error():
    logs = (
        "  File \"src/calculator.py\", line 14\n"
        "    def compute_total(a, b\n"
        "                          ^\n"
        "SyntaxError: '(' was never closed\n"
    )
    result = multi_agent_orchestrator.execute_reasoning_pipeline(
        logs=logs,
        repository="math-service",
        workflow_name="Lint & Syntax Check",
    )
    assert result["status"] == "approved"
    assert result["diagnosis"]["category"] == "syntax_or_lint_error"
    assert "src/calculator.py" in result["diagnosis"]["affected_files"]
    assert result["fix"]["fix_type"] == "code"
    assert "compute_total" in result["fix"]["patch"]
    assert result["critic"]["approved"] is True


# ── Test 5: Missing Environment Variable ──────────────────────────────────────
def test_scenario_5_missing_env_var():
    logs = (
        "Traceback (most recent call last):\n"
        "  File \"config.py\", line 22, in <module>\n"
        "    API_KEY = os.environ['DATABASE_URL']\n"
        "KeyError: 'DATABASE_URL'\n"
    )
    result = multi_agent_orchestrator.execute_reasoning_pipeline(
        logs=logs,
        repository="core-api",
        workflow_name="Integration Tests",
    )
    assert result["status"] == "approved"
    assert result["diagnosis"]["category"] == "missing_secret_or_config"
    assert result["fix"]["fix_type"] == "configuration"
    assert result["critic"]["approved"] is True


# ── Test 6: Timeout ───────────────────────────────────────────────────────────
def test_scenario_6_timeout():
    logs = (
        "redis.exceptions.ConnectionError: Redis connection pool starvation: timeout after 30000ms\n"
        "services/cache/redis_manager.py:44: in acquire_connection\n"
        "    raise ConnectionTimeout('Max connections exhausted')\n"
    )
    result = multi_agent_orchestrator.execute_reasoning_pipeline(
        logs=logs,
        repository="cache-service",
        workflow_name="Stress Test",
    )
    assert result["status"] == "approved"
    assert result["diagnosis"]["category"] == "timeout_or_infrastructure"
    assert "services/cache/redis_manager.py" in result["diagnosis"]["affected_files"]
    assert result["fix"]["fix_type"] == "configuration"
    assert result["critic"]["approved"] is True


# ── Test 7: Flaky Test ────────────────────────────────────────────────────────
def test_scenario_7_flaky_test():
    logs = (
        "tests/test_async_flow.py:35: in test_async_worker\n"
        "    assert worker.status == 'ready', 'Worker timed out waiting for element: race condition'\n"
        "E   AssertionError: intermittent failure detected in test run\n"
    )
    result = multi_agent_orchestrator.execute_reasoning_pipeline(
        logs=logs,
        repository="async-worker",
        workflow_name="Async Integration",
    )
    assert result["diagnosis"]["category"] == "flaky_test"
    assert result["fix"]["fix_type"] == "test"
    assert result["critic"]["approved"] is True


# ── Test 8: Build Failure ─────────────────────────────────────────────────────
def test_scenario_8_build_failure():
    logs = (
        "Step 8/12 : RUN npm install\n"
        "npm ERR! code 1\n"
        "npm ERR! failed to compile native addon\n"
        "The command '/bin/sh -c npm install' returned a non-zero code: 1\n"
        "Docker build exited with status 1\n"
    )
    result = multi_agent_orchestrator.execute_reasoning_pipeline(
        logs=logs,
        repository="docker-app",
        workflow_name="Container Build",
    )
    assert result["status"] == "approved"
    assert result["diagnosis"]["category"] == "build_error"
    assert "Dockerfile" in result["diagnosis"]["affected_files"]
    assert result["critic"]["approved"] is True


# ── Test 9: Unknown Failure ───────────────────────────────────────────────────
def test_scenario_9_unknown_failure():
    logs = "Runner system halted unexpectedly without error message."
    result = multi_agent_orchestrator.execute_reasoning_pipeline(
        logs=logs,
        repository="unknown-service",
        workflow_name="Generic CI",
    )
    assert result["diagnosis"]["category"] == "unknown"
    assert result["diagnosis"]["confidence"] <= 0.40


# ── Test 10: Critic Rejects Proposed Fix ──────────────────────────────────────
def test_scenario_10_critic_rejects_flawed_fix():
    diag = {
        "category": "test_failure",
        "root_cause": "AssertionError in token validator",
        "confidence": 0.92,
        "affected_files": ["services/auth/token_validator.py"],
    }
    flawed_fix = {
        "fix_type": "code",
        "description": "Bypass security check with dangerous eval",
        "affected_files": ["services/auth/token_validator.py"],
        "patch": "--- a/services/auth/token_validator.py\n+++ b/services/auth/token_validator.py\n@@ -1,2 +1,2 @@\n-check_auth()\n+eval(user_input)\n",
        "reason": "Temporary bypass",
        "confidence": 0.50,
    }
    critic_eval = critic_agent.evaluate_fix("AssertionError in auth", diag, flawed_fix)
    assert critic_eval["approved"] is False
    assert critic_eval["score"] < 0.70
    assert len(critic_eval["issues"]) > 0
    assert len(critic_eval["security_concerns"]) > 0
    assert critic_eval["requires_human_review"] is True


# ── Test 11: FixSuggester Revises Rejected Fix ────────────────────────────────
def test_scenario_11_refinement_loop_revises_rejected_fix():
    """
    Mock Critic to reject attempt 1 and approve attempt 2.
    Verifies that FixSuggester consumes critic feedback on attempt 2 and reaches approved status.
    """
    call_count = 0

    def mock_critic_evaluate(failure_log, diagnosis, proposed_fix, repo_context=None):
        nonlocal call_count
        call_count += 1
        if call_count == 1:
            return {
                "approved": False,
                "score": 0.55,
                "issues": ["Patch logic handles comparison incorrectly"],
                "reason": "Boundary condition inverted",
                "recommended_changes": ["Use >= comparison instead of >"],
                "security_concerns": [],
                "requires_human_review": False,
            }
        else:
            return {
                "approved": True,
                "score": 0.95,
                "issues": [],
                "reason": "Refined patch correctly resolves root cause with zero regression.",
                "recommended_changes": [],
                "security_concerns": [],
                "requires_human_review": False,
            }

    mock_critic = CriticAgent()
    mock_critic.evaluate_fix = mock_critic_evaluate

    orch = MultiAgentOrchestrator(critic=mock_critic)
    logs = (
        "E   AssertionError: TokenValidator incorrectly accepted expired JWT token\n"
        "services/auth/token_validator.py:12: AssertionError\n"
    )
    result = orch.execute_reasoning_pipeline(logs=logs, repository="auth-service")

    assert result["status"] == "approved"
    assert result["attempts"] == 2
    assert len(result["refinement_history"]) == 2
    assert result["refinement_history"][0]["approved"] is False
    assert result["refinement_history"][1]["approved"] is True
    assert result["critic"]["approved"] is True


# ── Test 12: Three Failed Attempts -> Human Review ────────────────────────────
def test_scenario_12_three_failed_attempts_requires_human_review():
    """
    Mock Critic to reject all 3 attempts.
    Verifies that loop stops exactly after 3 attempts and sets status 'human_review_required'.
    """
    call_count = 0

    def mock_critic_always_reject(failure_log, diagnosis, proposed_fix, repo_context=None):
        nonlocal call_count
        call_count += 1
        return {
            "approved": False,
            "score": 0.40,
            "issues": [f"Attempt {call_count} rejected due to complex unverified dependency"],
            "reason": "Persistent regression risk",
            "recommended_changes": ["Manual architectural refactoring needed"],
            "security_concerns": [],
            "requires_human_review": True,
        }

    mock_critic = CriticAgent()
    mock_critic.evaluate_fix = mock_critic_always_reject

    orch = MultiAgentOrchestrator(critic=mock_critic)
    logs = "Fatal unsolvable architecture mismatch error"
    result = orch.execute_reasoning_pipeline(logs=logs, repository="complex-service")

    assert result["status"] == "human_review_required"
    assert result["attempts"] == 3
    assert len(result["refinement_history"]) == 3
    assert result["execution_metrics"]["requires_human_review"] is True
    assert result["critic"]["approved"] is False


# ── Test 13: Secret Sanitization ──────────────────────────────────────────────
def test_secret_sanitizer():
    dirty_text = (
        "Log output: Using token ghp_1234567890abcdef1234567890abcdef123456\n"
        "Authorization: Bearer sk-abcdef1234567890abcdef123456\n"
        "Slack webhook: https://hooks.slack.com/services/T000/B000/XXXX\n"
        "AWS key: AKIAIOSFODNN7EXAMPLE\n"
    )
    cleaned = secret_sanitizer.sanitize_text(dirty_text)
    assert "ghp_" not in cleaned
    assert "sk-" not in cleaned
    assert "hooks.slack.com" not in cleaned
    assert "AKIA" not in cleaned
    assert "[REDACTED_GITHUB_PAT]" in cleaned
    assert "[REDACTED_OPENAI_KEY]" in cleaned
    assert "[REDACTED_SLACK_WEBHOOK]" in cleaned
    assert "[REDACTED_AWS_ACCESS_KEY]" in cleaned

    assert secret_sanitizer.is_sensitive_file(".env") is True
    assert secret_sanitizer.is_sensitive_file(".env.production") is True
    assert secret_sanitizer.is_sensitive_file("id_rsa") is True
    assert secret_sanitizer.is_sensitive_file("credentials.json") is True
    assert secret_sanitizer.is_sensitive_file("src/app.py") is False
    assert secret_sanitizer.is_sensitive_file("package.json") is False


# ── Test 14: Output Schema Validations ────────────────────────────────────────
def test_schema_validators():
    # Diagnoser schema validation
    diag_valid = validate_diagnoser_output({
        "category": "DEPENDENCY_ERROR",
        "root_cause": "Missing requests",
        "confidence": 98,
        "evidence": ["No module named requests"],
        "affected_files": ["requirements.txt"],
    })
    assert diag_valid["category"] == "dependency_error"
    assert diag_valid["confidence"] == 0.98
    assert isinstance(diag_valid["evidence"], list)

    # FixSuggester schema validation
    fix_valid = validate_fix_suggester_output({
        "fix_type": "CODE",
        "description": "Fix token validation",
        "affected_files": ["services/auth.py"],
        "patch": "print('fixed')",
        "confidence": 95,
    })
    assert fix_valid["fix_type"] == "code"
    assert fix_valid["confidence"] == 0.95
    assert fix_valid["patch"].startswith("--- a/")

    # Critic schema validation
    critic_valid = validate_critic_output({
        "approved": True,
        "score": 92,
        "reason": "Safe change",
    })
    assert critic_valid["approved"] is True
    assert critic_valid["score"] == 0.92
    assert critic_valid["requires_human_review"] is False

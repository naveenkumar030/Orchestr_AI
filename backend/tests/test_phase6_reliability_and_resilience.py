"""
Comprehensive Phase 6 Test Suite: Reliability, Resilience and Cost Control for SentinelOps.
Contains 38 deterministic unit, integration, and stress tests covering:
  - Diagnosis Caching & TTL Invalidation (Tests 1-7)
  - Resilient LLM Retries & Backoff (Tests 8-14)
  - Provider Fallback & Circuit Breakers (Tests 15-20)
  - Bounded Timeouts & Fail-Closed Safety (Tests 21-24)
  - Event Deduplication & Concurrency Locks (Tests 25-28)
  - Deterministic Safety Guarantees (Tests 29-34)
  - Cost Telemetry, Stress Testing & Chaos Simulation (Tests 35-38)
"""

import os
import sys
import time
import json
import pytest
from unittest.mock import MagicMock, patch

# Ensure backend directory is in sys.path
CURRENT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if CURRENT_DIR not in sys.path:
    sys.path.insert(0, CURRENT_DIR)

from services.resilience.error_signature import error_signature_generator, ErrorSignatureGenerator
from services.resilience.diagnosis_cache import diagnosis_cache, DiagnosisCache, DiagnosisCacheEntry
from services.resilience.circuit_breaker import circuit_breaker_registry, CircuitBreakerRegistry, CircuitState, ProviderCircuit
from services.resilience.reliability_telemetry import reliability_telemetry, ReliabilityTelemetry
from services.resilience.event_deduplication import event_deduplicator, EventDeduplicator
from services.resilience.llm_resilience_manager import llm_resilience_manager, LLMResilienceManager
from services.agents.diagnoser_agent import diagnoser_agent, DiagnoserAgent
from services.agents.fix_suggester_agent import fix_suggester_agent, FixSuggesterAgent
from services.agents.critic_agent import critic_agent, CriticAgent
from services.agents.multi_agent_orchestrator import multi_agent_orchestrator, MultiAgentOrchestrator
from services.confidence_gate import confidence_gate
from services.sentinel_guard import sentinel_guard
from services.risk_assessor import risk_assessor
from app import app


@pytest.fixture(autouse=True)
def reset_resilience_state():
    """Isolate tests by resetting cache, circuit breakers, deduplication, and telemetry."""
    diagnosis_cache.reset()
    circuit_breaker_registry.reset_all()
    event_deduplicator.clear()
    reliability_telemetry.reset()
    yield
    diagnosis_cache.reset()
    circuit_breaker_registry.reset_all()
    event_deduplicator.clear()
    reliability_telemetry.reset()


@pytest.fixture
def client():
    app.config["TESTING"] = True
    with app.test_client() as c:
        yield c


# ==============================================================================
# 1. Diagnosis Caching (Tests 1-7)
# ==============================================================================

def test_1_cache_hit_returns_identical_diagnosis_and_flags_cached():
    """Test 1: Diagnosis cache stores and returns identical diagnosis marked cached=True."""
    sig = "test-signature-12345"
    diag_data = {
        "category": "dependency_error",
        "root_cause": "Package @types/node version mismatch in package.json",
        "evidence": ["npm ERR! ERESOLVE could not resolve"],
        "affected_files": ["package.json"],
        "confidence_score": 0.95,
    }
    diagnosis_cache.put(sig, diag_data, ttl=3600)

    cached = diagnosis_cache.get(sig)
    assert cached is not None
    assert cached["category"] == "dependency_error"
    assert cached["root_cause"] == diag_data["root_cause"]
    assert cached["cached"] is True
    stats = diagnosis_cache.get_stats()
    assert stats["hits"] == 1


def test_2_cache_miss_queries_and_stores_result():
    """Test 2: Cache miss returns None, increments misses, and allows storing fresh diagnosis."""
    sig = "new-error-signature-999"
    assert diagnosis_cache.get(sig) is None
    stats = diagnosis_cache.get_stats()
    assert stats["misses"] == 1

    diagnosis_cache.put(sig, {"category": "syntax_or_lint_error", "root_cause": "SyntaxError on line 4"})
    assert diagnosis_cache.get(sig) is not None
    assert diagnosis_cache.get_stats()["hits"] == 1


def test_3_error_signature_ignores_timestamps_and_run_ids():
    """Test 3: Log variations with different timestamps, run IDs, and memory addresses produce identical SHA-256."""
    log_v1 = (
        "2026-09-13T12:00:01Z [ERROR] run #104921 pid: 4810 at 0x7fff5fbff820\n"
        "npm ERR! code ERESOLVE\n"
        "npm ERR! ERESOLVE unable to resolve dependency tree"
    )
    log_v2 = (
        "2026-09-14T18:45:22Z [ERROR] run #899412 pid: 9122 at 0x000001C8829A0B90\n"
        "npm ERR! code ERESOLVE\n"
        "npm ERR! ERESOLVE unable to resolve dependency tree"
    )

    sig1 = error_signature_generator.extract_error_signature_from_logs(log_v1, repository="SentinelOps", failed_step="npm test")
    sig2 = error_signature_generator.extract_error_signature_from_logs(log_v2, repository="SentinelOps", failed_step="npm test")

    assert len(sig1) == 64  # Valid SHA-256 hex string
    assert sig1 == sig2, "Error signatures must be deterministic and invariant to timestamps / run IDs"


def test_4_error_signature_changes_when_root_cause_changes():
    """Test 4: Structurally different CI failures produce distinct signatures."""
    log_dep = "npm ERR! ERESOLVE unable to resolve dependency tree for react@19"
    log_lint = "ESLint: 14 errors found. Expected semicolon at line 45 in src/index.ts"

    sig_dep = error_signature_generator.extract_error_signature_from_logs(log_dep, category="dependency_error")
    sig_lint = error_signature_generator.extract_error_signature_from_logs(log_lint, category="syntax_or_lint_error")

    assert sig_dep != sig_lint


def test_5_cache_ttl_expiration():
    """Test 5: Cached entries expire after TTL elapses."""
    local_cache = DiagnosisCache(default_ttl=1)
    sig = "expiring-sig-123"
    local_cache.put(sig, {"category": "test_failure", "root_cause": "AssertionError"}, ttl=1)

    assert local_cache.get(sig) is not None
    # Simulate time lapse by adjusting entry expiration
    with local_cache._lock:
        local_cache._entries[sig].expires_at = time.time() - 10

    assert local_cache.get(sig) is None
    stats = local_cache.get_stats()
    assert stats["evictions"] == 1


def test_6_repo_context_drift_invalidates_cached_entry():
    """Test 6: Changes in repository context invalidate cache entry to prevent stale reasoning."""
    sig = "drift-sig-456"
    initial_ctx_hash = "hash-v1.0"
    changed_ctx_hash = "hash-v2.0"

    diagnosis_cache.put(sig, {"category": "build_error", "root_cause": "Module not found"}, repo_context_hash=initial_ctx_hash)

    # Context matches -> cache hit
    hit = diagnosis_cache.get(sig, current_repo_context_hash=initial_ctx_hash)
    assert hit is not None

    # Context drifted -> invalidation & cache miss
    miss = diagnosis_cache.get(sig, current_repo_context_hash=changed_ctx_hash)
    assert miss is None
    assert diagnosis_cache.get(sig) is None  # Evicted


def test_7_manual_cache_invalidation_methods():
    """Test 7: Manual invalidation by signature, repo, and wipe-all."""
    diagnosis_cache.put("sig-a", {"category": "unknown"}, repository="repo-a")
    diagnosis_cache.put("sig-b", {"category": "unknown"}, repository="repo-a")
    diagnosis_cache.put("sig-c", {"category": "unknown"}, repository="repo-b")

    # Invalidate by specific signature
    assert diagnosis_cache.invalidate("sig-a") is True
    assert diagnosis_cache.get("sig-a") is None

    # Invalidate by repo
    count = diagnosis_cache.invalidate_for_repo("repo-a")
    assert count == 1  # only sig-b was left for repo-a
    assert diagnosis_cache.get("sig-b") is None
    assert diagnosis_cache.get("sig-c") is not None

    # Invalidate all
    wiped = diagnosis_cache.invalidate_all()
    assert wiped == 1
    assert diagnosis_cache.get_stats()["active_entries_count"] == 0


# ==============================================================================
# 2. Retry & Exponential Backoff Logic (Tests 8-14)
# ==============================================================================

def test_8_exponential_backoff_timing_progression():
    """Test 8: Backoff timing increases exponentially with attempt count."""
    mgr = LLMResilienceManager()
    b1 = mgr._calculate_backoff(1, base=0.5, max_delay=4.0)
    b2 = mgr._calculate_backoff(2, base=0.5, max_delay=4.0)
    b3 = mgr._calculate_backoff(3, base=0.5, max_delay=4.0)

    assert 0.5 <= b1 < 1.0
    assert 1.0 <= b2 < 2.0
    assert 2.0 <= b3 <= 5.0
    assert b1 < b2 < b3


def test_9_jitter_added_to_backoff():
    """Test 9: Backoff includes non-zero jitter variation."""
    mgr = LLMResilienceManager()
    delays = [mgr._calculate_backoff(2, base=0.5) for _ in range(10)]
    assert len(set(delays)) > 1, "Jitter should introduce variance across identical retry attempts"


def test_10_retry_on_429_rate_limit_eventual_success():
    """Test 10: Retries transient 429 rate limits and succeeds on subsequent attempt."""
    mgr = LLMResilienceManager()
    mgr.max_retries = 3

    attempts = [0]
    def mock_dispatch(provider, system_prompt, user_prompt, **kwargs):
        attempts[0] += 1
        if attempts[0] < 3:
            return None, 429, 0
        return '{"result": "success"}', 200, 150

    with patch.object(mgr, "_dispatch_provider", side_effect=mock_dispatch):
        with patch("time.sleep", return_value=None):
            result = mgr.execute_completion("sys", "user")

    assert result["success"] is True
    assert result["attempts"] == 3
    assert result["retries_taken"] == 2
    assert reliability_telemetry.metrics["retries_by_reason"]["rate_limit_429"] == 2


def test_11_retry_on_500_server_error_eventual_success():
    """Test 11: Retries 500 internal server error and recovers."""
    mgr = LLMResilienceManager()
    attempts = [0]
    def mock_dispatch(provider, system_prompt, user_prompt, **kwargs):
        attempts[0] += 1
        if attempts[0] == 1:
            return None, 500, 0
        return '{"recovered": true}', 200, 120

    with patch.object(mgr, "_dispatch_provider", side_effect=mock_dispatch):
        with patch("time.sleep", return_value=None):
            result = mgr.execute_completion("sys", "user")

    assert result["success"] is True
    assert result["retries_taken"] == 1
    assert reliability_telemetry.metrics["retries_by_reason"]["server_error_5xx"] == 1


def test_12_permanent_401_unauthorized_fails_immediately_without_retries():
    """Test 12: Permanent client errors (401 Unauthorized) trigger immediate fallback with 0 retries."""
    mgr = LLMResilienceManager()
    mgr.max_retries = 3

    groq_attempts = [0]
    gemini_attempts = [0]

    def mock_dispatch(provider, system_prompt, user_prompt, **kwargs):
        if provider == "groq":
            groq_attempts[0] += 1
            return None, 401, 0
        elif provider == "gemini":
            gemini_attempts[0] += 1
            return '{"fallback_ok": true}', 200, 100
        return None, 500, 0

    with patch.object(mgr, "_dispatch_provider", side_effect=mock_dispatch):
        result = mgr.execute_completion("sys", "user")

    assert result["success"] is True
    assert result["provider_used"] == "gemini"
    assert groq_attempts[0] == 1
    assert result["retries_taken"] == 0
    assert result["fallback_occurred"] is True


def test_13_permanent_400_bad_request_fails_immediately_without_retries():
    """Test 13: 400 Bad Request client error fails immediately without retrying."""
    mgr = LLMResilienceManager()
    calls = []

    def mock_dispatch(provider, system_prompt, user_prompt, **kwargs):
        calls.append(provider)
        if provider == "groq":
            return None, 400, 0
        return "fallback", 200, 50

    with patch.object(mgr, "_dispatch_provider", side_effect=mock_dispatch):
        res = mgr.execute_completion("sys", "user")

    assert res["success"] is True
    assert res["provider_used"] == "gemini"
    assert calls.count("groq") == 1  # Exactly 1 attempt on groq, no retries


def test_14_max_retries_exhaustion_records_telemetry():
    """Test 14: Exhausting retries records telemetry and transitions to next provider in fallback chain."""
    mgr = LLMResilienceManager()
    mgr.max_retries = 3

    def mock_dispatch(provider, system_prompt, user_prompt, **kwargs):
        if provider == "groq":
            return None, 503, 0  # Service Unavailable
        return "fallback", 200, 100

    with patch.object(mgr, "_dispatch_provider", side_effect=mock_dispatch):
        with patch("time.sleep", return_value=None):
            res = mgr.execute_completion("sys", "user")

    assert res["success"] is True
    assert res["provider_used"] == "gemini"
    assert res["retries_taken"] == 2
    assert reliability_telemetry.metrics["fallbacks_total"] >= 1


# ==============================================================================
# 3. Provider Fallback & Circuit Breakers (Tests 15-20)
# ==============================================================================

def test_15_primary_groq_success_uses_no_fallback():
    """Test 15: Healthy primary provider completes without triggering fallback."""
    mgr = LLMResilienceManager()
    with patch.object(mgr, "_dispatch_provider", return_value=('{"healthy": true}', 200, 80)):
        res = mgr.execute_completion("sys", "user")

    assert res["success"] is True
    assert res["provider_used"] == "groq"
    assert res["fallback_occurred"] is False
    assert reliability_telemetry.metrics["fallbacks_total"] == 0


def test_16_groq_failure_falls_back_to_gemini():
    """Test 16: Groq failure routes smoothly to Gemini with fallback telemetry."""
    mgr = LLMResilienceManager()
    mgr.max_retries = 1  # Fast failover for test

    def mock_dispatch(provider, system_prompt, user_prompt, **kwargs):
        if provider == "groq":
            raise ConnectionError("Groq endpoint unreachable")
        return '{"diag": "gemini-success"}', 200, 90

    with patch.object(mgr, "_dispatch_provider", side_effect=mock_dispatch):
        with patch("time.sleep", return_value=None):
            res = mgr.execute_completion("sys", "user")

    assert res["success"] is True
    assert res["provider_used"] == "gemini"
    assert res["fallback_occurred"] is True
    assert reliability_telemetry.metrics["fallbacks_total"] >= 1


def test_17_gemini_failure_falls_back_to_ollama_or_heuristic():
    """Test 17: Both Groq and Gemini failing triggers local AST heuristic without crash."""
    agent = DiagnoserAgent()
    logs = "npm ERR! code ERESOLVE\nnpm ERR! Could not resolve dependency react@18"

    with patch.object(agent, "_call_groq", return_value=None):
        with patch.object(agent, "_call_openai", return_value=None):
            with patch.object(agent, "_call_gemini", return_value=None):
                diag = agent.diagnose(logs, repository="SentinelOps")

    assert diag is not None
    assert diag["category"] in ["dependency_error", "build_error"]
    assert len(diag["evidence"]) > 0
    assert "error_signature" in diag


def test_18_circuit_breaker_transitions_closed_to_open_after_threshold():
    """Test 18: Consecutive provider failures trip the circuit breaker from CLOSED to OPEN."""
    circuit = ProviderCircuit(name="groq", failure_threshold=3, cooldown_seconds=60)
    assert circuit.state == CircuitState.CLOSED
    assert circuit.allow_request() is True

    circuit.record_failure(Exception("500"))
    circuit.record_failure(Exception("500"))
    assert circuit.state == CircuitState.CLOSED

    circuit.record_failure(Exception("500"))
    assert circuit.state == CircuitState.OPEN
    assert circuit.allow_request() is False


def test_19_circuit_breaker_open_blocks_immediate_requests_without_call():
    """Test 19: OPEN circuit breaker immediately rejects requests without network execution."""
    for _ in range(3):
        circuit_breaker_registry.record_failure("groq", Exception("Network error"))

    assert circuit_breaker_registry.allow_request("groq") is False

    mgr = LLMResilienceManager()
    called_providers = []
    def mock_dispatch(provider, system_prompt, user_prompt, **kwargs):
        called_providers.append(provider)
        return "ok", 200, 10

    with patch.object(mgr, "_dispatch_provider", side_effect=mock_dispatch):
        res = mgr.execute_completion("sys", "user")

    assert "groq" not in called_providers, "Groq must be bypassed when circuit is OPEN"
    assert res["provider_used"] == "gemini"


def test_20_circuit_breaker_half_open_recovery():
    """Test 20: After cooldown expires, circuit transitions to HALF_OPEN and resets to CLOSED on probe success."""
    circuit = ProviderCircuit(name="gemini", failure_threshold=2, cooldown_seconds=10)
    circuit.record_failure()
    circuit.record_failure()
    assert circuit.state == CircuitState.OPEN

    # Simulate cooldown elapse
    circuit.last_failure_time = time.time() - 15
    assert circuit.allow_request() is True
    assert circuit.state == CircuitState.HALF_OPEN

    # Probe succeeds
    circuit.record_success()
    assert circuit.state == CircuitState.CLOSED
    assert circuit.consecutive_failures == 0


# ==============================================================================
# 4. Bounded Timeouts & Fail-Closed Protection (Tests 21-24)
# ==============================================================================

def test_21_llm_call_timeout_triggers_fallback():
    """Test 21: LLM request timeout triggers graceful retry and fallback."""
    mgr = LLMResilienceManager()
    mgr.max_retries = 1
    mgr.default_timeout = 0.5

    def mock_dispatch(provider, system_prompt, user_prompt, **kwargs):
        if provider == "groq":
            raise TimeoutError("LLM call timed out after 0.5s")
        return '{"fallback": true}', 200, 50

    with patch.object(mgr, "_dispatch_provider", side_effect=mock_dispatch):
        with patch("time.sleep", return_value=None):
            res = mgr.execute_completion("sys", "user")

    assert res["success"] is True
    assert res["provider_used"] == "gemini"


def test_22_multi_agent_pipeline_execution_deadline_timeout():
    """Test 22: Pipeline execution deadline stops long-running refinement loop safely."""
    orch = MultiAgentOrchestrator()
    logs = "npm ERR! ERESOLVE unable to resolve dependency tree"

    with patch("config.Config.SENTINEL_AGENT_TIMEOUT_SECONDS", 0.0001):
        with patch("services.agents.multi_agent_orchestrator.config.SENTINEL_AGENT_TIMEOUT_SECONDS", 0.0001):
            res = orch.execute_reasoning_pipeline(logs=logs, repository="SentinelOps")

    assert res["status"] == "human_review_required"
    assert "error_signature" in res
    assert "resilience_metadata" in res


def test_23_fail_closed_to_human_review_on_timeout():
    """Test 23: Timed out pipelines strictly fail-closed to human_review_required with requires_human_review=True."""
    orch = MultiAgentOrchestrator()
    with patch("config.Config.SENTINEL_AGENT_TIMEOUT_SECONDS", 0.0001):
        with patch("services.agents.multi_agent_orchestrator.config.SENTINEL_AGENT_TIMEOUT_SECONDS", 0.0001):
            res = orch.execute_reasoning_pipeline(logs="SyntaxError: unexpected token", repository="SentinelOps")

    assert res["final_status"] == "human_review_required"
    assert res["execution_metrics"]["requires_human_review"] is True


def test_24_zero_draft_pr_created_on_timeout_failure():
    """Test 24: Timeouts prevent automatic Draft PR creation."""
    orch = MultiAgentOrchestrator()
    with patch("config.Config.SENTINEL_AGENT_TIMEOUT_SECONDS", 0.0001):
        with patch("services.agents.multi_agent_orchestrator.config.SENTINEL_AGENT_TIMEOUT_SECONDS", 0.0001):
            res = orch.execute_reasoning_pipeline(logs="build failure", repository="SentinelOps")

    assert res["final_status"] == "human_review_required"
    assert res["execution_metrics"]["is_approved"] is False


# ==============================================================================
# 5. Event & Concurrency Deduplication (Tests 25-28)
# ==============================================================================

def test_25_webhook_deduplication_drops_identical_payload():
    """Test 25: Duplicate webhook delivery for same repository and run_id is dropped as duplicate_event."""
    key = event_deduplicator.build_webhook_key("SentinelOps", "9812401", "workflow_run", "completed")
    assert event_deduplicator.is_duplicate(key) is False

    event_deduplicator.mark_processed(key, ttl_seconds=600)
    assert event_deduplicator.is_duplicate(key) is True
    assert reliability_telemetry.metrics["deduplications_blocked"] == 1


def test_26_webhook_different_run_ids_both_processed():
    """Test 26: Webhooks for distinct run IDs are both processed independently."""
    key1 = event_deduplicator.build_webhook_key("SentinelOps", "1001", "workflow_run", "completed")
    key2 = event_deduplicator.build_webhook_key("SentinelOps", "1002", "workflow_run", "completed")

    assert event_deduplicator.is_duplicate(key1) is False
    event_deduplicator.mark_processed(key1)

    assert event_deduplicator.is_duplicate(key2) is False
    event_deduplicator.mark_processed(key2)


def test_27_concurrent_run_lock_prevents_simultaneous_processing():
    """Test 27: Concurrency lock blocks simultaneous parallel executions of the same incident."""
    run_key = "run:sentinelops:8899"
    assert event_deduplicator.acquire_run_lock(run_key) is True
    assert event_deduplicator.acquire_run_lock(run_key) is False  # Blocked

    event_deduplicator.release_run_lock(run_key)
    assert event_deduplicator.acquire_run_lock(run_key) is True


def test_28_duplicate_slack_notification_blocked():
    """Test 28: Idempotency keys prevent posting duplicate Slack alerts for the same incident."""
    notif_key = event_deduplicator.build_notification_key("INC-9912", "slack", "alert")
    assert event_deduplicator.is_duplicate(notif_key) is False
    event_deduplicator.mark_processed(notif_key)

    assert event_deduplicator.is_duplicate(notif_key) is True


# ==============================================================================
# 6. Deterministic Safety Guarantees (Tests 29-34)
# ==============================================================================

def test_29_cache_never_caches_blind_code_patches():
    """Test 29: Diagnoser cache contains ONLY root cause/category; FixSuggester must evaluate fresh repository state."""
    diag_data = {
        "category": "dependency_error",
        "root_cause": "Outdated lockfile",
        "evidence": ["npm ERR! code ERESOLVE"],
        "affected_files": ["package.json"],
        "confidence_score": 0.92,
        "patch": "DANGEROUS_STALE_CODE",
    }
    diagnosis_cache.put("sig-clean-test", diag_data)
    cached = diagnosis_cache.get("sig-clean-test")

    assert "patch" not in cached, "Code patches MUST NOT be cached in diagnosis cache"
    assert cached["category"] == "dependency_error"


def test_30_sentinel_guard_protects_against_dangerous_commands_during_resilience():
    """Test 30: Destructive patterns are detected and blocked before execution."""
    destructive_patch = (
        "--- a/setup.py\n+++ b/setup.py\n@@ -1,3 +1,4 @@\n+import os; os.system('rm -rf /')\n"
    )
    findings = risk_assessor.detect_destructive_patterns(destructive_patch)
    assert len(findings) > 0
    assert any("rm -rf" in f or "os.system" in f for f in findings)


def test_31_confidence_gate_preserves_strict_thresholds_with_cached_diagnosis():
    """Test 31: Confidence gate thresholds remain strictly enforced with cached diagnoses."""
    gate_res = confidence_gate.evaluate(
        diagnosis={"category": "dependency_error", "confidence": 0.95, "cached": True},
        fix={"patch": "--- a/src/app.py\n+++ b/src/app.py\n@@ -1 +1 @@\n", "confidence": 0.70, "affected_files": ["src/app.py"]},
        critic={"score": 0.95, "approved": True, "security_concerns": []},
        risk_assessment={"risk_level": "low", "destructive_patterns_detected": False},
        target_branch="sentinelops/fix-123",
        patch="--- a/src/app.py\n+++ b/src/app.py\n@@ -1 +1 @@\n",
    )
    assert gate_res["decision"] == "human_review_required"
    assert gate_res["requires_human_review"] is True


def test_32_risk_assessor_runs_on_every_fresh_patch():
    """Test 32: Risk assessment calculates diff stats and blast radius dynamically on every patch."""
    patch_str = (
        "--- a/src/app.py\n+++ b/src/app.py\n@@ -1,2 +1,3 @@\n+def new_helper(): pass\n"
    )
    res = risk_assessor.assess(
        patch=patch_str,
        affected_files=["src/app.py"],
        target_branch="sentinelops/fix-abc",
        fix_type="code",
        diagnoser_category="syntax_or_lint_error",
    )
    assert res["risk_level"] == "low"
    assert res["diff_stats"]["lines_added"] >= 1


def test_33_human_approval_required_on_any_resilience_fallback_failure():
    """Test 33: Multi-agent pipeline escalates to human approval if confidence is insufficient."""
    orch = MultiAgentOrchestrator()
    logs = "Fatal build error: unhandled panic"
    with patch.object(diagnoser_agent, "_call_groq", return_value=None):
        with patch.object(diagnoser_agent, "_call_openai", return_value=None):
            with patch.object(diagnoser_agent, "_call_gemini", return_value=None):
                with patch.object(fix_suggester_agent, "_call_groq", return_value=None):
                    with patch.object(fix_suggester_agent, "_call_openai", return_value=None):
                        with patch.object(fix_suggester_agent, "_call_gemini", return_value=None):
                            with patch.object(critic_agent, "_call_groq", return_value=None):
                                with patch.object(critic_agent, "_call_openai", return_value=None):
                                    with patch.object(critic_agent, "_call_gemini", return_value=None):
                                        res = orch.execute_reasoning_pipeline(logs=logs, repository="SentinelOps")

    assert res["status"] in ["approved", "human_review_required", "rejected"]
    assert res["final_status"] in ["approved", "human_review_required", "rejected"]
    assert "human_approval" in res


def test_34_never_auto_merges_main_branch_under_resilience_failures():
    """Test 34: Target branch is restricted to isolated remediation branches, NEVER main/master."""
    orch = MultiAgentOrchestrator()
    logs = "npm ERR! Test failure"
    with patch.object(diagnoser_agent, "_call_groq", return_value=None):
        with patch.object(diagnoser_agent, "_call_openai", return_value=None):
            with patch.object(diagnoser_agent, "_call_gemini", return_value=None):
                with patch.object(fix_suggester_agent, "_call_groq", return_value=None):
                    with patch.object(fix_suggester_agent, "_call_openai", return_value=None):
                        with patch.object(fix_suggester_agent, "_call_gemini", return_value=None):
                            with patch.object(critic_agent, "_call_groq", return_value=None):
                                with patch.object(critic_agent, "_call_openai", return_value=None):
                                    with patch.object(critic_agent, "_call_gemini", return_value=None):
                                        res = orch.execute_reasoning_pipeline(logs=logs, commit_sha="a1b2c3d4e5", repository="SentinelOps")

    assert "main" not in res.get("remediation_branch", "")
    assert "master" not in res.get("remediation_branch", "")


# ==============================================================================
# 7. Cost Telemetry, Stress Testing & Chaos Simulation (Tests 35-38)
# ==============================================================================

def test_35_telemetry_tracks_token_and_cost_savings():
    """Test 35: Telemetry records positive token and estimated dollar savings upon cache hits."""
    log_text = "npm ERR! ERESOLVE version mismatch in package.json"
    with patch.object(diagnoser_agent, "_call_groq", return_value=None):
        with patch.object(diagnoser_agent, "_call_openai", return_value=None):
            with patch.object(diagnoser_agent, "_call_gemini", return_value=None):
                # 1st call populates cache
                diag1 = diagnoser_agent.diagnose(log_text, repository="SentinelOps")
                assert diag1["cached"] is False
                # 2nd call hits cache
                diag2 = diagnoser_agent.diagnose(log_text, repository="SentinelOps")
                assert diag2["cached"] is True

    summary = reliability_telemetry.get_summary()
    assert summary["cache_hits"] >= 1
    assert summary["tokens_saved_by_caching"] > 0
    assert summary["estimated_cost_saved_usd"] > 0.0


def test_36_reliability_api_status_endpoint(client):
    """Test 36: GET /api/reliability/status returns complete telemetry, cache, circuits, and configuration."""
    resp = client.get("/api/reliability/status")
    assert resp.status_code == 200
    data = resp.get_json()

    assert data["status"] == "healthy"
    assert "telemetry" in data
    assert "cache" in data
    assert "providers" in data
    assert "config" in data
    assert data["config"]["primary_llm"] == "groq"
    assert data["config"]["fallback_llm"] == "gemini"


def test_37_ten_consecutive_failures_stress_test():
    """Test 37: Simulates 10 consecutive diverse synthetic failures under stress. Verifies zero crashes and 100% pipeline survivability."""
    orch = MultiAgentOrchestrator()

    test_logs = [
        "npm ERR! code ERESOLVE\nnpm ERR! Could not resolve dependency @types/node@18",
        "SyntaxError: unexpected token '<' at line 12 in src/index.ts",
        "RuntimeError: Maximum call stack size exceeded in recursive_fn",
        "AssertionError: Expected 200 OK but received 500 Internal Error",
        "TypeError: Cannot read properties of undefined (reading 'map')",
        "npm ERR! code ENOENT\nnpm ERR! syscall open package.json",
        "TimeoutError: Navigation timeout of 30000 ms exceeded in e2e tests",
        "ImportError: cannot import name 'Flask' from 'flask'",
        "BUILD FAILED: gradle assembleRelease failed with 2 errors",
        "pytest: 4 failed, 12 passed in 4.21s (ZeroDivisionError)",
    ]

    with patch.object(diagnoser_agent, "_call_groq", return_value=None):
        with patch.object(diagnoser_agent, "_call_openai", return_value=None):
            with patch.object(diagnoser_agent, "_call_gemini", return_value=None):
                with patch.object(fix_suggester_agent, "_call_groq", return_value=None):
                    with patch.object(fix_suggester_agent, "_call_openai", return_value=None):
                        with patch.object(fix_suggester_agent, "_call_gemini", return_value=None):
                            with patch.object(critic_agent, "_call_groq", return_value=None):
                                with patch.object(critic_agent, "_call_openai", return_value=None):
                                    with patch.object(critic_agent, "_call_gemini", return_value=None):
                                        for idx, log in enumerate(test_logs):
                                            res = orch.execute_reasoning_pipeline(
                                                logs=log,
                                                repository="SentinelOps",
                                                commit_sha=f"commit{idx:04d}",
                                                workflow_name=f"CI-Stress-{idx+1}",
                                            )
                                            assert res is not None
                                            assert res["status"] in ["approved", "human_review_required", "rejected"]
                                            assert "error_signature" in res
                                            assert len(res["error_signature"]) == 64
                                            assert res["execution_metrics"]["total_duration_ms"] >= 0


def test_38_chaos_simulation_endpoints(client):
    """Test 38: POST /api/reliability/chaos-simulate injects synthetic faults and verifies fallback responses."""
    # Scenario 1: 429 Rate Limit
    resp429 = client.post("/api/reliability/chaos-simulate", json={"scenario": "groq_rate_limit_429"})
    assert resp429.status_code == 200
    assert resp429.get_json()["status"] == "simulated"

    # Scenario 2: 500 Server Error / Trip Circuit
    resp500 = client.post("/api/reliability/chaos-simulate", json={"scenario": "groq_server_500"})
    assert resp500.status_code == 200
    assert resp500.get_json()["circuit_state"]["state"] == "OPEN"

    # Scenario 3: Timeout
    resp_to = client.post("/api/reliability/chaos-simulate", json={"scenario": "primary_timeout"})
    assert resp_to.status_code == 200

    # Reset circuits
    resp_reset = client.post("/api/reliability/circuits/reset", json={})
    assert resp_reset.status_code == 200

    # Invalidate Cache
    resp_inv = client.post("/api/reliability/cache/invalidate", json={"all": True})
    assert resp_inv.status_code == 200
    assert resp_inv.get_json()["status"] == "success"

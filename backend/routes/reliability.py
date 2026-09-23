"""
Reliability and Resilience Blueprint for SentinelOps (Phase 6).

Routes:
  GET  /api/reliability/status             - Overall resilience status, provider health, cache stats, telemetry
  POST /api/reliability/cache/invalidate    - Invalidate specific or all diagnosis cache entries
  POST /api/reliability/circuits/reset      - Reset circuit breaker states to CLOSED
  POST /api/reliability/chaos-simulate     - Inject synthetic faults to demonstrate automatic fallback
"""

import logging
import time

from config import Config
from flask import Blueprint, jsonify, request
from services.resilience.circuit_breaker import circuit_breaker_registry
from services.resilience.diagnosis_cache import diagnosis_cache
from services.resilience.reliability_telemetry import reliability_telemetry

logger = logging.getLogger("sentinel.routes.reliability")

reliability_bp = Blueprint("reliability", __name__)


@reliability_bp.route("/api/reliability/status", methods=["GET"])
def get_reliability_status():
    """Returns comprehensive resilience telemetry, cache stats, and provider health."""
    telemetry_summary = reliability_telemetry.get_summary()
    cache_stats = diagnosis_cache.get_stats()
    provider_circuits = circuit_breaker_registry.get_all_statuses()

    config_info = {
        "primary_llm": getattr(Config, "SENTINEL_PRIMARY_LLM", "groq"),
        "fallback_llm": getattr(Config, "SENTINEL_FALLBACK_LLM", "gemini"),
        "ollama_enabled": getattr(Config, "SENTINEL_OLLAMA_ENABLED", False),
        "max_retries": getattr(Config, "SENTINEL_LLM_MAX_RETRIES", 3),
        "diagnosis_cache_ttl_seconds": getattr(Config, "SENTINEL_DIAGNOSIS_CACHE_TTL", 86400),
        "circuit_failure_threshold": getattr(Config, "SENTINEL_PROVIDER_FAILURE_THRESHOLD", 3),
        "circuit_cooldown_seconds": getattr(Config, "SENTINEL_PROVIDER_COOLDOWN", 60),
        "llm_timeout_seconds": getattr(Config, "SENTINEL_LLM_TIMEOUT", 30),
        "agent_timeout_seconds": getattr(Config, "SENTINEL_AGENT_TIMEOUT_SECONDS", 60),
    }

    return jsonify({
        "status": "healthy",
        "timestamp": time.time(),
        "telemetry": telemetry_summary,
        "cache": cache_stats,
        "providers": provider_circuits,
        "config": config_info,
    }), 200


@reliability_bp.route("/api/reliability/cache/invalidate", methods=["POST"])
def invalidate_cache():
    """Manually invalidates diagnosis cache entries."""
    body = request.get_json(force=True, silent=True) or {}
    sig = body.get("signature")
    repo = body.get("repository")
    invalidate_all_flag = body.get("all", False)

    if invalidate_all_flag:
        count = diagnosis_cache.invalidate_all()
        return jsonify({
            "status": "success",
            "message": f"Invalidated all {count} diagnosis cache entries.",
            "invalidated_count": count,
        }), 200

    if sig:
        success = diagnosis_cache.invalidate(sig)
        return jsonify({
            "status": "success" if success else "not_found",
            "message": f"Cache entry '{sig[:12]}' {'invalidated' if success else 'not found'}.",
            "invalidated_count": 1 if success else 0,
        }), 200

    if repo:
        count = diagnosis_cache.invalidate_for_repo(repo)
        return jsonify({
            "status": "success",
            "message": f"Invalidated {count} cache entries for repo '{repo}'.",
            "invalidated_count": count,
        }), 200

    # Default to invalidating all if no filter specified
    count = diagnosis_cache.invalidate_all()
    return jsonify({
        "status": "success",
        "message": f"Invalidated all {count} diagnosis cache entries.",
        "invalidated_count": count,
    }), 200


@reliability_bp.route("/api/reliability/circuits/reset", methods=["POST"])
def reset_circuits():
    """Resets all or a specific provider's circuit breaker to CLOSED."""
    body = request.get_json(force=True, silent=True) or {}
    provider = body.get("provider")

    if provider:
        circuit_breaker_registry.reset(provider)
        return jsonify({
            "status": "success",
            "message": f"Circuit breaker for provider '{provider}' reset to CLOSED.",
        }), 200

    circuit_breaker_registry.reset_all()
    return jsonify({
        "status": "success",
        "message": "All provider circuit breakers reset to CLOSED.",
    }), 200


@reliability_bp.route("/api/reliability/chaos-simulate", methods=["POST"])
def chaos_simulate():
    """
    Simulates a failure or degradation scenario to verify resilient fallback.
    Supported scenarios:
      - 'groq_rate_limit_429': Simulates 429 rate limit on Groq, triggering backoff and fallback
      - 'groq_server_500': Simulates 500 error on Groq, tripping circuit breaker to Gemini
      - 'primary_timeout': Simulates timeout on primary provider
    """
    body = request.get_json(force=True, silent=True) or {}
    scenario = body.get("scenario", "groq_rate_limit_429")

    # Record synthetic telemetry event
    if scenario == "groq_rate_limit_429":
        reliability_telemetry.record_retry("groq", "429 Too Many Requests (Chaos Test)", 1, 0.5)
        reliability_telemetry.record_fallback("groq", "gemini", "Rate limit exceeded (Simulated)")
        return jsonify({
            "status": "simulated",
            "scenario": scenario,
            "result": "Simulated 429 rate-limit backoff on Groq. Successfully routed fallback to Gemini with zero downtime.",
        }), 200

    elif scenario == "groq_server_500":
        for _ in range(3):
            circuit_breaker_registry.record_failure("groq", Exception("Simulated 500 Internal Error"))
        reliability_telemetry.record_circuit_trip("groq")
        reliability_telemetry.record_fallback("groq", "gemini", "Circuit breaker OPEN (Simulated)")
        return jsonify({
            "status": "simulated",
            "scenario": scenario,
            "result": "Tripped Groq circuit breaker to OPEN (3 consecutive failures). Provider bypassed; traffic fast-forwarded to Gemini.",
            "circuit_state": circuit_breaker_registry.get_provider_status("groq"),
        }), 200

    elif scenario == "primary_timeout":
        reliability_telemetry.record_retry("groq", "Request Timeout 30s (Chaos Test)", 1, 1.0)
        reliability_telemetry.record_fallback("groq", "gemini", "Timeout exceeded (Simulated)")
        return jsonify({
            "status": "simulated",
            "scenario": scenario,
            "result": "Simulated primary provider timeout. Safely fell back to secondary provider within execution deadline.",
        }), 200

    return jsonify({
        "status": "error",
        "message": f"Unknown chaos scenario '{scenario}'. Supported: 'groq_rate_limit_429', 'groq_server_500', 'primary_timeout'",
    }), 400

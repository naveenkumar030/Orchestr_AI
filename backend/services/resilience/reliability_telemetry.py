"""
Reliability Telemetry Service for SentinelOps (Phase 6).
Tracks provider calls, retries, fallbacks, circuit trips, diagnosis cache efficiency,
deduplications, and cost/token savings.
"""

import logging
import threading
import time
from typing import Any

logger = logging.getLogger("sentinel.resilience.telemetry")

# Estimated cost constants (per 1k tokens) for estimating savings
ESTIMATED_PROMPT_COST_PER_1K = 0.0015
ESTIMATED_COMPLETION_COST_PER_1K = 0.0020
ESTIMATED_DIAGNOSIS_TOKENS = 1800  # Average prompt + completion tokens for Diagnoser Agent


class ReliabilityTelemetry:
    """Thread-safe telemetry collector for SentinelOps resilience metrics."""

    def __init__(self):
        self._lock = threading.Lock()
        self._start_time = time.time()
        self.metrics = {
            "llm_requests_total": 0,
            "llm_requests_successful": 0,
            "llm_requests_failed": 0,
            "provider_invocations": {
                "groq": 0,
                "gemini": 0,
                "ollama": 0,
                "ast_heuristic": 0,
            },
            "retries_total": 0,
            "retries_by_reason": {
                "rate_limit_429": 0,
                "server_error_5xx": 0,
                "timeout": 0,
                "network_error": 0,
            },
            "fallbacks_total": 0,
            "fallback_routes": [],  # List of {from, to, reason, timestamp}
            "circuit_breaker_trips": 0,
            "cache_hits": 0,
            "cache_misses": 0,
            "deduplications_blocked": 0,
            "tokens_consumed": 0,
            "tokens_saved_by_caching": 0,
            "estimated_cost_saved_usd": 0.0,
            "recent_events": [],  # Ring buffer of last 50 events
        }

    def record_llm_request(self, provider: str, success: bool, latency_ms: float = 0.0, tokens_used: int = 0):
        with self._lock:
            self.metrics["llm_requests_total"] += 1
            if success:
                self.metrics["llm_requests_successful"] += 1
            else:
                self.metrics["llm_requests_failed"] += 1

            p_key = provider.lower()
            if p_key not in self.metrics["provider_invocations"]:
                self.metrics["provider_invocations"][p_key] = 0
            self.metrics["provider_invocations"][p_key] += 1

            self.metrics["tokens_consumed"] += tokens_used

    def record_retry(self, provider: str, reason: str, attempt: int, delay_seconds: float):
        with self._lock:
            self.metrics["retries_total"] += 1
            reason_key = "network_error"
            if "429" in reason or "rate" in reason.lower():
                reason_key = "rate_limit_429"
            elif "50" in reason or "server" in reason.lower():
                reason_key = "server_error_5xx"
            elif "timeout" in reason.lower():
                reason_key = "timeout"

            self.metrics["retries_by_reason"][reason_key] = (
                self.metrics["retries_by_reason"].get(reason_key, 0) + 1
            )
            self._add_event("RETRY", f"Retry #{attempt} for {provider} after {delay_seconds:.2f}s ({reason})")

    def record_fallback(self, from_provider: str, to_provider: str, reason: str):
        with self._lock:
            self.metrics["fallbacks_total"] += 1
            route_record = {
                "from": from_provider,
                "to": to_provider,
                "reason": str(reason)[:200],
                "timestamp": time.time(),
            }
            self.metrics["fallback_routes"].append(route_record)
            if len(self.metrics["fallback_routes"]) > 50:
                self.metrics["fallback_routes"].pop(0)

            self._add_event("FALLBACK", f"Failed {from_provider} -> Fallback to {to_provider} ({reason})")

    def record_circuit_trip(self, provider: str):
        with self._lock:
            self.metrics["circuit_breaker_trips"] += 1
            self._add_event("CIRCUIT_TRIPPED", f"Circuit breaker tripped for {provider}")

    def record_cache_hit(self, signature: str):
        with self._lock:
            self.metrics["cache_hits"] += 1
            self.metrics["tokens_saved_by_caching"] += ESTIMATED_DIAGNOSIS_TOKENS
            est_savings = (ESTIMATED_DIAGNOSIS_TOKENS / 1000.0) * (
                (ESTIMATED_PROMPT_COST_PER_1K + ESTIMATED_COMPLETION_COST_PER_1K) / 2.0
            )
            self.metrics["estimated_cost_saved_usd"] = round(
                self.metrics["estimated_cost_saved_usd"] + est_savings, 4
            )
            self._add_event("CACHE_HIT", f"Diagnosis cache hit for signature {signature[:10]}")

    def record_cache_miss(self, signature: str):
        with self._lock:
            self.metrics["cache_misses"] += 1

    def record_deduplication(self, key: str, reason: str):
        with self._lock:
            self.metrics["deduplications_blocked"] += 1
            self._add_event("DEDUPLICATION", f"Blocked duplicate {reason}: {key}")

    def _add_event(self, event_type: str, detail: str):
        event = {
            "type": event_type,
            "detail": detail,
            "timestamp": time.time(),
            "iso_time": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        }
        self.metrics["recent_events"].insert(0, event)
        if len(self.metrics["recent_events"]) > 50:
            self.metrics["recent_events"].pop()

    def get_summary(self) -> dict[str, Any]:
        with self._lock:
            total_cache_ops = self.metrics["cache_hits"] + self.metrics["cache_misses"]
            cache_hit_rate = (
                round((self.metrics["cache_hits"] / total_cache_ops * 100), 2)
                if total_cache_ops > 0
                else 0.0
            )

            total_llm = self.metrics["llm_requests_total"]
            success_rate = (
                round((self.metrics["llm_requests_successful"] / total_llm * 100), 2)
                if total_llm > 0
                else 100.0
            )

            uptime_seconds = int(time.time() - self._start_time)

            return {
                "uptime_seconds": uptime_seconds,
                "llm_requests_total": self.metrics["llm_requests_total"],
                "llm_success_rate_pct": success_rate,
                "provider_invocations": dict(self.metrics["provider_invocations"]),
                "retries_total": self.metrics["retries_total"],
                "retries_by_reason": dict(self.metrics["retries_by_reason"]),
                "fallbacks_total": self.metrics["fallbacks_total"],
                "circuit_breaker_trips": self.metrics["circuit_breaker_trips"],
                "cache_hits": self.metrics["cache_hits"],
                "cache_misses": self.metrics["cache_misses"],
                "cache_hit_rate_pct": cache_hit_rate,
                "deduplications_blocked": self.metrics["deduplications_blocked"],
                "tokens_consumed": self.metrics["tokens_consumed"],
                "tokens_saved_by_caching": self.metrics["tokens_saved_by_caching"],
                "estimated_cost_saved_usd": self.metrics["estimated_cost_saved_usd"],
                "recent_fallback_routes": list(self.metrics["fallback_routes"][-10:]),
                "recent_events": list(self.metrics["recent_events"][:20]),
            }

    def reset(self):
        """Reset all metrics (primarily for test isolation)."""
        with self._lock:
            self._start_time = time.time()
            self.metrics["llm_requests_total"] = 0
            self.metrics["llm_requests_successful"] = 0
            self.metrics["llm_requests_failed"] = 0
            for k in self.metrics["provider_invocations"]:
                self.metrics["provider_invocations"][k] = 0
            self.metrics["retries_total"] = 0
            for k in self.metrics["retries_by_reason"]:
                self.metrics["retries_by_reason"][k] = 0
            self.metrics["fallbacks_total"] = 0
            self.metrics["fallback_routes"].clear()
            self.metrics["circuit_breaker_trips"] = 0
            self.metrics["cache_hits"] = 0
            self.metrics["cache_misses"] = 0
            self.metrics["deduplications_blocked"] = 0
            self.metrics["tokens_consumed"] = 0
            self.metrics["tokens_saved_by_caching"] = 0
            self.metrics["estimated_cost_saved_usd"] = 0.0
            self.metrics["recent_events"].clear()


# Singleton instance
reliability_telemetry = ReliabilityTelemetry()

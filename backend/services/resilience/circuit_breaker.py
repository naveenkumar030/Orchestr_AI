"""
Circuit Breaker Implementation for LLM Providers and External APIs (Phase 6).
Provides CLOSED, OPEN, and HALF_OPEN state machine to prevent cascading failures
and enable fast failover across LLM providers.
"""

import logging
import threading
import time
from enum import Enum
from typing import Any

from config import Config

logger = logging.getLogger("sentinel.resilience.circuit_breaker")


class CircuitState(str, Enum):
    CLOSED = "CLOSED"        # Healthy, normal traffic
    OPEN = "OPEN"            # Tripped, blocking requests, fast-fallback
    HALF_OPEN = "HALF_OPEN"  # Testing recovery with single probe request


class ProviderCircuit:
    """State tracker for a single provider."""

    def __init__(
        self,
        name: str,
        failure_threshold: int = 3,
        cooldown_seconds: int = 60,
    ):
        self.name = name
        self.failure_threshold = failure_threshold
        self.cooldown_seconds = cooldown_seconds
        self.state = CircuitState.CLOSED
        self.consecutive_failures = 0
        self.consecutive_successes = 0
        self.last_failure_time: float | None = None
        self.last_state_change_time: float = time.time()
        self.total_requests = 0
        self.total_failures = 0
        self.total_successes = 0

    def allow_request(self) -> bool:
        """Determines if a request should be permitted through."""
        self.total_requests += 1
        now = time.time()

        if self.state == CircuitState.CLOSED:
            return True

        if self.state == CircuitState.OPEN:
            # Check if cooldown has elapsed
            if self.last_failure_time and (now - self.last_failure_time) >= self.cooldown_seconds:
                logger.info(
                    f"Circuit breaker for provider '{self.name}' cooldown elapsed ({self.cooldown_seconds}s). Transitioning OPEN -> HALF_OPEN"
                )
                self.state = CircuitState.HALF_OPEN
                self.last_state_change_time = now
                return True
            return False

        if self.state == CircuitState.HALF_OPEN:
            # Allow trial/probe request
            return True

        return False

    def record_success(self) -> None:
        """Records a successful request."""
        self.total_successes += 1
        self.consecutive_failures = 0
        self.consecutive_successes += 1

        if self.state == CircuitState.HALF_OPEN:
            logger.info(
                f"Circuit breaker for provider '{self.name}' probe succeeded. Transitioning HALF_OPEN -> CLOSED"
            )
            self.state = CircuitState.CLOSED
            self.last_state_change_time = time.time()

    def record_failure(self, error: Exception | None = None) -> None:
        """Records a failed request."""
        self.total_failures += 1
        self.consecutive_failures += 1
        self.consecutive_successes = 0
        self.last_failure_time = time.time()

        if self.state == CircuitState.CLOSED:
            if self.consecutive_failures >= self.failure_threshold:
                logger.warning(
                    f"Circuit breaker for provider '{self.name}' tripped ({self.consecutive_failures}/{self.failure_threshold} failures). Transitioning CLOSED -> OPEN"
                )
                self.state = CircuitState.OPEN
                self.last_state_change_time = time.time()

        elif self.state == CircuitState.HALF_OPEN:
            logger.warning(
                f"Circuit breaker for provider '{self.name}' probe failed. Transitioning HALF_OPEN -> OPEN"
            )
            self.state = CircuitState.OPEN
            self.last_state_change_time = time.time()

    def reset(self) -> None:
        """Forces circuit reset to CLOSED."""
        self.state = CircuitState.CLOSED
        self.consecutive_failures = 0
        self.consecutive_successes = 0
        self.last_failure_time = None
        self.last_state_change_time = time.time()

    def to_dict(self) -> dict[str, Any]:
        now = time.time()
        remaining_cooldown = 0
        if self.state == CircuitState.OPEN and self.last_failure_time:
            remaining_cooldown = max(0, int(self.cooldown_seconds - (now - self.last_failure_time)))

        return {
            "provider": self.name,
            "state": self.state.value,
            "is_available": self.state != CircuitState.OPEN or remaining_cooldown == 0,
            "consecutive_failures": self.consecutive_failures,
            "failure_threshold": self.failure_threshold,
            "cooldown_seconds": self.cooldown_seconds,
            "remaining_cooldown_seconds": remaining_cooldown,
            "total_requests": self.total_requests,
            "total_successes": self.total_successes,
            "total_failures": self.total_failures,
            "last_failure_time": self.last_failure_time,
            "last_state_change_time": self.last_state_change_time,
        }


class CircuitBreakerRegistry:
    """Registry managing circuit breakers across all providers."""

    def __init__(self):
        self._lock = threading.Lock()
        self._circuits: dict[str, ProviderCircuit] = {}
        self.default_threshold = getattr(Config, "SENTINEL_PROVIDER_FAILURE_THRESHOLD", 3)
        self.default_cooldown = getattr(Config, "SENTINEL_PROVIDER_COOLDOWN", 60)

    def _get_or_create(self, provider_name: str) -> ProviderCircuit:
        key = provider_name.lower().strip()
        if key not in self._circuits:
            self._circuits[key] = ProviderCircuit(
                name=key,
                failure_threshold=self.default_threshold,
                cooldown_seconds=self.default_cooldown,
            )
        return self._circuits[key]

    def allow_request(self, provider_name: str) -> bool:
        with self._lock:
            circuit = self._get_or_create(provider_name)
            return circuit.allow_request()

    def record_success(self, provider_name: str) -> None:
        with self._lock:
            circuit = self._get_or_create(provider_name)
            circuit.record_success()

    def record_failure(self, provider_name: str, error: Exception | None = None) -> None:
        with self._lock:
            circuit = self._get_or_create(provider_name)
            circuit.record_failure(error)

    def reset(self, provider_name: str) -> None:
        with self._lock:
            circuit = self._get_or_create(provider_name)
            circuit.reset()

    def reset_all(self) -> None:
        with self._lock:
            self._circuits.clear()

    def get_provider_status(self, provider_name: str) -> dict[str, Any]:
        with self._lock:
            circuit = self._get_or_create(provider_name)
            return circuit.to_dict()

    def get_all_statuses(self) -> dict[str, Any]:
        with self._lock:
            # Pre-populate defaults if not present
            for p in ["groq", "gemini", "ollama", "github", "slack"]:
                if p not in self._circuits:
                    self._circuits[p] = ProviderCircuit(
                        name=p,
                        failure_threshold=self.default_threshold,
                        cooldown_seconds=self.default_cooldown,
                    )
            return {name: circuit.to_dict() for name, circuit in self._circuits.items()}


# Singleton instance
circuit_breaker_registry = CircuitBreakerRegistry()

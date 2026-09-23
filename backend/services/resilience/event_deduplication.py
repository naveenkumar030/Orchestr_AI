"""
Event Deduplication and Concurrency Lock Service for SentinelOps (Phase 6).
Prevents duplicate webhook events, redundant multi-agent pipeline executions,
duplicate Slack messages, and duplicate Draft PR creations.
"""

import logging
import threading
import time

from services.resilience.reliability_telemetry import reliability_telemetry

logger = logging.getLogger("sentinel.resilience.deduplication")


class EventDeduplicator:
    """
    Idempotency and lock manager with TTL cache and mutex locks.
    """

    def __init__(self, default_ttl_seconds: int = 600):
        self._lock = threading.Lock()
        self._key_locks: dict[str, threading.Lock] = {}
        self._processed_events: dict[str, float] = {}  # key -> expiry_time
        self._active_runs: set[str] = set()
        self.default_ttl = default_ttl_seconds

    def _cleanup_expired(self, now: float):
        expired_keys = [k for k, exp in self._processed_events.items() if now > exp]
        for k in expired_keys:
            del self._processed_events[k]

    def build_webhook_key(
        self,
        repository: str,
        run_id: str,
        event_type: str = "workflow_run",
        action: str = "completed",
    ) -> str:
        """Constructs canonical idempotency key for webhook events."""
        return f"webhook:{repository.lower()}:{run_id!s}:{event_type.lower()}:{action.lower()}"

    def build_notification_key(self, incident_id: str, channel: str = "slack", notification_type: str = "alert") -> str:
        """Constructs canonical key for alert notifications."""
        return f"notify:{incident_id}:{channel}:{notification_type}"

    def build_draft_pr_key(self, incident_id: str, branch_name: str) -> str:
        """Constructs canonical key for draft PR creation."""
        return f"pr:{incident_id}:{branch_name}"

    def is_duplicate(self, key: str) -> bool:
        """Checks if key has already been processed within the TTL window."""
        if not key:
            return False

        now = time.time()
        with self._lock:
            self._cleanup_expired(now)
            if key in self._processed_events:
                logger.warning(f"Duplicate event detected and blocked: {key}")
                reliability_telemetry.record_deduplication(key, "event_duplicate")
                return True
            return False

    def mark_processed(self, key: str, ttl_seconds: int | None = None) -> None:
        """Marks a key as processed with an expiration TTL."""
        if not key:
            return

        ttl = ttl_seconds if ttl_seconds is not None else self.default_ttl
        now = time.time()
        with self._lock:
            self._processed_events[key] = now + ttl
            logger.debug(f"Event marked processed: {key} (TTL: {ttl}s)")

    def acquire_run_lock(self, run_key: str) -> bool:
        """
        Acquires an execution lock for a run.
        Returns False if another thread is currently processing the same run.
        """
        with self._lock:
            if run_key in self._active_runs:
                logger.warning(f"Concurrent execution lock contention blocked for: {run_key}")
                reliability_telemetry.record_deduplication(run_key, "concurrent_execution")
                return False
            self._active_runs.add(run_key)
            return True

    def release_run_lock(self, run_key: str) -> None:
        """Releases an execution lock."""
        with self._lock:
            self._active_runs.discard(run_key)

    def clear(self):
        """Clears all records and locks (for test isolation)."""
        with self._lock:
            self._processed_events.clear()
            self._active_runs.clear()
            self._key_locks.clear()


# Singleton instance
event_deduplicator = EventDeduplicator()

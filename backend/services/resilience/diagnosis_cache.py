"""
Diagnosis Cache Service for SentinelOps (Phase 6).
Provides fast, deterministic lookup of root-cause diagnoses for recurring CI failures.

Architectural Rule:
- ONLY the diagnosis (root cause, failure category, evidence, affected files) is cached.
- Code patches and draft PRs are NEVER cached blindly; FixSuggester evaluates the current
  repository state before synthesizing fresh code.
- Cache entries have configurable TTL (SENTINEL_DIAGNOSIS_CACHE_TTL) and repo-context validation.
"""

import logging
import threading
import time
from typing import Any

from config import Config

logger = logging.getLogger("sentinel.resilience.diagnosis_cache")


class DiagnosisCacheEntry:
    """Represents a cached diagnosis result."""

    def __init__(
        self,
        error_signature: str,
        diagnosis_data: dict[str, Any],
        ttl_seconds: int = 86400,
        repo_context_hash: str | None = None,
        repository: str = "SentinelOps",
    ):
        self.error_signature = error_signature
        self.diagnosis_data = diagnosis_data  # Root cause, category, evidence, affected files
        self.created_at = time.time()
        self.ttl_seconds = ttl_seconds
        self.expires_at = self.created_at + ttl_seconds
        self.hit_count = 0
        self.repo_context_hash = repo_context_hash or ""
        self.repository = repository

    def is_expired(self) -> bool:
        """Returns True if entry has surpassed its TTL."""
        return time.time() > self.expires_at

    def to_dict(self) -> dict[str, Any]:
        return {
            "error_signature": self.error_signature,
            "diagnosis_data": self.diagnosis_data,
            "created_at": self.created_at,
            "expires_at": self.expires_at,
            "ttl_seconds": self.ttl_seconds,
            "hit_count": self.hit_count,
            "repo_context_hash": self.repo_context_hash,
            "repository": self.repository,
            "is_expired": self.is_expired(),
            "remaining_ttl_seconds": max(0, int(self.expires_at - time.time())),
        }


class DiagnosisCache:
    """
    In-memory and thread-safe diagnosis cache with TTL eviction,
    hit/miss telemetry tracking, and manual invalidation.
    """

    def __init__(self, default_ttl: int | None = None):
        self._lock = threading.Lock()
        self._entries: dict[str, DiagnosisCacheEntry] = {}
        self.default_ttl = (
            default_ttl if default_ttl is not None else getattr(Config, "SENTINEL_DIAGNOSIS_CACHE_TTL", 86400)
        )
        self.stats = {
            "hits": 0,
            "misses": 0,
            "evictions": 0,
            "invalidations": 0,
            "entries_stored": 0,
        }

    def get(
        self,
        error_signature: str,
        current_repo_context_hash: str | None = None,
    ) -> dict[str, Any] | None:
        """
        Retrieves a cached diagnosis by error signature.
        Returns None if cache miss, expired, or if repository context has changed.
        """
        if not error_signature:
            return None

        with self._lock:
            entry = self._entries.get(error_signature)
            if not entry:
                self.stats["misses"] += 1
                return None

            # Check expiration
            if entry.is_expired():
                del self._entries[error_signature]
                self.stats["evictions"] += 1
                self.stats["misses"] += 1
                logger.info(f"Diagnosis cache expired for signature {error_signature[:12]}")
                return None

            # Check repo context hash invalidation if provided
            if current_repo_context_hash and entry.repo_context_hash:
                if entry.repo_context_hash != current_repo_context_hash:
                    del self._entries[error_signature]
                    self.stats["invalidations"] += 1
                    self.stats["misses"] += 1
                    logger.info(
                        f"Diagnosis cache invalidated due to repo context drift for signature {error_signature[:12]}"
                    )
                    return None

            entry.hit_count += 1
            self.stats["hits"] += 1
            logger.info(
                f"Diagnosis cache HIT for signature {error_signature[:12]} (hits: {entry.hit_count})"
            )
            # Return a copy of cached diagnosis data
            return dict(entry.diagnosis_data)

    def put(
        self,
        error_signature: str,
        diagnosis_data: dict[str, Any],
        ttl: int | None = None,
        repo_context_hash: str | None = None,
        repository: str = "SentinelOps",
    ) -> None:
        """
        Stores a diagnosis in the cache.
        """
        if not error_signature or not diagnosis_data:
            return

        ttl_to_use = ttl if ttl is not None else self.default_ttl

        # Ensure we only store serializable diagnostic fields
        sanitized_diag = {
            "root_cause": diagnosis_data.get("root_cause", ""),
            "category": diagnosis_data.get("category", "unknown"),
            "evidence": diagnosis_data.get("evidence", []),
            "affected_files": diagnosis_data.get("affected_files", []),
            "confidence_score": diagnosis_data.get("confidence_score", 0.0),
            "cached": True,
        }

        with self._lock:
            entry = DiagnosisCacheEntry(
                error_signature=error_signature,
                diagnosis_data=sanitized_diag,
                ttl_seconds=ttl_to_use,
                repo_context_hash=repo_context_hash,
                repository=repository,
            )
            self._entries[error_signature] = entry
            self.stats["entries_stored"] += 1
            logger.info(f"Stored diagnosis in cache for signature {error_signature[:12]} (TTL: {ttl_to_use}s)")

    def invalidate(self, error_signature: str) -> bool:
        """Invalidates a specific cache entry."""
        with self._lock:
            if error_signature in self._entries:
                del self._entries[error_signature]
                self.stats["invalidations"] += 1
                logger.info(f"Manually invalidated diagnosis cache entry: {error_signature[:12]}")
                return True
            return False

    def invalidate_all(self) -> int:
        """Invalidates all cached diagnoses."""
        with self._lock:
            count = len(self._entries)
            self._entries.clear()
            self.stats["invalidations"] += count
            logger.info(f"Invalidated all {count} diagnosis cache entries")
            return count

    def reset(self) -> None:
        """Completely resets cache entries and all statistics."""
        with self._lock:
            self._entries.clear()
            self.stats = {
                "hits": 0,
                "misses": 0,
                "evictions": 0,
                "invalidations": 0,
                "entries_stored": 0,
            }


    def invalidate_for_repo(self, repository: str) -> int:
        """Invalidates all cache entries for a specific repository."""
        with self._lock:
            to_delete = [
                sig for sig, entry in self._entries.items()
                if entry.repository.lower() == (repository or "").lower()
            ]
            for sig in to_delete:
                del self._entries[sig]
            self.stats["invalidations"] += len(to_delete)
            logger.info(f"Invalidated {len(to_delete)} cache entries for repo {repository}")
            return len(to_delete)

    def get_stats(self) -> dict[str, Any]:
        """Returns cache telemetry and statistics."""
        with self._lock:
            active_entries = [e for e in self._entries.values() if not e.is_expired()]
            total_requests = self.stats["hits"] + self.stats["misses"]
            hit_rate = round((self.stats["hits"] / total_requests * 100), 2) if total_requests > 0 else 0.0

            return {
                "active_entries_count": len(active_entries),
                "total_stored": self.stats["entries_stored"],
                "hits": self.stats["hits"],
                "misses": self.stats["misses"],
                "hit_rate_pct": hit_rate,
                "evictions": self.stats["evictions"],
                "invalidations": self.stats["invalidations"],
                "default_ttl_seconds": self.default_ttl,
                "entries": [e.to_dict() for e in active_entries[:50]],
            }


# Singleton instance
diagnosis_cache = DiagnosisCache()

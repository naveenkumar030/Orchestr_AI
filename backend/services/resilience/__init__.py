"""
SentinelOps Resilience Services Package (Phase 6).
Provides deterministic error signatures, diagnosis caching, circuit breaking,
LLM resilience orchestration, event deduplication, and reliability telemetry.
"""

from services.resilience.circuit_breaker import (
    CircuitBreakerRegistry,
    CircuitState,
    ProviderCircuit,
    circuit_breaker_registry,
)
from services.resilience.diagnosis_cache import (
    DiagnosisCache,
    DiagnosisCacheEntry,
    diagnosis_cache,
)
from services.resilience.error_signature import (
    ErrorSignatureGenerator,
    error_signature_generator,
)
from services.resilience.event_deduplication import (
    EventDeduplicator,
    event_deduplicator,
)
from services.resilience.llm_resilience_manager import (
    LLMResilienceManager,
    llm_resilience_manager,
)
from services.resilience.reliability_telemetry import (
    ReliabilityTelemetry,
    reliability_telemetry,
)

__all__ = [
    "CircuitBreakerRegistry",
    "CircuitState",
    "DiagnosisCache",
    "DiagnosisCacheEntry",
    "ErrorSignatureGenerator",
    "EventDeduplicator",
    "LLMResilienceManager",
    "ProviderCircuit",
    "ReliabilityTelemetry",
    "circuit_breaker_registry",
    "diagnosis_cache",
    "error_signature_generator",
    "event_deduplicator",
    "llm_resilience_manager",
    "reliability_telemetry",
]

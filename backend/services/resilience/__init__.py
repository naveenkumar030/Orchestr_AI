"""
SentinelOps Resilience Services Package (Phase 6).
Provides deterministic error signatures, diagnosis caching, circuit breaking,
LLM resilience orchestration, event deduplication, and reliability telemetry.
"""

from services.resilience.error_signature import (
    ErrorSignatureGenerator,
    error_signature_generator,
)
from services.resilience.diagnosis_cache import (
    DiagnosisCache,
    DiagnosisCacheEntry,
    diagnosis_cache,
)
from services.resilience.circuit_breaker import (
    CircuitState,
    ProviderCircuit,
    CircuitBreakerRegistry,
    circuit_breaker_registry,
)
from services.resilience.reliability_telemetry import (
    ReliabilityTelemetry,
    reliability_telemetry,
)
from services.resilience.event_deduplication import (
    EventDeduplicator,
    event_deduplicator,
)
from services.resilience.llm_resilience_manager import (
    LLMResilienceManager,
    llm_resilience_manager,
)

__all__ = [
    "ErrorSignatureGenerator",
    "error_signature_generator",
    "DiagnosisCache",
    "DiagnosisCacheEntry",
    "diagnosis_cache",
    "CircuitState",
    "ProviderCircuit",
    "CircuitBreakerRegistry",
    "circuit_breaker_registry",
    "ReliabilityTelemetry",
    "reliability_telemetry",
    "EventDeduplicator",
    "event_deduplicator",
    "LLMResilienceManager",
    "llm_resilience_manager",
]

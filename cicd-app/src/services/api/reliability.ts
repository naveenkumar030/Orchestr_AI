import { request, actionRequest } from './client';
import type { ReliabilityStatusResponse } from '../../types';

export const reliabilityApi = {
  // ── Phase 6: Reliability, Resilience & Cost Control ───────────────────────

  async getReliabilityStatus(): Promise<ReliabilityStatusResponse> {
    const fallback: ReliabilityStatusResponse = {
      status: 'offline',
      timestamp: Date.now() / 1000,
      telemetry: {
        uptime_seconds: 0,
        llm_requests_total: 0,
        llm_success_rate_pct: 0,
        provider_invocations: { groq: 0, gemini: 0, ollama: 0, ast_heuristic: 0 },
        retries_total: 0,
        retries_by_reason: { rate_limit_429: 0, server_error_5xx: 0, timeout: 0, network_error: 0 },
        fallbacks_total: 0,
        circuit_breaker_trips: 0,
        cache_hits: 0,
        cache_misses: 0,
        cache_hit_rate_pct: 0,
        deduplications_blocked: 0,
        tokens_consumed: 0,
        tokens_saved_by_caching: 0,
        estimated_cost_saved_usd: 0,
        recent_events: [],
      },
      cache: {
        active_entries_count: 0,
        total_stored: 0,
        hits: 0,
        misses: 0,
        hit_rate_pct: 0,
        evictions: 0,
        invalidations: 0,
        default_ttl_seconds: 86400,
      },
      providers: {
        groq: {
          provider: 'groq',
          state: 'CLOSED',
          is_available: false,
          consecutive_failures: 0,
          failure_threshold: 3,
          cooldown_seconds: 60,
          remaining_cooldown_seconds: 0,
          total_requests: 0,
          total_successes: 0,
          total_failures: 0,
        },
        gemini: {
          provider: 'gemini',
          state: 'CLOSED',
          is_available: false,
          consecutive_failures: 0,
          failure_threshold: 3,
          cooldown_seconds: 60,
          remaining_cooldown_seconds: 0,
          total_requests: 0,
          total_successes: 0,
          total_failures: 0,
        },
      },
      config: {
        primary_llm: 'groq',
        fallback_llm: 'gemini',
        ollama_enabled: false,
        max_retries: 3,
        diagnosis_cache_ttl_seconds: 86400,
        circuit_failure_threshold: 3,
        circuit_cooldown_seconds: 60,
        llm_timeout_seconds: 30,
        agent_timeout_seconds: 60,
      },
    };

    const { data } = await request<ReliabilityStatusResponse>(
      '/reliability/status',
      { method: 'GET' },
      fallback
    );
    return data;
  },

  async invalidateDiagnosisCache(params?: {
    signature?: string;
    repository?: string;
    all?: boolean;
  }): Promise<{ status: string; message: string; invalidated_count: number }> {
    const { data } = await actionRequest<{ status: string; message: string; invalidated_count: number }>(
      '/reliability/cache/invalidate',
      {
        method: 'POST',
        body: JSON.stringify(params || { all: true }),
      },
      () => ({ status: 'success', message: '[Demo Mode] Cache invalidated (simulated)', invalidated_count: 1 })
    );
    return data;
  },

  async resetCircuitBreakers(provider?: string): Promise<{ status: string; message: string }> {
    const { data } = await actionRequest<{ status: string; message: string }>(
      '/reliability/circuits/reset',
      {
        method: 'POST',
        body: JSON.stringify(provider ? { provider } : {}),
      },
      () => ({ status: 'success', message: '[Demo Mode] Circuits reset (simulated)' })
    );
    return data;
  },

  async simulateChaos(
    scenario: string = 'groq_rate_limit_429'
  ): Promise<{ status: string; scenario: string; result: string }> {
    const { data } = await actionRequest<{ status: string; scenario: string; result: string }>(
      '/reliability/chaos-simulate',
      {
        method: 'POST',
        body: JSON.stringify({ scenario }),
      },
      () => ({ status: 'simulated', scenario, result: `[Demo Mode] Chaos scenario '${scenario}' executed (simulated).` })
    );
    return data;
  },
};

import React, { useState, useEffect } from 'react';
import { api } from '../../services/api';
import type { ReliabilityStatusResponse } from '../../types';

export const ReliabilitySummaryCard: React.FC = () => {
  const [data, setData] = useState<ReliabilityStatusResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [notification, setNotification] = useState<string | null>(null);

  const fetchStatus = React.useCallback(async () => {
    try {
      const res = await api.getReliabilityStatus();
      setData(res);
    } catch (err) {
      console.error('Failed to fetch reliability status:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let isMounted = true;
    const run = async () => {
      if (isMounted) {
        await fetchStatus();
      }
    };
    void run();
    const interval = setInterval(() => {
      void run();
    }, 15000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [fetchStatus]);

  const showToast = (msg: string) => {
    setNotification(msg);
    setTimeout(() => setNotification(null), 4000);
  };

  const handleInvalidateCache = async () => {
    setActionLoading(true);
    try {
      const res = await api.invalidateDiagnosisCache({ all: true });
      showToast(res.message || 'Diagnosis cache successfully cleared');
      await fetchStatus();
    } catch {
      showToast('Error invalidating cache');
    } finally {
      setActionLoading(false);
    }
  };

  const handleResetCircuits = async () => {
    setActionLoading(true);
    try {
      const res = await api.resetCircuitBreakers();
      showToast(res.message || 'All circuit breakers reset to CLOSED');
      await fetchStatus();
    } catch {
      showToast('Error resetting circuit breakers');
    } finally {
      setActionLoading(false);
    }
  };

  const handleChaosSimulate = async (scenario: string) => {
    setActionLoading(true);
    try {
      const res = await api.simulateChaos(scenario);
      showToast(`Chaos Simulation: ${res.result}`);
      await fetchStatus();
    } catch {
      showToast('Error running chaos simulation');
    } finally {
      setActionLoading(false);
    }
  };

  if (loading && !data) {
    return (
      <div className="bg-white border border-[#E5DED6] rounded-xl p-6 shadow-panel animate-pulse space-y-4">
        <div className="h-6 w-1/3 bg-[#F2EDE6] rounded-md" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-20 bg-[#F2EDE6] rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  const telemetry = data?.telemetry;
  const cache = data?.cache;
  const providers = data?.providers || {};

  return (
    <div className="bg-white border border-[#E5DED6] rounded-xl p-6 shadow-panel space-y-6 relative overflow-hidden">
      {/* Background ambient accents */}
      <div className="absolute top-0 right-0 w-80 h-80 bg-[#D97757]/5 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20" />
      <div className="absolute bottom-0 left-0 w-80 h-80 bg-[#5B7C4B]/5 rounded-full blur-3xl pointer-events-none -ml-20 -mb-20" />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 relative z-10">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-[#F9ECE7] border border-[#D97757]/30 rounded-xl text-[#D97757]">
            <span className="material-symbols-outlined text-2xl">verified_user</span>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-bold text-[#2D2926] tracking-tight">
                Reliability, Resilience &amp; Cost Control Matrix
              </h3>
              <span className="px-2 py-0.5 text-xs font-semibold bg-[#EDF4EA] text-[#5B7C4B] border border-[#5B7C4B]/30 rounded-full flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-[#5B7C4B] animate-pulse" />
                Phase 6 Active
              </span>
            </div>
            <p className="text-xs text-[#6B625B]">
              Deterministic diagnosis caching, multi-provider failover (Groq &rarr; Gemini &rarr; Ollama &rarr; Heuristics), and bounded backoff
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={fetchStatus}
            disabled={actionLoading}
            className="px-3 py-1.5 bg-[#FBF9F5] hover:bg-[#F2EDE6] border border-[#E5DED6] text-xs font-medium text-[#2D2926] rounded-lg transition-all flex items-center gap-1.5 shadow-sm"
            title="Refresh resilience metrics"
          >
            <span className={`material-symbols-outlined text-sm ${actionLoading ? 'animate-spin' : ''}`}>sync</span>
            Refresh
          </button>
          <button
            onClick={handleInvalidateCache}
            disabled={actionLoading}
            className="px-3 py-1.5 bg-[#FBF9F5] hover:bg-[#FDF0F0] hover:border-[#C34A4A]/40 border border-[#E5DED6] text-xs font-medium text-[#2D2926] hover:text-[#C34A4A] rounded-lg transition-all flex items-center gap-1.5 shadow-sm"
            title="Invalidate diagnosis cache"
          >
            <span className="material-symbols-outlined text-sm">delete_sweep</span>
            Clear Cache
          </button>
          <button
            onClick={handleResetCircuits}
            disabled={actionLoading}
            className="px-3 py-1.5 bg-[#FBF9F5] hover:bg-[#EDF4EA] hover:border-[#5B7C4B]/40 border border-[#E5DED6] text-xs font-medium text-[#2D2926] hover:text-[#5B7C4B] rounded-lg transition-all flex items-center gap-1.5 shadow-sm"
            title="Reset circuit breakers"
          >
            <span className="material-symbols-outlined text-sm">restart_alt</span>
            Reset Circuits
          </button>
        </div>
      </div>

      {/* Notification Toast */}
      {notification && (
        <div className="px-4 py-2.5 bg-[#F9ECE7] border border-[#D97757]/40 text-[#99462A] text-xs rounded-xl flex items-center justify-between shadow-sm animate-in fade-in duration-200">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-base text-[#5B7C4B]">check_circle</span>
            <span>{notification}</span>
          </div>
          <button onClick={() => setNotification(null)} className="text-[#6B625B] hover:text-[#2D2926]">✕</button>
        </div>
      )}

      {/* Metrics Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 relative z-10">
        {/* Metric 1: Cache Hit Rate */}
        <div className="bg-[#FBF9F5] border border-[#E5DED6] rounded-xl p-3.5 space-y-1">
          <div className="flex items-center justify-between text-xs text-[#6B625B] font-medium">
            <span className="flex items-center gap-1.5">
              <span className="material-symbols-outlined text-sm text-[#D97757]">database</span>
              Diagnosis Cache
            </span>
            <span className="text-[#5B7C4B] font-semibold">{cache?.hit_rate_pct ?? 0}% Hits</span>
          </div>
          <div className="text-xl font-bold text-[#2D2926] tracking-tight">
            {cache?.hits ?? 0} <span className="text-xs text-[#6B625B] font-normal">/ {(cache?.hits ?? 0) + (cache?.misses ?? 0)} queries</span>
          </div>
          <div className="text-[11px] text-[#6B625B]">
            {cache?.active_entries_count ?? 0} active signatures (24h TTL)
          </div>
        </div>

        {/* Metric 2: Cost & Tokens Saved */}
        <div className="bg-[#FBF9F5] border border-[#E5DED6] rounded-xl p-3.5 space-y-1">
          <div className="flex items-center justify-between text-xs text-[#6B625B] font-medium">
            <span className="flex items-center gap-1.5">
              <span className="material-symbols-outlined text-sm text-[#5B7C4B]">savings</span>
              Cost Saved
            </span>
            <span className="text-xs text-[#6B625B] font-mono">{(telemetry?.tokens_saved_by_caching ?? 0).toLocaleString()} tok</span>
          </div>
          <div className="text-xl font-bold text-[#5B7C4B] tracking-tight">
            ${(telemetry?.estimated_cost_saved_usd ?? 0).toFixed(4)}
          </div>
          <div className="text-[11px] text-[#6B625B]">
            Saved via deterministic caching
          </div>
        </div>

        {/* Metric 3: Retries & Fallbacks */}
        <div className="bg-[#FBF9F5] border border-[#E5DED6] rounded-xl p-3.5 space-y-1">
          <div className="flex items-center justify-between text-xs text-[#6B625B] font-medium">
            <span className="flex items-center gap-1.5">
              <span className="material-symbols-outlined text-sm text-[#B87A36]">alt_route</span>
              Resilience Actions
            </span>
            <span className="text-[#B87A36] font-semibold">{telemetry?.fallbacks_total ?? 0} Fallbacks</span>
          </div>
          <div className="text-xl font-bold text-[#2D2926] tracking-tight">
            {telemetry?.retries_total ?? 0} <span className="text-xs text-[#6B625B] font-normal">Retries</span>
          </div>
          <div className="text-[11px] text-[#6B625B]">
            {telemetry?.retries_by_reason?.rate_limit_429 ?? 0} rate-limit | {telemetry?.retries_by_reason?.server_error_5xx ?? 0} 5xx
          </div>
        </div>

        {/* Metric 4: Deduplications & Guard */}
        <div className="bg-[#FBF9F5] border border-[#E5DED6] rounded-xl p-3.5 space-y-1">
          <div className="flex items-center justify-between text-xs text-[#6B625B] font-medium">
            <span className="flex items-center gap-1.5">
              <span className="material-symbols-outlined text-sm text-[#99462A]">lock_reset</span>
              Deduplication
            </span>
            <span className="text-[#99462A] font-semibold">{telemetry?.deduplications_blocked ?? 0} Blocked</span>
          </div>
          <div className="text-xl font-bold text-[#2D2926] tracking-tight">
            100% <span className="text-xs text-[#6B625B] font-normal">Idempotent</span>
          </div>
          <div className="text-[11px] text-[#6B625B]">
            Prevented duplicate webhooks &amp; PRs
          </div>
        </div>
      </div>

      {/* Provider Circuit Breaker Matrix */}
      <div className="bg-[#FBF9F5] border border-[#E5DED6] rounded-xl p-4 space-y-3 relative z-10">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs font-semibold text-[#2D2926] uppercase tracking-wider">
            <span className="material-symbols-outlined text-sm text-[#D97757]">dynamic_form</span>
            Provider Circuit Breaker &amp; Health State
          </div>
          <span className="text-[11px] text-[#6B625B]">Threshold: 3 failures | Cooldown: 60s</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {['groq', 'gemini', 'ollama'].map((providerKey) => {
            const p = providers[providerKey] || {
              provider: providerKey,
              state: 'CLOSED',
              is_available: true,
              consecutive_failures: 0,
              total_requests: 0,
              total_successes: 0,
            };

            const isOpen = p.state === 'OPEN';
            const isHalfOpen = p.state === 'HALF_OPEN';

            return (
              <div
                key={providerKey}
                className={`p-3 rounded-lg border flex flex-col justify-between transition-all ${
                  isOpen
                    ? 'bg-[#FDF0F0] border-[#C34A4A]/40'
                    : isHalfOpen
                    ? 'bg-[#FFF9EB] border-[#B87A36]/40'
                    : 'bg-white border-[#E5DED6]'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-base text-[#6B625B]">memory</span>
                    <span className="font-semibold text-sm text-[#2D2926] capitalize">{providerKey}</span>
                  </div>
                  <span
                    className={`px-2 py-0.5 text-[10px] font-bold rounded-full ${
                      isOpen
                        ? 'bg-[#FDF0F0] text-[#C34A4A] border border-[#C34A4A]/30'
                        : isHalfOpen
                        ? 'bg-[#FFF9EB] text-[#B87A36] border border-[#B87A36]/30'
                        : 'bg-[#EDF4EA] text-[#5B7C4B] border border-[#5B7C4B]/30'
                    }`}
                  >
                    {p.state}
                  </span>
                </div>

                <div className="mt-2 flex items-center justify-between text-[11px] text-[#6B625B]">
                  <span>Success: {p.total_successes ?? 0}</span>
                  <span>Failures: {p.consecutive_failures ?? 0} / 3</span>
                </div>

                {isOpen && (
                  <div className="mt-2 text-[10px] text-[#C34A4A] flex items-center gap-1 font-mono">
                    <span className="material-symbols-outlined text-xs">warning</span>
                    Traffic bypassed to fallback
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Chaos Simulator Controls */}
      <div className="bg-[#FBF9F5] border border-[#E5DED6] rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 relative z-10">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-[#2D2926] uppercase tracking-wider">
            <span className="material-symbols-outlined text-sm text-[#D97757]">bolt</span>
            Resilience Chaos Simulator
          </div>
          <p className="text-[11px] text-[#6B625B] mt-0.5">
            Inject synthetic transient faults to observe automatic multi-provider failover
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => handleChaosSimulate('groq_rate_limit_429')}
            disabled={actionLoading}
            className="px-2.5 py-1 bg-[#F9ECE7] hover:bg-[#F2EDE6] border border-[#D97757]/30 text-[#99462A] text-xs font-medium rounded-lg transition-all"
          >
            Inject 429 Rate Limit
          </button>
          <button
            onClick={() => handleChaosSimulate('groq_server_500')}
            disabled={actionLoading}
            className="px-2.5 py-1 bg-[#FDF0F0] hover:bg-[#F9E2E2] border border-[#C34A4A]/30 text-[#C34A4A] text-xs font-medium rounded-lg transition-all"
          >
            Trip Circuit (500 Error)
          </button>
          <button
            onClick={() => handleChaosSimulate('primary_timeout')}
            disabled={actionLoading}
            className="px-2.5 py-1 bg-[#F5F0FA] hover:bg-[#EFE5F7] border border-[#7D52A0]/30 text-[#7D52A0] text-xs font-medium rounded-lg transition-all"
          >
            Simulate Timeout
          </button>
        </div>
      </div>
    </div>
  );
};

import { BASE_URL, request, actionRequest } from './client';
import type { HealthResponse, DatabaseStatusResponse } from './types';
import type { DatabaseSyncResult } from '../../types';

export const healthApi = {
  /**
   * Health Check & latency probe
   */
  async checkHealth(): Promise<{ isConnected: boolean; latency: number; health?: HealthResponse }> {
    const start = performance.now();
    try {
      const res = await fetch(`${BASE_URL}/health`, { method: 'GET', cache: 'no-store' });
      const latency = Math.round(performance.now() - start);
      if (res.ok) {
        const health = (await res.json()) as HealthResponse;
        return { isConnected: true, latency, health };
      }
      return { isConnected: false, latency };
    } catch {
      return { isConnected: false, latency: Math.round(performance.now() - start) };
    }
  },

  async getDatabaseStatus(): Promise<DatabaseStatusResponse> {
    const fallback: DatabaseStatusResponse = {
      status: 'offline',
      provider: 'sqlite_local',
      database: 'local_cache',
      connected: false,
      configured: false,
      latency_ms: 0,
      last_ping_time: Date.now(),
      collections: {
        incidents: 0,
        workflows: 0,
        agent_reasoning: 0,
        audit_logs: 0,
        logs: 0,
        settings: 0,
        deployments: 0,
        rollbacks: 0,
      },
    };
    const { data } = await request<DatabaseStatusResponse>(
      '/database/status',
      { method: 'GET' },
      fallback
    );
    return data;
  },

  async pingDatabase(): Promise<{ ok: number; status: string; database?: string; latency_ms?: number; error?: string }> {
    const { data } = await actionRequest<{ ok: number; status: string; database?: string; latency_ms?: number; error?: string }>(
      '/database/ping',
      { method: 'POST' },
      () => ({ ok: 1, status: 'connected', database: 'sentinelops (simulated)', latency_ms: 24.8 })
    );
    return data;
  },

  async syncDatabase(): Promise<DatabaseSyncResult> {
    const { data } = await actionRequest<DatabaseSyncResult>(
      '/database/sync',
      { method: 'POST' },
      () => ({
        success: true,
        message: '[Demo Mode] Operational state synchronized to sandbox (simulated)',
      })
    );
    return data;
  },
};

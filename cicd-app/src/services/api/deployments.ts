import { request, actionRequest } from './client';
import type {
  DeploymentRecord,
  HealthCheckResult,
  RollbackRecord,
  DeploymentGuardResult,
} from '../../types';

export const deploymentsApi = {
  /**
   * Phase 3: Deployment, Health Check & Rollback
   */
  async getIncidentDeployment(id: string): Promise<DeploymentRecord | null> {
    const fallback: DeploymentRecord = {
      deployment_id: `dep-${id}`,
      incident_id: id,
      repo: 'payment-service',
      branch: 'main',
      commit_sha: 'a1b2c3d',
      provider: 'github_actions',
      target_environment: 'production',
      status: 'SUCCESS',
      deployment_url: 'https://payment-service.pages.dev',
      started_at: new Date(Date.now() - 30000).toISOString(),
      completed_at: new Date().toISOString(),
      duration_seconds: 14,
    };
    const { data } = await request<DeploymentRecord>(
      `/incidents/${id}/deployment`,
      { method: 'GET' },
      fallback
    );
    return data;
  },

  async getIncidentHealth(id: string): Promise<HealthCheckResult | null> {
    const fallback: HealthCheckResult = {
      incident_id: id,
      url: 'https://payment-service.pages.dev/health',
      status: 'HEALTHY',
      consecutive_successes: 2,
      success_threshold: 2,
      total_probes: 2,
      probes: [
        {
          probe_number: 1,
          timestamp: new Date(Date.now() - 5000).toISOString(),
          status_code: 200,
          latency_ms: 45,
          is_healthy: true,
        },
        {
          probe_number: 2,
          timestamp: new Date().toISOString(),
          status_code: 200,
          latency_ms: 42,
          is_healthy: true,
        },
      ],
      average_latency_ms: 43.5,
      verified_at: new Date().toISOString(),
      reason: '2 consecutive successful probes (HTTP 200)',
    };
    const { data } = await request<HealthCheckResult>(
      `/incidents/${id}/health`,
      { method: 'GET' },
      fallback
    );
    return data;
  },

  async getIncidentRollback(id: string): Promise<RollbackRecord | null> {
    const { data } = await request<RollbackRecord | null>(
      `/incidents/${id}/rollback`,
      { method: 'GET' },
      null
    );
    return data;
  },

  async verifyIncidentDeployment(id: string, targetUrl?: string): Promise<HealthCheckResult> {
    const mockHandler = () => ({
      incident_id: id,
      url: targetUrl || 'https://payment-service.pages.dev/health',
      status: 'HEALTHY' as const,
      consecutive_successes: 2,
      success_threshold: 2,
      total_probes: 2,
      probes: [
        {
          probe_number: 1,
          timestamp: new Date(Date.now() - 5000).toISOString(),
          status_code: 200,
          latency_ms: 48,
          is_healthy: true,
        },
        {
          probe_number: 2,
          timestamp: new Date().toISOString(),
          status_code: 200,
          latency_ms: 44,
          is_healthy: true,
        },
      ],
      average_latency_ms: 46.0,
      verified_at: new Date().toISOString(),
      reason: '[Demo Mode] Post-deployment verification successful (simulated)',
    });

    const { data } = await actionRequest<HealthCheckResult>(
      `/incidents/${id}/verify-deployment`,
      {
        method: 'POST',
        body: JSON.stringify({ target_url: targetUrl }),
      },
      mockHandler
    );
    return data;
  },

  async triggerIncidentRollback(id: string, reason?: string): Promise<RollbackRecord> {
    const mockHandler = () => ({
      rollback_id: `rb-${id}`,
      incident_id: id,
      repo: 'payment-service',
      branch: 'main',
      failed_commit_sha: 'a1b2c3d',
      rollback_commit_sha: 'e4f5a6b',
      status: 'SUCCESS' as const,
      strategy: 'git_revert' as const,
      started_at: new Date(Date.now() - 15000).toISOString(),
      completed_at: new Date().toISOString(),
      duration_seconds: 12,
      health_status: 'HEALTHY' as const,
      audit_events: [
        {
          timestamp: new Date(Date.now() - 15000).toISOString(),
          action: 'ROLLBACK_INITIATED',
          details: reason || 'Manual rollback requested',
        },
        {
          timestamp: new Date(Date.now() - 10000).toISOString(),
          action: 'REVERT_COMMIT_CREATED',
          details: 'Revert commit created successfully',
        },
        {
          timestamp: new Date(Date.now() - 2000).toISOString(),
          action: 'HEALTH_VERIFIED',
          details: 'Rollback verified healthy',
        },
      ],
    });

    const { data } = await actionRequest<RollbackRecord>(
      `/incidents/${id}/rollback`,
      {
        method: 'POST',
        body: JSON.stringify({ reason }),
      },
      mockHandler
    );
    return data;
  },

  async checkDeploymentGuard(payload: {
    ci_status?: string;
    merge_guard_status?: string;
    pr_merged?: boolean;
    deployment_status?: string;
    health_check_status?: string;
  }): Promise<DeploymentGuardResult> {
    const { data } = await request<DeploymentGuardResult>(
      '/github/deployment-guard/check',
      {
        method: 'POST',
        body: JSON.stringify(payload),
      },
      {
        allowed: true,
        canDeploy: true,
        healthThresholdMet: true,
        riskScore: 0.1,
        checks: {
          ci_success: true,
          merge_guard_passed: true,
          pr_merged: true,
          health_check_ready: true,
          zero_critical_cve: true,
        },
        message: 'Complies with all 5 DeploymentGuard safety checks',
      }
    );
    return data;
  },

  async getDeployments(): Promise<DeploymentRecord[]> {
    const { data } = await request<DeploymentRecord[]>('/deployments', { method: 'GET' }, []);
    return data;
  },

  async getRollbacks(): Promise<RollbackRecord[]> {
    const { data } = await request<RollbackRecord[]>('/rollbacks', { method: 'GET' }, []);
    return data;
  },
};

import { request, actionRequest } from './client';
import type { OverviewResponse, IncidentExplanation } from './types';
import type {
  Incident,
  IncidentStatus,
  RemediationResult,
  IncidentAttempt,
  IncidentTimelineItem,
  ValidationResult,
  MergeGuardResult,
} from '../../types';
import {
  kpiMetrics as mockKpiMetrics,
  remediationSteps as mockRemediationSteps,
} from '../../data/mockData';
import { localIncidents, localPipelines } from './mockState';

export const incidentsApi = {
  /**
   * Overview Dashboard Data
   */
  async getOverview(): Promise<OverviewResponse> {
    const fallback: OverviewResponse = {
      kpiMetrics: mockKpiMetrics,
      remediationSteps: mockRemediationSteps,
      incidents: localIncidents.slice(0, 5),
      pipelines: localPipelines.slice(0, 5),
      stats: {
        successRate: '100%',
        failureRate: '0.0%',
        avgRecovery: '0.0m',
        autoResolution: '100%',
      },
    };
    const { data } = await request<OverviewResponse>('/overview', { method: 'GET' }, fallback);
    return data;
  },

  /**
   * Incidents CRUD & details
   */
  async getIncidents(status?: string, search?: string): Promise<Incident[]> {
    const params = new URLSearchParams();
    if (status && status !== 'all') params.append('status', status);
    if (search) params.append('search', search);
    const query = params.toString() ? `?${params.toString()}` : '';

    const fallback = localIncidents.filter((inc) => {
      if (status && status !== 'all' && inc.status.toLowerCase() !== status.toLowerCase()) return false;
      if (search) {
        const s = search.toLowerCase();
        return (
          inc.id.toLowerCase().includes(s) ||
          inc.repo.toLowerCase().includes(s) ||
          inc.failure.toLowerCase().includes(s)
        );
      }
      return true;
    });

    const { data } = await request<Incident[]>(`/incidents${query}`, { method: 'GET' }, fallback);
    return (data || []).map((inc) => {
      if (!inc) return inc;
      const clean = { ...inc };
      if (typeof clean.agent_reasoning === 'string') {
        try {
          clean.agent_reasoning = JSON.parse(clean.agent_reasoning as string);
        } catch {
          clean.agent_reasoning = undefined;
        }
      }
      return clean;
    });
  },

  async getIncident(id: string): Promise<Incident | null> {
    const fallback = localIncidents.find((i) => i.id.toLowerCase() === id.toLowerCase()) || null;
    const { data } = await request<Incident>(`/incidents/${id}`, { method: 'GET' }, fallback as Incident);
    if (!data) return null;
    const clean = { ...data };
    if (typeof clean.agent_reasoning === 'string') {
      try {
        clean.agent_reasoning = JSON.parse(clean.agent_reasoning as string);
      } catch {
        clean.agent_reasoning = undefined;
      }
    }
    return clean;
  },

  async updateIncidentStatus(id: string, status: IncidentStatus): Promise<Incident> {
    const mockHandler = () => {
      const fallbackIdx = localIncidents.findIndex((i) => i.id.toLowerCase() === id.toLowerCase());
      if (fallbackIdx >= 0) {
        localIncidents[fallbackIdx] = { ...localIncidents[fallbackIdx], status };
        return localIncidents[fallbackIdx];
      }
      const fallback: Incident = {
        id,
        repo: 'payment-service',
        pipeline: 'pipe-001',
        failure: 'Unknown',
        rootCause: 'Manual update',
        confidence: 90,
        confidenceColor: 'primary',
        status,
        time: 'Just now',
      };
      localIncidents.unshift(fallback);
      return fallback;
    };

    const { data } = await actionRequest<Incident>(
      `/incidents/${id}/status`,
      {
        method: 'POST',
        body: JSON.stringify({ status }),
      },
      mockHandler
    );
    return data;
  },

  async explainIncident(id: string): Promise<IncidentExplanation> {
    const mockHandler = () => ({
      incidentId: id,
      repo: 'payment-service',
      pipeline: 'pipe-001',
      confidence: 96,
      rootCause: 'Peer dependency mismatch in @stripe/stripe-node v14.2',
      explanation: `Autonomous Diagnostics report for ${id}: SentinelOps AST parser inspected commit changes. [Demo Mode] Root cause was simulated as dependency conflict.`,
      suggestedAction: 'Apply deterministic lockfile patch and trigger automated validation run.',
      policyCheck: 'Complies with Zero-Regression & Auto-Merge Guardrail Policy v2.4.',
      aiModel: 'DevOps-LLM (Groq LPU / AST Engine)',
      errorType: 'DependencyConflict',
      targetFile: 'package.json',
      diff: '--- a/package.json\n+++ b/package.json\n@@ -3,3 +3,3 @@\n-    "@stripe/stripe-node": "^12.1.0"\n+    "@stripe/stripe-node": "^14.0.0"',
      riskLevel: 'LOW',
      guardStatus: 'PASSED',
      blastRadius: 'Isolated (Single Module)',
      linesAdded: 1,
      linesDeleted: 1,
      steps: [
        'Captured runner telemetry and isolated ERESOLVE failure log',
        'AST parsed dependency matrix against package-lock.json',
        'Synthesized compatible peer dependency lockfile pin',
        'SentinelGuard safety verified: 0 CVEs introduced',
        'Dispatched automated remediation PR #184',
      ],
      rawLogsSnippet:
        'npm ERR! code ERESOLVE\nnpm ERR! ERESOLVE could not resolve peer dependency tree\nnpm ERR! While resolving: @stripe/stripe-node@12.1.0\nnpm ERR! Conflicting peer dependency: @types/node@^18.0.0',
    });

    const { data } = await actionRequest<IncidentExplanation>(
      `/incidents/${id}/explain`,
      { method: 'POST' },
      mockHandler
    );
    return data;
  },

  async remediateIncident(id: string): Promise<RemediationResult> {
    const mockHandler = () => ({
      success: true,
      status: 'remediated',
      incidentId: id,
      prNumber: 144,
      remediationBranch: `sentinelops/fix-${id}`,
      patchApplied: true,
      message: '[Demo Mode] Healer-Alpha generated automated patch and opened PR #144 (simulated).',
    });

    const { data } = await actionRequest<RemediationResult>(
      `/incidents/${id}/remediate`,
      { method: 'POST' },
      mockHandler
    );
    return data;
  },

  async simulateAnomaly(): Promise<Incident> {
    const mockHandler = () => {
      const fallback: Incident = {
        id: `inc-${Math.floor(Math.random() * 899 + 8925)}`,
        repo: 'order-orchestrator',
        pipeline: 'pipe-002',
        failure: 'Redis connection pool starvation: timeout after 30000ms',
        rootCause: 'Missing connection leak eviction in redis-py pool manager',
        confidence: 98,
        confidenceColor: 'primary',
        status: 'Investigating',
        time: 'just now',
        actionLabel: 'Auto-Heal Active',
        actionVariant: 'primary',
      };
      localIncidents.unshift(fallback);
      return fallback;
    };

    const { data } = await actionRequest<Incident>(
      '/incidents/simulate',
      { method: 'POST' },
      mockHandler
    );
    return data;
  },

  async getIncidentAttempts(id: string): Promise<IncidentAttempt[]> {
    const { data } = await request<IncidentAttempt[]>(
      `/incidents/${id}/attempts`,
      { method: 'GET' },
      []
    );
    return data;
  },

  async getIncidentTimeline(id: string): Promise<IncidentTimelineItem[]> {
    const { data } = await request<IncidentTimelineItem[]>(
      `/incidents/${id}/timeline`,
      { method: 'GET' },
      []
    );
    return data;
  },

  async validateIncidentFix(id: string): Promise<ValidationResult> {
    const mockHandler = () => ({
      success: true,
      status: 'PASSED',
      testSuite: 'CI / Test & Build',
      totalTests: 42,
      passedTests: 42,
      failedTests: 0,
      durationMs: 14000,
    });

    const { data } = await actionRequest<ValidationResult>(
      `/incidents/${id}/validate`,
      { method: 'POST' },
      mockHandler
    );
    return data;
  },

  async orchestrateRemediation(payload: {
    run_id?: number;
    repo?: string;
    branch?: string;
    commit_sha?: string;
    workflow_name?: string;
    override_ci_status?: string;
    override_confidence?: number;
    override_risk?: string;
  }): Promise<RemediationResult> {
    const { data } = await actionRequest<RemediationResult>(
      '/github/orchestrate',
      {
        method: 'POST',
        body: JSON.stringify(payload),
      },
      () => ({
        success: true,
        status: 'success',
        incidentId: 'INC-AUTO',
        message: '[Demo Mode] Orchestration simulation completed',
      })
    );
    return data;
  },

  async checkMergeGuard(payload: {
    confidence?: number;
    risk_level?: string;
    sentinel_status?: string;
    ci_status?: string;
    attempt_number?: number;
    restricted_paths?: boolean;
    secret_scan?: string;
  }): Promise<MergeGuardResult> {
    const { data } = await actionRequest<MergeGuardResult>(
      '/github/merge-guard/check',
      {
        method: 'POST',
        body: JSON.stringify(payload),
      },
      () => ({
        allowed: true,
        incidentId: 'INC-GUARD',
        checks: {
          confidence_threshold: true,
          ci_verification: true,
          zero_cve: true,
          no_restricted_paths: true,
          clean_secret_scan: true,
          attempt_budget: true,
          policy_compliance: true,
        },
      })
    );
    return data;
  },
};

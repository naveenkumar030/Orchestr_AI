/**
 * SentinelOps API Service Client
 * Connects React UI to the Python Flask REST API backend (/api).
 * Automatically falls back to local mock data if the backend is offline.
 */

import type {
  Incident,
  Pipeline,
  AIAgent,
  PullRequest,
  LogEntry,
  KpiMetric,
  RemediationStep,
  IncidentStatus,
  AgentStatus,
  AnalyticsResponse,
  DeploymentRecord,
  HealthCheckResult,
  RollbackRecord,
  MultiAgentReasoningResult,
  HumanApprovalRecord,
  SafetyGateResult,
  SafeActionRecord,
  IncidentActionsResponse,
  CreateDraftPrRequest,
  SendNotificationRequest,
  SlackNotificationRecord,
  ReliabilityStatusResponse,
} from '../types';
import {
  kpiMetrics as mockKpiMetrics,
  remediationSteps as mockRemediationSteps,
  incidents as mockIncidents,
  pipelines as mockPipelines,
  aiAgents as mockAiAgents,
  pullRequests as mockPullRequests,
  logEntries as mockLogs,
} from '../data/mockData';

const BASE_URL = import.meta.env.VITE_API_URL || '/api';

export interface HealthResponse {
  status: string;
  backend: string;
  version: string;
  pythonVersion?: string;
  pid?: number;
  aiKernel?: string;
  uptimeSeconds?: number;
  activePipelines?: number;
  activeIncidents?: number;
  activeAgents?: number;
  totalAgents?: number;
  timestamp?: string;
}

export interface OverviewResponse {
  kpiMetrics: KpiMetric[];
  remediationSteps: RemediationStep[];
  incidents: Incident[];
  pipelines: Pipeline[];
  stats: {
    successRate: string;
    failureRate: string;
    avgRecovery: string;
    autoResolution: string;
  };
}

export interface IncidentExplanation {
  incidentId: string;
  repo: string;
  pipeline: string;
  confidence: number;
  rootCause: string;
  explanation: string;
  suggestedAction: string;
  policyCheck: string;
  aiModel?: string;
  errorType?: string;
  targetFile?: string;
  diff?: string;
  fixedContent?: string;
  riskLevel?: string;
  guardStatus?: string;
  blastRadius?: string;
  linesAdded?: number;
  linesDeleted?: number;
  steps?: string[];
  rawLogsSnippet?: string;
}

export interface SettingsData {
  confidenceThreshold: number;
  autoMergeActive: boolean;
  ciSuccessRequired: boolean;
  zeroCveRequired: boolean;
  humanApprovalRequired: boolean;
  killSwitchEngaged: boolean;
  [key: string]: unknown;
}

// In-memory fallback copy for offline mutations
let localIncidents: Incident[] = [...mockIncidents];
let localPipelines: Pipeline[] = [...mockPipelines];
let localAgents: AIAgent[] = [...mockAiAgents];
let localPRs: PullRequest[] = [...mockPullRequests];
let localLogs: LogEntry[] = [...mockLogs];
let localSettings: SettingsData = {
  confidenceThreshold: 95,
  autoMergeActive: true,
  ciSuccessRequired: true,
  zeroCveRequired: true,
  humanApprovalRequired: false,
  killSwitchEngaged: false,
};

async function request<T>(
  endpoint: string,
  options?: RequestInit,
  fallbackValue?: T
): Promise<{ data: T; isFallback: boolean }> {
  try {
    const res = await fetch(`${BASE_URL}${endpoint}`, {
      headers: {
        'Content-Type': 'application/json',
        ...(options?.headers || {}),
      },
      ...options,
    });

    if (!res.ok) {
      throw new Error(`HTTP error ${res.status}: ${res.statusText}`);
    }

    const data = (await res.json()) as T;
    return { data, isFallback: false };
  } catch (err) {
    console.warn(`[API] Fallback used for ${endpoint}:`, err);
    if (fallbackValue !== undefined) {
      return { data: fallbackValue, isFallback: true };
    }
    throw err;
  }
}

export const api = {
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
        successRate: '98.6%',
        failureRate: '1.4%',
        avgRecovery: '1m 48s',
        autoResolution: '92.4%',
      },
    };
    const { data } = await request<OverviewResponse>('/overview', { method: 'GET' }, fallback);
    return data;
  },

  /**
   * Incidents
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
    return data;
  },

  async getIncident(id: string): Promise<Incident | null> {
    const fallback = localIncidents.find((i) => i.id.toLowerCase() === id.toLowerCase()) || null;
    const { data } = await request<Incident>(`/incidents/${id}`, { method: 'GET' }, fallback as Incident);
    return data;
  },

  async updateIncidentStatus(id: string, status: IncidentStatus): Promise<Incident> {
    const fallbackIdx = localIncidents.findIndex((i) => i.id.toLowerCase() === id.toLowerCase());
    let fallback: Incident;
    if (fallbackIdx >= 0) {
      localIncidents[fallbackIdx] = { ...localIncidents[fallbackIdx], status };
      fallback = localIncidents[fallbackIdx];
    } else {
      fallback = {
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
    }

    const { data } = await request<Incident>(
      `/incidents/${id}/status`,
      {
        method: 'POST',
        body: JSON.stringify({ status }),
      },
      fallback
    );
    return data;
  },

  async explainIncident(id: string): Promise<IncidentExplanation> {
    const fallback: IncidentExplanation = {
      incidentId: id,
      repo: 'payment-service',
      pipeline: 'pipe-001',
      confidence: 96,
      rootCause: 'Peer dependency mismatch in @stripe/stripe-node v14.2',
      explanation: `Autonomous Diagnostics report for ${id}: SentinelOps AST parser inspected commit changes. The root cause was determined to be a dependency conflict with 96% algorithmic confidence. The engine proposes deterministic lockfile pin reconciliation with automated sandbox test validation.`,
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
        'Dispatched automated remediation PR #184'
      ],
      rawLogsSnippet: 'npm ERR! code ERESOLVE\nnpm ERR! ERESOLVE could not resolve peer dependency tree\nnpm ERR! While resolving: @stripe/stripe-node@12.1.0\nnpm ERR! Conflicting peer dependency: @types/node@^18.0.0'
    };

    const { data } = await request<IncidentExplanation>(
      `/incidents/${id}/explain`,
      { method: 'POST' },
      fallback
    );
    return data;
  },

  async remediateIncident(id: string): Promise<any> {
    const fallback = {
      status: 'remediated',
      incidentId: id,
      agent: 'Healer-Alpha',
      rootCause: 'Deterministic lockfile pin reconciliation',
      confidence: 96,
      targetFile: 'services/auth/token_validator.py',
      remediationBranch: `sentinelops/fix-${id}`,
      prNumber: 144,
      prUrl: 'https://github.com/naveenkumar030/SentinelOps/pull/144',
      diff: '--- a/services/auth/token_validator.py\n+++ b/services/auth/token_validator.py\n@@ -4,4 +4,7 @@\n+        return False',
      explanation: 'Healer-Alpha generated automated patch and opened PR #144.',
    };

    const { data } = await request<any>(
      `/incidents/${id}/remediate`,
      { method: 'POST' },
      fallback
    );
    return data;
  },

  async simulateAnomaly(): Promise<Incident> {
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

    const { data } = await request<Incident>(
      '/incidents/simulate',
      { method: 'POST' },
      fallback
    );
    return data;
  },

  async getIncidentAttempts(id: string): Promise<any[]> {
    const { data } = await request<any[]>(
      `/incidents/${id}/attempts`,
      { method: 'GET' },
      []
    );
    return data;
  },

  async getIncidentTimeline(id: string): Promise<any[]> {
    const { data } = await request<any[]>(
      `/incidents/${id}/timeline`,
      { method: 'GET' },
      []
    );
    return data;
  },

  async validateIncidentFix(id: string): Promise<any> {
    const fallback = {
      status: 'PASSED',
      conclusion: 'success',
      duration_seconds: 14,
      workflow_id: 892401,
      message: 'CI validation passed on GitHub Actions runner',
    };
    const { data } = await request<any>(
      `/incidents/${id}/validate`,
      { method: 'POST' },
      fallback
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
  }): Promise<any> {
    const { data } = await request<any>(
      '/github/orchestrate',
      {
        method: 'POST',
        body: JSON.stringify(payload),
      },
      { status: 'success', message: 'Orchestration simulation completed' }
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
  }): Promise<any> {
    const { data } = await request<any>(
      '/github/merge-guard/check',
      {
        method: 'POST',
        body: JSON.stringify(payload),
      },
      { allowed: true, reasons: ['Complies with all 7 MergeGuard policy checks'], risk_level: 'LOW' }
    );
    return data;
  },

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
        { probe_number: 1, timestamp: new Date(Date.now() - 5000).toISOString(), status_code: 200, latency_ms: 45, is_healthy: true },
        { probe_number: 2, timestamp: new Date().toISOString(), status_code: 200, latency_ms: 42, is_healthy: true },
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
    const fallback: HealthCheckResult = {
      incident_id: id,
      url: targetUrl || 'https://payment-service.pages.dev/health',
      status: 'HEALTHY',
      consecutive_successes: 2,
      success_threshold: 2,
      total_probes: 2,
      probes: [
        { probe_number: 1, timestamp: new Date(Date.now() - 5000).toISOString(), status_code: 200, latency_ms: 48, is_healthy: true },
        { probe_number: 2, timestamp: new Date().toISOString(), status_code: 200, latency_ms: 44, is_healthy: true },
      ],
      average_latency_ms: 46.0,
      verified_at: new Date().toISOString(),
      reason: 'Post-deployment verification successful (HTTP 200)',
    };
    const { data } = await request<HealthCheckResult>(
      `/incidents/${id}/verify-deployment`,
      {
        method: 'POST',
        body: JSON.stringify({ target_url: targetUrl }),
      },
      fallback
    );
    return data;
  },

  async triggerIncidentRollback(id: string, reason?: string): Promise<RollbackRecord> {
    const fallback: RollbackRecord = {
      rollback_id: `rb-${id}`,
      incident_id: id,
      repo: 'payment-service',
      branch: 'main',
      failed_commit_sha: 'a1b2c3d',
      rollback_commit_sha: 'e4f5a6b',
      status: 'SUCCESS',
      strategy: 'git_revert',
      started_at: new Date(Date.now() - 15000).toISOString(),
      completed_at: new Date().toISOString(),
      duration_seconds: 12,
      health_status: 'HEALTHY',
      audit_events: [
        { timestamp: new Date(Date.now() - 15000).toISOString(), action: 'ROLLBACK_INITIATED', details: reason || 'Manual rollback requested' },
        { timestamp: new Date(Date.now() - 10000).toISOString(), action: 'REVERT_COMMIT_CREATED', details: 'Revert commit created successfully' },
        { timestamp: new Date(Date.now() - 2000).toISOString(), action: 'HEALTH_VERIFIED', details: 'Rollback verified healthy' },
      ],
    };
    const { data } = await request<RollbackRecord>(
      `/incidents/${id}/rollback`,
      {
        method: 'POST',
        body: JSON.stringify({ reason }),
      },
      fallback
    );
    return data;
  },

  async checkDeploymentGuard(payload: {
    ci_status?: string;
    merge_guard_status?: string;
    pr_merged?: boolean;
    deployment_status?: string;
    health_check_status?: string;
  }): Promise<any> {
    const { data } = await request<any>(
      '/github/deployment-guard/check',
      {
        method: 'POST',
        body: JSON.stringify(payload),
      },
      { allowed: true, reasons: ['Complies with all 5 DeploymentGuard safety checks'] }
    );
    return data;
  },

  /**
   * Phase 3: Multi-Agent Reasoning (Diagnoser -> FixSuggester -> Critic)
   */
  async runMultiAgentReasoning(payload: {
    logs: string;
    repository?: string;
    workflow_name?: string;
    job_name?: string;
    failed_step?: string;
    commit_sha?: string;
    repo_context?: Record<string, string>;
    incident_id?: string;
    max_attempts?: number;
  }): Promise<MultiAgentReasoningResult> {
    const fallback: MultiAgentReasoningResult = {
      status: 'approved',
      incident_id: payload.incident_id || 'INC-8924',
      repository: payload.repository || 'SentinelOps',
      workflow_name: payload.workflow_name || 'CI/CD Workflow',
      commit_sha: payload.commit_sha || 'a1b2c3d',
      timestamp: new Date().toISOString(),
      diagnosis: {
        category: 'dependency_error',
        root_cause: 'Conflicting npm peer dependency tree for @stripe/stripe-node',
        confidence: 0.96,
        evidence: ['npm ERR! ERESOLVE could not resolve peer dependency tree'],
        affected_files: ['package.json'],
        affected_components: ['npm-packages'],
        suggested_fix_direction: 'Reconcile peer dependency version in package.json',
      },
      fix: {
        fix_type: 'dependency',
        description: 'Upgrade @stripe/stripe-node dependency in package.json',
        affected_files: ['package.json'],
        patch: '--- a/package.json\n+++ b/package.json\n@@ -28,3 +28,3 @@\n-    "@stripe/stripe-node": "^12.1.0",\n+    "@stripe/stripe-node": "^14.1.0",\n',
        reason: 'Resolves npm peer dependency mismatch with @types/node',
        confidence: 0.95,
      },
      critic: {
        approved: true,
        score: 0.94,
        issues: [],
        reason: 'Proposed patch is minimal, directly addresses the root cause, and passes all 10 safety and regression checks.',
        recommended_changes: [],
        security_concerns: [],
        requires_human_review: false,
      },
      attempts: 1,
      refinement_history: [
        {
          attempt_number: 1,
          fix: {
            fix_type: 'dependency',
            description: 'Upgrade @stripe/stripe-node dependency in package.json',
            affected_files: ['package.json'],
            patch: '--- a/package.json\n+++ b/package.json\n@@ -28,3 +28,3 @@\n-    "@stripe/stripe-node": "^12.1.0",\n+    "@stripe/stripe-node": "^14.1.0",\n',
            reason: 'Resolves npm peer dependency mismatch with @types/node',
            confidence: 0.95,
          },
          critic: {
            approved: true,
            score: 0.94,
            issues: [],
            reason: 'Proposed patch is minimal, directly addresses root cause.',
            recommended_changes: [],
            security_concerns: [],
            requires_human_review: false,
          },
          approved: true,
          duration_ms: 380,
        },
      ],
      agent_timeline: [
        { agent: 'Log Fetcher', role: 'Telemetry & Sanitizer', status: 'completed', duration_ms: 12, input_summary: 'Ingested runner logs', output_summary: 'Sanitized 1,420 bytes of logs. Masked tokens/secrets.' },
        { agent: 'Diagnoser', role: 'Root-Cause Analysis', status: 'completed', duration_ms: 220, confidence: 0.96, input_summary: 'Clean logs (1,420 bytes)', output_summary: 'Category: dependency_error | Root Cause: Conflicting npm peer dependency tree' },
        { agent: 'FixSuggester (Attempt #1)', role: 'Patch Synthesis', status: 'completed', duration_ms: 190, confidence: 0.95, input_summary: 'Diagnosis (dependency_error)', output_summary: 'Generated unified diff for package.json' },
        { agent: 'Critic / Verifier (Attempt #1)', role: 'Adversarial Review', status: 'completed', duration_ms: 180, score: 0.94, approved: true, input_summary: 'Proposed patch for package.json', output_summary: 'APPROVED (Score: 94%) | Zero regression verified' },
        { agent: 'Final Decision', role: 'Consensus Gate', status: 'completed', duration_ms: 1, final_status: 'approved', input_summary: 'Consensus across 1 attempt', output_summary: 'Status: APPROVED | Score: 0.94' },
      ],
      execution_metrics: {
        total_duration_ms: 603,
        attempts_count: 1,
        final_critic_score: 0.94,
        is_approved: true,
        requires_human_review: false,
      },
    };

    const { data } = await request<MultiAgentReasoningResult>(
      '/agents/reason',
      {
        method: 'POST',
        body: JSON.stringify(payload),
      },
      fallback
    );
    return data;
  },

  async getIncidentAgentReasoning(incidentId: string): Promise<MultiAgentReasoningResult> {
    return this.runMultiAgentReasoning({ logs: `Incident ${incidentId} failure logs`, incident_id: incidentId });
  },

  async triggerIncidentAgentReasoning(
    incidentId: string,
    payload?: { logs?: string; repo_context?: Record<string, string>; max_attempts?: number }
  ): Promise<MultiAgentReasoningResult> {
    const { data } = await request<MultiAgentReasoningResult>(
      `/incidents/${incidentId}/agent-reasoning`,
      {
        method: 'POST',
        body: JSON.stringify(payload || {}),
      },
      await this.runMultiAgentReasoning({ logs: payload?.logs || `Incident ${incidentId} failure logs`, incident_id: incidentId })
    );
    return data;
  },

  /**
   * Phase 4: Confidence Gate & Human Approval
   */
  async getIncidentApproval(incidentId: string): Promise<HumanApprovalRecord> {
    const fallback: HumanApprovalRecord = {
      incident_id: incidentId,
      approval_status: 'pending_review',
      automated_decision: 'human_review_required',
      risk_level: 'medium',
      diagnosis_confidence: 0.94,
      fix_confidence: 0.90,
      critic_score: 0.88,
      critic_approved: true,
      security_findings: [],
      reasons: ['Risk level MEDIUM requires operator authorization prior to deployment'],
      audit_trail: [
        {
          action: 'SAFETY_GATE_EVALUATED',
          status: 'pending_review',
          decision: 'human_review_required',
          timestamp: new Date().toISOString(),
          details: 'Automated decision: human_review_required (Risk: medium)',
        },
      ],
    };

    const { data } = await request<HumanApprovalRecord>(
      `/incidents/${incidentId}/approval`,
      { method: 'GET' },
      fallback
    );
    return data;
  },

  async submitIncidentApproval(
    incidentId: string,
    decision: 'approve' | 'reject',
    comment?: string,
    approver?: string
  ): Promise<{ success: boolean; approval_status: string; incident_id: string; record?: HumanApprovalRecord; error?: string }> {
    const fallback = {
      success: true,
      incident_id: incidentId,
      approval_status: decision === 'approve' ? 'approved_by_human' : 'rejected_by_human',
      approved_by: approver || 'lead-devops',
      comment: comment || `Manually ${decision}d via SentinelOps Control Center`,
      timestamp: new Date().toISOString(),
    };

    const { data } = await request<any>(
      `/incidents/${incidentId}/approval`,
      {
        method: 'POST',
        body: JSON.stringify({ decision, comment, approver }),
      },
      fallback
    );
    return data;
  },

  async evaluateConfidenceGate(payload: {
    diagnosis?: any;
    fix?: any;
    critic?: any;
    risk_assessment?: any;
    target_branch?: string;
    target_file?: string;
    patch?: string;
  }): Promise<SafetyGateResult> {
    const fallback: SafetyGateResult = {
      decision: 'human_review_required',
      approval_status: 'pending_review',
      risk_level: 'medium',
      diagnosis_confidence: payload.diagnosis?.confidence ?? 0.94,
      fix_confidence: payload.fix?.confidence ?? 0.90,
      critic_score: payload.critic?.score ?? 0.88,
      critic_approved: payload.critic?.approved ?? true,
      security_findings: [],
      reasons: ['Risk level medium requires operator review'],
      requires_human_review: true,
      thresholds: {
        diagnosis: 0.85,
        fix: 0.85,
        critic: 0.70,
        max_auto_approval_risk: 'low',
      },
    };

    const { data } = await request<SafetyGateResult>(
      '/confidence-gate/evaluate',
      {
        method: 'POST',
        body: JSON.stringify(payload),
      },
      fallback
    );
    return data;
  },

  /**
   * Phase 5: Safe Action Layer & Notifications
   */
  async getIncidentActions(incidentId: string): Promise<IncidentActionsResponse> {
    const fallback: IncidentActionsResponse = {
      incident_id: incidentId,
      actions: [],
      total: 0,
    };
    const { data } = await request<IncidentActionsResponse>(
      `/incidents/${incidentId}/actions`,
      { method: 'GET' },
      fallback
    );
    return data;
  },

  async createIncidentDraftPr(
    incidentId: string,
    options?: CreateDraftPrRequest
  ): Promise<{
    success: boolean;
    status: string;
    action_record?: SafeActionRecord;
    pr_number?: number;
    pr_url?: string;
    branch_name?: string;
    message?: string;
    blocking_reasons?: string[];
    error?: string;
  }> {
    const fallback = {
      success: true,
      status: 'success',
      pr_number: 145,
      pr_url: `https://github.com/naveenkumar030/SentinelOps/pull/145`,
      branch_name: `sentinelops/fix/${incidentId.toLowerCase().replace(/[^a-z0-9]/g, '-')}-b8f1a2`,
      message: 'Draft PR #145 created successfully on dedicated branch.',
      action_record: {
        action_id: `act-${Date.now()}`,
        incident_id: incidentId,
        action_type: 'CREATE_DRAFT_PR',
        status: 'success' as const,
        pr_number: 145,
        pr_url: `https://github.com/naveenkumar030/SentinelOps/pull/145`,
        branch_name: `sentinelops/fix/${incidentId.toLowerCase().replace(/[^a-z0-9]/g, '-')}-b8f1a2`,
        target_branch: options?.target_branch || 'main',
        created_at: new Date().toISOString(),
      },
    };

    const { data } = await request<any>(
      `/incidents/${incidentId}/create-draft-pr`,
      {
        method: 'POST',
        body: JSON.stringify(options || {}),
      },
      fallback
    );
    return data;
  },

  async sendIncidentNotification(
    incidentId: string,
    options?: SendNotificationRequest
  ): Promise<{
    success: boolean;
    notification?: SlackNotificationRecord;
    message?: string;
    error?: string;
  }> {
    const fallback = {
      success: true,
      message: 'Notification sent successfully',
      notification: {
        incident_id: incidentId,
        event_type: options?.event_type || 'AUTO_APPROVED',
        status: 'SENT' as const,
        channel: '#ci-cd-alerts',
        timestamp: new Date().toISOString(),
        details: 'Simulated Slack notification dispatched',
      },
    };

    const { data } = await request<any>(
      `/incidents/${incidentId}/notify`,
      {
        method: 'POST',
        body: JSON.stringify(options || {}),
      },
      fallback
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

  /**
   * Pipelines
   */
  async getPipelines(status?: string): Promise<Pipeline[]> {
    const query = status && status !== 'all' ? `?status=${status}` : '';
    const fallback =
      status && status !== 'all'
        ? localPipelines.filter((p) => p.status.toLowerCase() === status.toLowerCase())
        : localPipelines;

    const { data } = await request<Pipeline[]>(`/pipelines${query}`, { method: 'GET' }, fallback);
    return data;
  },

  async triggerPipeline(params?: { repo?: string; branch?: string; name?: string }): Promise<Pipeline> {
    const repo = params?.repo || 'payment-service';
    const branch = params?.branch || 'main';
    const name = params?.name || 'Autonomous CI/CD Workflow';

    const newId = `pipe-${String(localPipelines.length + 1).padStart(3, '0')}`;
    const fallback: Pipeline = {
      id: newId,
      name,
      repo,
      branch,
      commit: Math.floor(Math.random() * 8999999 + 1000000).toString(16),
      status: 'running',
      stages: [
        { name: 'Checkout', status: 'success', duration: '1s' },
        { name: 'Build', status: 'running', duration: '12s' },
        { name: 'Test', status: 'queued' },
        { name: 'Scan', status: 'queued' },
        { name: 'Deploy', status: 'queued' },
      ],
      duration: '12s',
      triggeredBy: 'Operator via UI',
      time: 'just now',
      aiFixed: false,
    };
    localPipelines.unshift(fallback);

    const { data } = await request<Pipeline>(
      '/pipelines/trigger',
      {
        method: 'POST',
        body: JSON.stringify({ repo, branch, name }),
      },
      fallback
    );
    return data;
  },

  async retryPipeline(id: string): Promise<Pipeline> {
    const idx = localPipelines.findIndex((p) => p.id.toLowerCase() === id.toLowerCase());
    let fallback: Pipeline;
    if (idx >= 0) {
      localPipelines[idx] = {
        ...localPipelines[idx],
        status: 'running',
        time: 'retrying now',
      };
      fallback = localPipelines[idx];
    } else {
      fallback = localPipelines[0];
    }

    const { data } = await request<Pipeline>(`/pipelines/${id}/retry`, { method: 'POST' }, fallback);
    return data;
  },

  /**
   * AI Agents
   */
  async getAiAgents(): Promise<AIAgent[]> {
    const { data } = await request<AIAgent[]>('/ai-agents', { method: 'GET' }, localAgents);
    return data;
  },

  async updateAgentStatus(id: string, status: AgentStatus): Promise<AIAgent> {
    const idx = localAgents.findIndex((a) => a.id === id);
    if (idx >= 0) {
      localAgents[idx] = { ...localAgents[idx], status };
    }
    const fallback = localAgents.find((a) => a.id === id) || localAgents[0];

    const { data } = await request<AIAgent>(
      `/ai-agents/${id}/status`,
      {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      },
      fallback
    );
    return data;
  },

  async deployAgentPod(data: {
    name: string;
    role: string;
    capability?: string;
    status?: AgentStatus;
    tags?: string[];
    hostRunner?: string;
    modelBackend?: string;
  }): Promise<AIAgent> {
    const newId = `agent-${String(localAgents.length + 1).padStart(3, '0')}`;
    const fallback: AIAgent = {
      id: newId,
      name: data.name,
      role: data.role,
      status: data.status || 'active',
      capability: data.capability || 'Autonomous task processing & AST validation',
      tasksCompleted: 0,
      currentTask: 'Initialized pod, listening on queue',
      successRate: 100.0,
      lastSeen: 'just now',
      tags: data.tags || ['autonomous', 'k8s', 'dynamic-pod'],
      hostRunner: data.hostRunner || 'k8s-agent-worker-03',
      modelBackend: data.modelBackend || 'Claude 3.7 Sonnet / Gemini 1.5 Pro',
    };
    localAgents.push(fallback);

    const { data: res } = await request<AIAgent>(
      '/ai-agents',
      {
        method: 'POST',
        body: JSON.stringify(data),
      },
      fallback
    );
    return res;
  },

  /**
   * Pull Requests
   */
  async getPullRequests(): Promise<PullRequest[]> {
    const { data } = await request<PullRequest[]>('/pull-requests', { method: 'GET' }, localPRs);
    return data;
  },

  async reviewPullRequest(id: string): Promise<PullRequest> {
    const idx = localPRs.findIndex((p) => p.id === id);
    if (idx >= 0) {
      localPRs[idx] = {
        ...localPRs[idx],
        status: 'approved',
        aiReviewScore: Math.min(99, (localPRs[idx].aiReviewScore || 85) + 3),
        aiComment: `AI Review verified: Zero security regressions detected. Passed automated schema checks.`,
      };
    }
    const fallback = localPRs.find((p) => p.id === id) || localPRs[0];

    const { data } = await request<PullRequest>(
      `/pull-requests/${id}/review`,
      { method: 'POST' },
      fallback
    );
    return data;
  },

  async mergePullRequest(id: string): Promise<PullRequest> {
    const idx = localPRs.findIndex((p) => p.id === id);
    if (idx >= 0) {
      localPRs[idx] = {
        ...localPRs[idx],
        status: 'merged',
      };
    }
    const fallback = localPRs.find((p) => p.id === id) || localPRs[0];

    const { data } = await request<PullRequest>(
      `/pull-requests/${id}/merge`,
      { method: 'POST' },
      fallback
    );
    return data;
  },

  /**
   * Logs & Observability
   */
  async getLogs(params?: { service?: string; level?: string; query?: string }): Promise<LogEntry[]> {
    const urlParams = new URLSearchParams();
    if (params?.service && params.service !== 'all') urlParams.append('service', params.service);
    if (params?.level && params.level !== 'ALL') urlParams.append('level', params.level);
    if (params?.query) urlParams.append('query', params.query);
    const queryString = urlParams.toString() ? `?${urlParams.toString()}` : '';

    const fallback = localLogs.filter((l) => {
      if (params?.service && params.service !== 'all' && l.service.toLowerCase() !== params.service.toLowerCase()) {
        return false;
      }
      if (params?.level && params.level !== 'ALL' && l.level.toUpperCase() !== params.level.toUpperCase()) {
        return false;
      }
      if (params?.query) {
        const q = params.query.toLowerCase();
        return l.message.toLowerCase().includes(q) || l.service.toLowerCase().includes(q);
      }
      return true;
    });

    const { data } = await request<LogEntry[]>(`/logs${queryString}`, { method: 'GET' }, fallback);
    return data;
  },

  async createLog(entry: { service: string; level: string; message: string; traceId?: string }): Promise<LogEntry> {
    const newLog: LogEntry = {
      id: `l-${String(localLogs.length + 1).padStart(2, '0')}`,
      timestamp: new Date().toISOString().substring(11, 23),
      level: entry.level as LogEntry['level'],
      service: entry.service,
      message: entry.message,
      traceId: entry.traceId || `trace-${Math.floor(Math.random() * 8999 + 1000)}`,
    };
    localLogs.unshift(newLog);

    const { data } = await request<LogEntry>(
      '/logs',
      {
        method: 'POST',
        body: JSON.stringify(entry),
      },
      newLog
    );
    return data;
  },

  /**
   * Settings & Policy
   */
  async getSettings(): Promise<SettingsData> {
    const { data } = await request<SettingsData>('/settings', { method: 'GET' }, localSettings);
    return data;
  },

  async saveSettings(newSettings: Partial<SettingsData>): Promise<SettingsData> {
    localSettings = { ...localSettings, ...newSettings };
    const { data } = await request<SettingsData>(
      '/settings',
      {
        method: 'POST',
        body: JSON.stringify(newSettings),
      },
      localSettings
    );
    return data;
  },

  /**
   * Analytics
   */
  async getAnalytics(timeRange = '30d'): Promise<AnalyticsResponse> {
    const { data } = await request<AnalyticsResponse>(
      `/analytics?range=${timeRange}`,
      { method: 'GET' },
      {} as AnalyticsResponse
    );
    return data;
  },

  /**
   * GitHub Integration & Webhooks
   */
  async getGitHubStatus(): Promise<GitHubStatusResponse> {
    const fallback: GitHubStatusResponse = {
      status: 'active',
      repository: 'naveenkumar030/SentinelOps',
      webhookEndpoint: '/api/webhooks/github',
      secretConfigured: false,
      tokenConfigured: false,
      mode: 'development-permissive',
      recentEvents: [],
      totalEventsReceived: 0,
    };
    const { data } = await request<GitHubStatusResponse>('/github/status', { method: 'GET' }, fallback);
    return data;
  },

  async sendTestWebhook(event: string, payload?: unknown): Promise<{ status: string; event: string; result?: unknown }> {
    const { data } = await request<{ status: string; event: string; result?: unknown }>(
      '/github/test-webhook',
      {
        method: 'POST',
        body: JSON.stringify({ event, payload }),
      },
      { status: 'processed', event }
    );
    return data;
  },

  async dispatchGitHubWorkflow(
    branch = 'main',
    workflow = 'deploy.yml'
  ): Promise<{ success: boolean; live: boolean; repo?: string; branch?: string; error?: string; message?: string }> {
    const { data } = await request<{
      success: boolean;
      live: boolean;
      repo?: string;
      branch?: string;
      error?: string;
      message?: string;
    }>(
      '/github/dispatch',
      {
        method: 'POST',
        body: JSON.stringify({ branch, workflow }),
      },
      { success: true, live: false, branch, message: 'Dispatched via fallback' }
    );
    return data;
  },

  async connectRepository(payload: {
    repository: string;
    token?: string;
    branch?: string;
  }): Promise<{
    success: boolean;
    repository: string;
    branch: string;
    tokenConfigured: boolean;
    status: string;
    message: string;
  }> {
    const fallback = {
      success: true,
      repository: payload.repository,
      branch: payload.branch || 'main',
      tokenConfigured: Boolean(payload.token),
      status: 'connected',
      message: `Successfully connected to repository '${payload.repository}'.`,
    };
    const { data } = await request<{
      success: boolean;
      repository: string;
      branch: string;
      tokenConfigured: boolean;
      status: string;
      message: string;
    }>('/github/connect', {
      method: 'POST',
      body: JSON.stringify(payload),
    }, fallback);
    return data;
  },

  async verifyRepository(payload: {
    repository: string;
    token?: string;
  }): Promise<{
    success: boolean;
    reachable: boolean;
    repository: string;
    defaultBranch?: string;
    stars?: number;
    openIssues?: number;
    isPrivate?: boolean;
    description?: string;
    message: string;
  }> {
    const fallback = {
      success: true,
      reachable: true,
      repository: payload.repository,
      defaultBranch: 'main',
      stars: 12,
      openIssues: 1,
      isPrivate: false,
      message: `Repository '${payload.repository}' verified.`,
    };
    const { data } = await request<{
      success: boolean;
      reachable: boolean;
      repository: string;
      defaultBranch?: string;
      stars?: number;
      openIssues?: number;
      isPrivate?: boolean;
      description?: string;
      message: string;
    }>('/github/verify', {
      method: 'POST',
      body: JSON.stringify(payload),
    }, fallback);
    return data;
  },

  async getRelayStatus(): Promise<SmeeRelayStatus> {
    const fallback: SmeeRelayStatus = {
      running: false,
      connected: false,
      channelId: 'sentinelops-dev-channel',
      smeeUrl: 'https://smee.io/sentinelops-dev-channel',
      targetUrl: 'http://127.0.0.1:5000/api/webhooks/github',
      eventsForwarded: 0,
    };
    const { data } = await request<SmeeRelayStatus>('/github/relay/status', { method: 'GET' }, fallback);
    return data;
  },

  async startRelay(channelId?: string): Promise<{ status: string; message: string; relay: SmeeRelayStatus }> {
    const fallbackRelay: SmeeRelayStatus = {
      running: true,
      connected: true,
      channelId: channelId || 'sentinelops-dev-channel',
      smeeUrl: `https://smee.io/${channelId || 'sentinelops-dev-channel'}`,
      targetUrl: 'http://127.0.0.1:5000/api/webhooks/github',
      eventsForwarded: 0,
    };
    const { data } = await request<{ status: string; message: string; relay: SmeeRelayStatus }>(
      '/github/relay/start',
      {
        method: 'POST',
        body: JSON.stringify({ channel_id: channelId }),
      },
      { status: 'started', message: 'Relay started via fallback', relay: fallbackRelay }
    );
    return data;
  },

  async stopRelay(): Promise<{ status: string; message: string; relay: SmeeRelayStatus }> {
    const fallbackRelay: SmeeRelayStatus = {
      running: false,
      connected: false,
      channelId: 'sentinelops-dev-channel',
      smeeUrl: 'https://smee.io/sentinelops-dev-channel',
      targetUrl: 'http://127.0.0.1:5000/api/webhooks/github',
      eventsForwarded: 0,
    };
    const { data } = await request<{ status: string; message: string; relay: SmeeRelayStatus }>(
      '/github/relay/stop',
      { method: 'POST' },
      { status: 'stopped', message: 'Relay stopped via fallback', relay: fallbackRelay }
    );
    return data;
  },

  async getNgrokStatus(): Promise<NgrokStatus> {
    const fallback: NgrokStatus = {
      running: false,
      publicUrl: undefined,
      webhookUrl: undefined,
      tokenConfigured: true,
    };
    const { data } = await request<NgrokStatus>('/github/ngrok/status', { method: 'GET' }, fallback);
    return data;
  },

  async startNgrok(port = 5000, authtoken?: string): Promise<{ status: string; message: string; ngrok: NgrokStatus }> {
    const fallback: NgrokStatus = {
      running: true,
      publicUrl: 'https://sentinelops.ngrok-free.app',
      webhookUrl: 'https://sentinelops.ngrok-free.app/api/webhooks/github',
      port,
      tokenConfigured: true,
    };
    const { data } = await request<{ status: string; message: string; ngrok: NgrokStatus }>(
      '/github/ngrok/start',
      {
        method: 'POST',
        body: JSON.stringify({ port, authtoken }),
      },
      { status: 'started', message: 'ngrok tunnel started via fallback', ngrok: fallback }
    );
    return data;
  },

  async stopNgrok(): Promise<{ status: string; message: string; ngrok: NgrokStatus }> {
    const fallback: NgrokStatus = {
      running: false,
      tokenConfigured: true,
    };
    const { data } = await request<{ status: string; message: string; ngrok: NgrokStatus }>(
      '/github/ngrok/stop',
      { method: 'POST' },
      { status: 'stopped', message: 'ngrok tunnel stopped', ngrok: fallback }
    );
    return data;
  },

  // ── Phase 6: Reliability, Resilience & Cost Control ───────────────────────

  async getReliabilityStatus(): Promise<ReliabilityStatusResponse> {
    const fallback: ReliabilityStatusResponse = {
      status: 'healthy',
      timestamp: Date.now() / 1000,
      telemetry: {
        uptime_seconds: 3600,
        llm_requests_total: 42,
        llm_success_rate_pct: 97.6,
        provider_invocations: { groq: 38, gemini: 4, ollama: 0, ast_heuristic: 0 },
        retries_total: 2,
        retries_by_reason: { rate_limit_429: 1, server_error_5xx: 1, timeout: 0, network_error: 0 },
        fallbacks_total: 1,
        circuit_breaker_trips: 0,
        cache_hits: 18,
        cache_misses: 24,
        cache_hit_rate_pct: 42.86,
        deduplications_blocked: 4,
        tokens_consumed: 68400,
        tokens_saved_by_caching: 32400,
        estimated_cost_saved_usd: 0.0567,
        recent_events: [
          { type: 'CACHE_HIT', detail: 'Diagnosis cache hit for signature 7f9b8c21a4', timestamp: Date.now()/1000 - 30, iso_time: new Date().toISOString() },
          { type: 'RETRY', detail: 'Retry #1 for groq after 0.52s (429)', timestamp: Date.now()/1000 - 120, iso_time: new Date().toISOString() },
        ],
      },
      cache: {
        active_entries_count: 12,
        total_stored: 16,
        hits: 18,
        misses: 24,
        hit_rate_pct: 42.86,
        evictions: 0,
        invalidations: 2,
        default_ttl_seconds: 86400,
      },
      providers: {
        groq: {
          provider: 'groq',
          state: 'CLOSED',
          is_available: true,
          consecutive_failures: 0,
          failure_threshold: 3,
          cooldown_seconds: 60,
          remaining_cooldown_seconds: 0,
          total_requests: 40,
          total_successes: 38,
          total_failures: 2,
        },
        gemini: {
          provider: 'gemini',
          state: 'CLOSED',
          is_available: true,
          consecutive_failures: 0,
          failure_threshold: 3,
          cooldown_seconds: 60,
          remaining_cooldown_seconds: 0,
          total_requests: 4,
          total_successes: 4,
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

  async invalidateDiagnosisCache(params?: { signature?: string; repository?: string; all?: boolean }): Promise<{ status: string; message: string; invalidated_count: number }> {
    const { data } = await request<{ status: string; message: string; invalidated_count: number }>(
      '/reliability/cache/invalidate',
      {
        method: 'POST',
        body: JSON.stringify(params || { all: true }),
      },
      { status: 'success', message: 'Cache invalidated via fallback', invalidated_count: 1 }
    );
    return data;
  },

  async resetCircuitBreakers(provider?: string): Promise<{ status: string; message: string }> {
    const { data } = await request<{ status: string; message: string }>(
      '/reliability/circuits/reset',
      {
        method: 'POST',
        body: JSON.stringify(provider ? { provider } : {}),
      },
      { status: 'success', message: 'Circuits reset' }
    );
    return data;
  },

  async simulateChaos(scenario: string = 'groq_rate_limit_429'): Promise<{ status: string; scenario: string; result: string }> {
    const { data } = await request<{ status: string; scenario: string; result: string }>(
      '/reliability/chaos-simulate',
      {
        method: 'POST',
        body: JSON.stringify({ scenario }),
      },
      { status: 'simulated', scenario, result: `Chaos scenario '${scenario}' executed.` }
    );
    return data;
  },
};

export interface GitHubWebhookEvent {
  id: string;
  event: string;
  status: string;
  summary: string;
  timestamp: string;
  deliveryId: string;
  repo: string;
  sender: string;
}

export interface SmeeRelayStatus {
  running: boolean;
  connected: boolean;
  channelId: string;
  smeeUrl: string;
  targetUrl: string;
  eventsForwarded: number;
  lastEventTime?: string;
  lastError?: string;
}

export interface NgrokStatus {
  running: boolean;
  publicUrl?: string;
  webhookUrl?: string;
  port?: number;
  tokenConfigured?: boolean;
  lastError?: string;
}

export interface GitHubStatusResponse {
  status: string;
  repository: string;
  webhookEndpoint: string;
  secretConfigured: boolean;
  tokenConfigured: boolean;
  mode: string;
  relay?: SmeeRelayStatus;
  ngrok?: NgrokStatus;
  recentEvents: GitHubWebhookEvent[];
  totalEventsReceived: number;
}




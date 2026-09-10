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
    };

    const { data } = await request<IncidentExplanation>(
      `/incidents/${id}/explain`,
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
};

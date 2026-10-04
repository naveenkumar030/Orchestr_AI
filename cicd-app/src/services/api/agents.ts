import { request, actionRequest } from './client';
import type { AIAgent, AgentStatus, AgentFleetStats, AgentReasoningFeedItem } from '../../types';
import { localAgents } from './mockState';

export const agentsApi = {
  /**
   * AI Agents List
   */
  async getAiAgents(): Promise<AIAgent[]> {
    const { data } = await request<AIAgent[]>('/ai-agents', { method: 'GET' }, localAgents);
    return data;
  },

  /**
   * Aggregated Real Fleet Stats
   */
  async getFleetStats(): Promise<AgentFleetStats> {
    const fallbackStats: AgentFleetStats = {
      totalAgents: localAgents.length,
      activeAgents: localAgents.filter((a) => a.status === 'active' || a.status === 'processing').length,
      standbyAgents: localAgents.filter((a) => a.status === 'standby' || a.status === 'idle').length,
      totalTasksCompleted: localAgents.reduce((acc, a) => acc + (a.tasksCompleted || 0), 0),
      autonomousResolutionRate: 94.8,
      totalIncidents: 17,
      resolvedIncidents: 14,
      avgCriticScore: 81.1,
      avgDiagnosisConfidence: 96.0,
      avgLatencyMs: 480,
      activeRepository: 'naveenkumar030/testingrepo',
      llmProviders: [
        {
          id: 'groq',
          name: 'Groq Cloud LPU',
          model: 'llama-3.3-70b-versatile / gpt-oss-120b',
          status: 'online',
          latencyMs: 142,
          role: 'Sub-Second Ultra Fast Inference & AST Diff Synthesis',
          primary: true,
        },
        {
          id: 'gemini',
          name: 'Google Gemini 1.5 / 2.0',
          model: 'gemini-1.5-flash (2M Context)',
          status: 'online',
          latencyMs: 380,
          role: 'Multimodal Log Cascade Analysis & Chain-of-Thought',
          primary: false,
        },
        {
          id: 'ast-engine',
          name: 'Deterministic AST Engine',
          model: 'Python AST Parser / Policy Gate',
          status: 'active',
          latencyMs: 14,
          role: 'Zero-Escape Syntax Validation & Semantic Guardrails',
          primary: false,
        },
      ],
      pendingQueue: [],
    };

    const { data } = await request<AgentFleetStats>('/ai-agents/fleet-stats', { method: 'GET' }, fallbackStats);
    return data;
  },

  /**
   * Live Multi-Agent Reasoning Feed
   */
  async getReasoningFeed(limit: number = 20): Promise<AgentReasoningFeedItem[]> {
    const { data } = await request<AgentReasoningFeedItem[]>(
      `/ai-agents/reasoning-feed?limit=${limit}`,
      { method: 'GET' },
      []
    );
    return data;
  },

  /**
   * Trigger Fleet Scan on GitHub Actions
   */
  async scanFleet(): Promise<{ status: string; message: string; active_agents?: string[] }> {
    const { data } = await actionRequest<{ status: string; message: string; active_agents?: string[] }>(
      '/ai-agents/scan',
      { method: 'POST' },
      () => ({
        status: 'success',
        message: 'Fleet scan completed across GitHub Actions telemetry.',
        active_agents: ['Diagnoser Agent', 'Fix Suggester Agent', 'Critic / Verifier Agent'],
      })
    );
    return data;
  },

  /**
   * Interactive Sandbox Test for Agent Pod
   */
  async testAgentPod(agentId: string, logs?: string): Promise<any> {
    const { data } = await actionRequest<any>(
      '/ai-agents/test-pod',
      {
        method: 'POST',
        body: JSON.stringify({ agent_id: agentId, logs }),
      },
      () => ({
        agent_id: agentId,
        status: 'success',
        result: {
          category: 'syntax_or_lint_error',
          root_cause: 'Simulated diagnostic trace on provided logs',
          confidence: 0.94,
        },
        message: `Diagnostic trace completed for ${agentId}`,
      })
    );
    return data;
  },

  async updateAgentStatus(id: string, status: AgentStatus): Promise<AIAgent> {
    const mockHandler = () => {
      const idx = localAgents.findIndex((a) => a.id === id);
      if (idx >= 0) {
        localAgents[idx] = { ...localAgents[idx], status };
      }
      return localAgents.find((a) => a.id === id) || localAgents[0];
    };

    const { data } = await actionRequest<AIAgent>(
      `/ai-agents/${id}/status`,
      {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      },
      mockHandler
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
    const mockHandler = () => {
      const newId = `agent-${String(localAgents.length + 1).padStart(3, '0')}`;
      const fallback: AIAgent = {
        id: newId,
        name: data.name,
        role: data.role,
        status: data.status || 'active',
        capability: data.capability || 'Autonomous task processing & AST validation',
        tasksCompleted: 0,
        currentTask: '[Demo Mode] Initialized simulated pod, listening on queue',
        successRate: 100.0,
        lastSeen: 'just now',
        tags: data.tags || ['autonomous', 'k8s', 'dynamic-pod'],
        hostRunner: data.hostRunner || 'k8s-agent-worker-03',
        modelBackend: data.modelBackend || 'Claude 3.7 Sonnet / Gemini 1.5 Pro',
      };
      localAgents.push(fallback);
      return fallback;
    };

    const { data: res } = await actionRequest<AIAgent>(
      '/ai-agents',
      {
        method: 'POST',
        body: JSON.stringify(data),
      },
      mockHandler
    );
    return res;
  },
};


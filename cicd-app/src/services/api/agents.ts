import { request, actionRequest } from './client';
import type { AIAgent, AgentStatus } from '../../types';
import { localAgents } from './mockState';

export const agentsApi = {
  /**
   * AI Agents
   */
  async getAiAgents(): Promise<AIAgent[]> {
    const { data } = await request<AIAgent[]>('/ai-agents', { method: 'GET' }, localAgents);
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

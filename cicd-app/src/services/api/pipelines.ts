import { request, actionRequest } from './client';
import type { Pipeline } from '../../types';
import { localPipelines } from './mockState';

export const pipelinesApi = {
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

    const mockHandler = () => {
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
        triggeredBy: 'Operator via UI (Demo Mode)',
        time: 'just now',
        aiFixed: false,
      };
      localPipelines.unshift(fallback);
      return fallback;
    };

    const { data } = await actionRequest<Pipeline>(
      '/pipelines/trigger',
      {
        method: 'POST',
        body: JSON.stringify({ repo, branch, name }),
      },
      mockHandler
    );
    return data;
  },

  async retryPipeline(id: string): Promise<Pipeline> {
    const mockHandler = () => {
      const idx = localPipelines.findIndex((p) => p.id.toLowerCase() === id.toLowerCase());
      if (idx >= 0) {
        localPipelines[idx] = {
          ...localPipelines[idx],
          status: 'running',
          time: 'retrying now',
        };
        return localPipelines[idx];
      }
      return localPipelines[0];
    };

    const { data } = await actionRequest<Pipeline>(
      `/pipelines/${id}/retry`,
      { method: 'POST' },
      mockHandler
    );
    return data;
  },
};

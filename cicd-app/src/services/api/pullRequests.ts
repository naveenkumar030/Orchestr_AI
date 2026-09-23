import { request, actionRequest } from './client';
import type { PullRequest } from '../../types';
import { localPRs } from './mockState';

export const pullRequestsApi = {
  /**
   * Pull Requests
   */
  async getPullRequests(): Promise<PullRequest[]> {
    const { data } = await request<PullRequest[]>('/pull-requests', { method: 'GET' }, localPRs);
    return data;
  },

  async reviewPullRequest(id: string): Promise<PullRequest> {
    const mockHandler = () => {
      const idx = localPRs.findIndex((p) => p.id === id);
      if (idx >= 0) {
        localPRs[idx] = {
          ...localPRs[idx],
          status: 'approved',
          aiReviewScore: Math.min(99, (localPRs[idx].aiReviewScore || 85) + 3),
          aiComment:
            '[Demo Mode] AI Review verified: Zero security regressions detected. Passed automated schema checks.',
        };
      }
      return localPRs.find((p) => p.id === id) || localPRs[0];
    };

    const { data } = await actionRequest<PullRequest>(
      `/pull-requests/${id}/review`,
      { method: 'POST' },
      mockHandler
    );
    return data;
  },

  async mergePullRequest(id: string): Promise<PullRequest> {
    const mockHandler = () => {
      const idx = localPRs.findIndex((p) => p.id === id);
      if (idx >= 0) {
        localPRs[idx] = {
          ...localPRs[idx],
          status: 'merged',
        };
      }
      return localPRs.find((p) => p.id === id) || localPRs[0];
    };

    const { data } = await actionRequest<PullRequest>(
      `/pull-requests/${id}/merge`,
      { method: 'POST' },
      mockHandler
    );
    return data;
  },
};

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

  async createPullRequest(params: {
    title: string;
    branch: string;
    repo?: string;
    author?: string;
  }): Promise<PullRequest> {
    const mockHandler = () => {
      const pr: PullRequest = {
        id: `pr-local-${Date.now()}`,
        number: Math.floor(Math.random() * 9000) + 1000,
        title: params.title,
        repo: (params.repo || 'testingrepo').split('/').pop() || 'testingrepo',
        branch: params.branch,
        author: params.author || 'sentinelops-user',
        status: 'open',
        aiReviewScore: 0,
        comments: 0,
        additions: 0,
        deletions: 0,
        time: 'just now',
        aiComment: 'Pending AI review by SentinelOps Engine.',
        guard_status: 'PENDING',
        risk_level: 'LOW',
      };
      localPRs.unshift(pr);
      return pr;
    };

    const { data } = await actionRequest<PullRequest>(
      '/pull-requests',
      {
        method: 'POST',
        body: JSON.stringify(params),
      },
      mockHandler
    );
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

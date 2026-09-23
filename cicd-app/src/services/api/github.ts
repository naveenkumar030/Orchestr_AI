import { request, actionRequest } from './client';
import type {
  GitHubStatusResponse,
  SmeeRelayStatus,
  NgrokStatus,
} from './types';

export const githubApi = {
  /**
   * GitHub Integration & Webhooks
   */
  async getGitHubStatus(): Promise<GitHubStatusResponse> {
    const fallback: GitHubStatusResponse = {
      status: 'offline',
      repository: 'naveenkumar030/SentinelOps',
      webhookEndpoint: '/api/webhooks/github',
      secretConfigured: false,
      tokenConfigured: false,
      mode: 'offline-cached',
      recentEvents: [],
      totalEventsReceived: 0,
    };
    const { data } = await request<GitHubStatusResponse>('/github/status', { method: 'GET' }, fallback);
    return data;
  },

  async sendTestWebhook(
    event: string,
    payload?: unknown
  ): Promise<{ status: string; event: string; result?: unknown }> {
    const { data } = await actionRequest<{ status: string; event: string; result?: unknown }>(
      '/github/test-webhook',
      {
        method: 'POST',
        body: JSON.stringify({ event, payload }),
      },
      () => ({ status: 'processed', event, result: { simulated: true } })
    );
    return data;
  },

  async dispatchGitHubWorkflow(
    branch = 'main',
    workflow = 'deploy.yml'
  ): Promise<{ success: boolean; live: boolean; repo?: string; branch?: string; error?: string; message?: string }> {
    const { data } = await actionRequest<{
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
      () => ({
        success: true,
        live: false,
        repo: 'naveenkumar030/SentinelOps',
        branch,
        message: '[Demo Mode] Dispatched simulated workflow run',
      })
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
    const { data } = await actionRequest<{
      success: boolean;
      repository: string;
      branch: string;
      tokenConfigured: boolean;
      status: string;
      message: string;
    }>(
      '/github/connect',
      {
        method: 'POST',
        body: JSON.stringify(payload),
      },
      () => ({
        success: true,
        repository: payload.repository,
        branch: payload.branch || 'main',
        tokenConfigured: Boolean(payload.token),
        status: 'connected',
        message: `[Demo Mode] Connected to simulated repository '${payload.repository}'.`,
      })
    );
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
    const { data } = await actionRequest<{
      success: boolean;
      reachable: boolean;
      repository: string;
      defaultBranch?: string;
      stars?: number;
      openIssues?: number;
      isPrivate?: boolean;
      description?: string;
      message: string;
    }>(
      '/github/verify',
      {
        method: 'POST',
        body: JSON.stringify(payload),
      },
      () => ({
        success: true,
        reachable: true,
        repository: payload.repository,
        defaultBranch: 'main',
        stars: 12,
        openIssues: 1,
        isPrivate: false,
        message: `[Demo Mode] Verified repository '${payload.repository}' (simulated).`,
      })
    );
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
    const { data } = await actionRequest<{ status: string; message: string; relay: SmeeRelayStatus }>(
      '/github/relay/start',
      {
        method: 'POST',
        body: JSON.stringify({ channel_id: channelId }),
      },
      () => ({ status: 'started', message: '[Demo Mode] Smee relay started (simulated)', relay: fallbackRelay })
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
    const { data } = await actionRequest<{ status: string; message: string; relay: SmeeRelayStatus }>(
      '/github/relay/stop',
      { method: 'POST' },
      () => ({ status: 'stopped', message: '[Demo Mode] Smee relay stopped (simulated)', relay: fallbackRelay })
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
    const { data } = await actionRequest<{ status: string; message: string; ngrok: NgrokStatus }>(
      '/github/ngrok/start',
      {
        method: 'POST',
        body: JSON.stringify({ port, authtoken }),
      },
      () => ({ status: 'started', message: '[Demo Mode] ngrok tunnel started (simulated)', ngrok: fallback })
    );
    return data;
  },

  async stopNgrok(): Promise<{ status: string; message: string; ngrok: NgrokStatus }> {
    const fallback: NgrokStatus = {
      running: false,
      tokenConfigured: true,
    };
    const { data } = await actionRequest<{ status: string; message: string; ngrok: NgrokStatus }>(
      '/github/ngrok/stop',
      { method: 'POST' },
      () => ({ status: 'stopped', message: '[Demo Mode] ngrok tunnel stopped (simulated)', ngrok: fallback })
    );
    return data;
  },
};

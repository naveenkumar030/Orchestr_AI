import { request, actionRequest } from './client';
import type {
  IncidentActionsResponse,
  SafeActionRecord,
  CreateDraftPrRequest,
  SendNotificationRequest,
  SlackNotificationRecord,
} from '../../types';

export const actionsApi = {
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
    const mockHandler = () => ({
      success: true,
      status: 'success',
      pr_number: 145,
      pr_url: 'https://github.com/naveenkumar030/SentinelOps/pull/145',
      branch_name: `sentinelops/fix/${incidentId.toLowerCase().replace(/[^a-z0-9]/g, '-')}-b8f1a2`,
      message: '[Demo Mode] Draft PR created successfully on dedicated branch (simulated).',
      action_record: {
        action_id: `act-${Date.now()}`,
        incident_id: incidentId,
        action_type: 'CREATE_DRAFT_PR' as const,
        status: 'success' as const,
        pr_number: 145,
        pr_url: 'https://github.com/naveenkumar030/SentinelOps/pull/145',
        branch_name: `sentinelops/fix/${incidentId.toLowerCase().replace(/[^a-z0-9]/g, '-')}-b8f1a2`,
        target_branch: options?.target_branch || 'main',
        created_at: new Date().toISOString(),
      },
    });

    const { data } = await actionRequest<{
      success: boolean;
      status: string;
      action_record?: SafeActionRecord;
      pr_number?: number;
      pr_url?: string;
      branch_name?: string;
      message?: string;
      blocking_reasons?: string[];
      error?: string;
    }>(
      `/incidents/${incidentId}/create-draft-pr`,
      {
        method: 'POST',
        body: JSON.stringify(options || {}),
      },
      mockHandler
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
    const mockHandler = () => ({
      success: true,
      message: '[Demo Mode] Notification sent successfully (simulated)',
      notification: {
        incident_id: incidentId,
        event_type: options?.event_type || 'AUTO_APPROVED',
        status: 'SENT' as const,
        channel: '#ci-cd-alerts',
        timestamp: new Date().toISOString(),
        details: 'Simulated Slack notification dispatched',
      },
    });

    const { data } = await actionRequest<{
      success: boolean;
      notification?: SlackNotificationRecord;
      message?: string;
      error?: string;
    }>(
      `/incidents/${incidentId}/notify`,
      {
        method: 'POST',
        body: JSON.stringify(options || {}),
      },
      mockHandler
    );
    return data;
  },
};

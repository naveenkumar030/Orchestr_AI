import { request } from './client';
import type { AnalyticsResponse } from '../../types';

export const analyticsApi = {
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

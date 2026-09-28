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

  /**
   * Recalculate and persist fresh snapshot to MongoDB
   */
  async refreshAnalytics(timeRange = '30d'): Promise<AnalyticsResponse> {
    const { data } = await request<{ success: boolean; data: AnalyticsResponse }>(
      `/analytics/refresh?range=${timeRange}`,
      { method: 'POST' },
      { success: false, data: {} as AnalyticsResponse }
    );
    return data.data || (data as unknown as AnalyticsResponse);
  },

  /**
   * Seed operational telemetry to MongoDB Atlas
   */
  async seedAnalytics(timeRange = '30d'): Promise<AnalyticsResponse> {
    const { data } = await request<{ success: boolean; data: AnalyticsResponse }>(
      `/analytics/seed?range=${timeRange}`,
      { method: 'POST' },
      { success: false, data: {} as AnalyticsResponse }
    );
    return data.data || (data as unknown as AnalyticsResponse);
  },
};


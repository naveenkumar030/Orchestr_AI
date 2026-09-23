import { request, actionRequest } from './client';
import type { SettingsData } from './types';
import { localSettings } from './mockState';

export const settingsApi = {
  /**
   * Settings & Policy
   */
  async getSettings(): Promise<SettingsData> {
    const { data } = await request<SettingsData>('/settings', { method: 'GET' }, localSettings);
    return data;
  },

  async saveSettings(newSettings: Partial<SettingsData>): Promise<SettingsData> {
    const mockHandler = () => {
      Object.assign(localSettings, newSettings);
      return { ...localSettings };
    };

    const { data } = await actionRequest<SettingsData>(
      '/settings',
      {
        method: 'POST',
        body: JSON.stringify(newSettings),
      },
      mockHandler
    );
    // Keep localSettings in sync if save succeeded
    Object.assign(localSettings, data);
    return data;
  },
};

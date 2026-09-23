import { request, actionRequest } from './client';
import type { LogEntry } from '../../types';
import { localLogs, setLocalLogs } from './mockState';

export const logsApi = {
  /**
   * Logs & Observability
   */
  async getLogs(params?: { service?: string; level?: string; query?: string }): Promise<LogEntry[]> {
    const urlParams = new URLSearchParams();
    if (params?.service && params.service !== 'all') urlParams.append('service', params.service);
    if (params?.level && params.level !== 'ALL') urlParams.append('level', params.level);
    if (params?.query) urlParams.append('query', params.query);
    const queryString = urlParams.toString() ? `?${urlParams.toString()}` : '';

    const fallback = localLogs.filter((l) => {
      if (params?.service && params.service !== 'all' && l.service.toLowerCase() !== params.service.toLowerCase()) {
        return false;
      }
      if (params?.level && params.level !== 'ALL' && l.level.toUpperCase() !== params.level.toUpperCase()) {
        return false;
      }
      if (params?.query) {
        const q = params.query.toLowerCase();
        return l.message.toLowerCase().includes(q) || l.service.toLowerCase().includes(q);
      }
      return true;
    });

    const { data } = await request<LogEntry[]>(`/logs${queryString}`, { method: 'GET' }, fallback);
    return data;
  },

  async createLog(entry: { service: string; level: string; message: string; traceId?: string }): Promise<LogEntry> {
    const mockHandler = () => {
      const newLog: LogEntry = {
        id: `l-${String(localLogs.length + 1).padStart(2, '0')}`,
        timestamp: new Date().toISOString().substring(11, 23),
        level: entry.level as LogEntry['level'],
        service: entry.service,
        message: entry.message,
        traceId: entry.traceId || `trace-${Math.floor(Math.random() * 8999 + 1000)}`,
      };
      setLocalLogs((prev) => [newLog, ...prev]);
      return newLog;
    };

    const { data } = await actionRequest<LogEntry>(
      '/logs',
      {
        method: 'POST',
        body: JSON.stringify(entry),
      },
      mockHandler
    );
    return data;
  },
};

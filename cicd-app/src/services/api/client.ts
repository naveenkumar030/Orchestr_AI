import type {
  Incident,
  Pipeline,
  AIAgent,
  PullRequest,
  LogEntry,
} from '../../types';
import {
  incidents as mockIncidents,
  pipelines as mockPipelines,
  aiAgents as mockAiAgents,
  pullRequests as mockPullRequests,
  logEntries as mockLogs,
} from '../../data/mockData';
import type { HealthResponse, SettingsData } from './types';

export const BASE_URL = import.meta.env.VITE_API_URL || '/api';

export class ApiError extends Error {
  status?: number;
  endpoint: string;
  details?: unknown;

  constructor(message: string, endpoint: string, status?: number, details?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.endpoint = endpoint;
    this.status = status;
    this.details = details;
  }
}

const MOCK_MODE_KEY = 'sentinelops_mock_mode';

let mockModeActive: boolean = (() => {
  if (typeof window === 'undefined') return false;
  const stored = localStorage.getItem(MOCK_MODE_KEY);
  if (stored !== null) return stored === 'true';
  return import.meta.env.VITE_MOCK_MODE === 'true';
})();

export type ApiEventType = 'fallback' | 'disconnect' | 'connect';
export interface ApiEvent {
  type: ApiEventType;
  endpoint?: string;
  details?: unknown;
}

type ApiEventListener = (event: ApiEvent) => void;
const apiListeners: Set<ApiEventListener> = new Set();

export function subscribeApiEvents(listener: ApiEventListener): () => void {
  apiListeners.add(listener);
  return () => {
    apiListeners.delete(listener);
  };
}

function notifyApiEvent(event: ApiEvent) {
  apiListeners.forEach((l) => {
    try {
      l(event);
    } catch (err) {
      console.error('API listener error:', err);
    }
  });
}

export function isMockMode(): boolean {
  return mockModeActive;
}

export function setMockMode(enabled: boolean): void {
  mockModeActive = enabled;
  if (typeof window !== 'undefined') {
    localStorage.setItem(MOCK_MODE_KEY, String(enabled));
  }
  notifyApiEvent({ type: enabled ? 'fallback' : 'connect', endpoint: 'mock-mode-toggle' });
}

// In-memory fallback copies for offline mutations or demo mode
export const localIncidents: Incident[] = [...mockIncidents];
export const localPipelines: Pipeline[] = [...mockPipelines];
export const localAgents: AIAgent[] = [...mockAiAgents];
export const localPRs: PullRequest[] = [...mockPullRequests];
export const localLogs: LogEntry[] = [...mockLogs];
export const localSettings: SettingsData = {
  confidenceThreshold: 95,
  autoMergeActive: true,
  ciSuccessRequired: true,
  zeroCveRequired: true,
  humanApprovalRequired: false,
  killSwitchEngaged: false,
};

/**
 * Standard query request for data fetching.
 * In live mode: attempts backend request; falls back to cached/mock value if provided when backend fails.
 * In mock mode: immediately returns fallbackValue.
 */
export async function request<T>(
  endpoint: string,
  options?: RequestInit,
  fallbackValue?: T
): Promise<{ data: T; isFallback: boolean }> {
  if (mockModeActive && fallbackValue !== undefined) {
    notifyApiEvent({ type: 'fallback', endpoint });
    return { data: fallbackValue, isFallback: true };
  }

  try {
    const res = await fetch(`${BASE_URL}${endpoint}`, {
      headers: {
        'Content-Type': 'application/json',
        ...(options?.headers || {}),
      },
      ...options,
    });

    if (!res.ok) {
      let errDetails: unknown;
      try {
        errDetails = await res.json();
      } catch {
        // ignore
      }
      throw new ApiError(
        `HTTP error ${res.status}: ${res.statusText}`,
        endpoint,
        res.status,
        errDetails
      );
    }

    const data = (await res.json()) as T;
    return { data, isFallback: false };
  } catch (err) {
    console.warn(`[API] Failure for ${endpoint}:`, err);
    notifyApiEvent({ type: 'disconnect', endpoint, details: err });
    if (fallbackValue !== undefined) {
      notifyApiEvent({ type: 'fallback', endpoint });
      return { data: fallbackValue, isFallback: true };
    }
    if (err instanceof ApiError) {
      throw err;
    }
    throw new ApiError(
      err instanceof Error ? err.message : 'Network request failed',
      endpoint,
      undefined,
      err
    );
  }
}

/**
 * Action request for mutations and external operations (dispatches, verifications, connections, relays).
 * IN LIVE MODE: Fails fast on network or HTTP error. NEVER presents a fallback as confirmed action.
 * IN MOCK MODE: Executes mockHandler only if explicitly enabled, returning tagged fallback metadata.
 */
export async function actionRequest<T>(
  endpoint: string,
  options: RequestInit,
  mockHandler?: () => T | Promise<T>
): Promise<{ data: T; isFallback: boolean }> {
  if (mockModeActive) {
    if (mockHandler) {
      const mockData = await mockHandler();
      notifyApiEvent({ type: 'fallback', endpoint });
      return { data: mockData, isFallback: true };
    }
    throw new ApiError(
      `[Demo Mode] Action ${endpoint} is simulated, but no mock handler was defined.`,
      endpoint
    );
  }

  try {
    const res = await fetch(`${BASE_URL}${endpoint}`, {
      headers: {
        'Content-Type': 'application/json',
        ...(options.headers || {}),
      },
      ...options,
    });

    if (!res.ok) {
      let errDetails: unknown;
      try {
        errDetails = await res.json();
      } catch {
        // ignore
      }

      const message =
        (errDetails && typeof errDetails === 'object' && 'error' in errDetails && typeof (errDetails as { error: unknown }).error === 'string')
          ? (errDetails as { error: string }).error
          : (errDetails && typeof errDetails === 'object' && 'message' in errDetails && typeof (errDetails as { message: unknown }).message === 'string')
          ? (errDetails as { message: string }).message
          : `HTTP error ${res.status}: ${res.statusText}`;

      throw new ApiError(message, endpoint, res.status, errDetails);
    }

    const data = (await res.json()) as T;
    return { data, isFallback: false };
  } catch (err) {
    console.warn(`[API Action Failed] ${endpoint}:`, err);
    notifyApiEvent({ type: 'disconnect', endpoint, details: err });
    if (err instanceof ApiError) {
      throw err;
    }
    throw new ApiError(
      err instanceof Error ? err.message : 'Network request failed: backend unreachable',
      endpoint,
      undefined,
      err
    );
  }
}

export async function checkHealth(): Promise<{ isConnected: boolean; latency: number; health?: HealthResponse }> {
  const start = performance.now();
  try {
    const res = await fetch(`${BASE_URL}/health`, { method: 'GET', cache: 'no-store' });
    const latency = Math.round(performance.now() - start);
    if (res.ok) {
      const health = (await res.json()) as HealthResponse;
      notifyApiEvent({ type: 'connect', endpoint: '/health' });
      return { isConnected: true, latency, health };
    }
    notifyApiEvent({ type: 'disconnect', endpoint: '/health' });
    return { isConnected: false, latency };
  } catch {
    notifyApiEvent({ type: 'disconnect', endpoint: '/health' });
    return { isConnected: false, latency: Math.round(performance.now() - start) };
  }
}

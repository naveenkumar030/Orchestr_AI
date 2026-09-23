import { createContext, useContext } from 'react';
import type { HealthResponse } from '../services/api';

export interface BackendContextValue {
  isConnected: boolean;
  latency: number | null;
  backendVersion: string | null;
  uptimeSeconds: number | null;
  health: HealthResponse | null;
  database: string | null;
  mongoConnected: boolean;
  mongoLatency: number | null;
  mongoDb: string | null;
  lastChecked: Date | null;
  recheck: () => Promise<void>;
  isMockMode: boolean;
  setMockMode: (enabled: boolean) => void;
  hasFallbackData: boolean;
  clearFallbackData: () => void;
}

export const BackendContext = createContext<BackendContextValue>({
  isConnected: false,
  latency: null,
  backendVersion: null,
  uptimeSeconds: null,
  health: null,
  database: null,
  mongoConnected: false,
  mongoLatency: null,
  mongoDb: null,
  lastChecked: null,
  recheck: async () => {},
  isMockMode: false,
  setMockMode: () => {},
  hasFallbackData: false,
  clearFallbackData: () => {},
});

export function useBackend() {
  return useContext(BackendContext);
}

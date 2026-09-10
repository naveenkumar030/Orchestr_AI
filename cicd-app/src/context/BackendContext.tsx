import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { api, type HealthResponse } from '../services/api';

interface BackendContextValue {
  isConnected: boolean;
  latency: number | null;
  backendVersion: string | null;
  uptimeSeconds: number | null;
  health: HealthResponse | null;
  lastChecked: Date | null;
  recheck: () => Promise<void>;
}

const BackendContext = createContext<BackendContextValue>({
  isConnected: false,
  latency: null,
  backendVersion: null,
  uptimeSeconds: null,
  health: null,
  lastChecked: null,
  recheck: async () => {},
});

export const BackendProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [latency, setLatency] = useState<number | null>(null);
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [lastChecked, setLastChecked] = useState<Date | null>(null);

  const recheck = useCallback(async () => {
    const res = await api.checkHealth();
    setIsConnected(res.isConnected);
    setLatency(res.latency);
    if (res.health) {
      setHealth(res.health);
    }
    setLastChecked(new Date());
  }, []);

  useEffect(() => {
    // Initial health check
    recheck();

    // Periodic poll every 10s
    const timer = setInterval(() => {
      recheck();
    }, 10000);

    return () => clearInterval(timer);
  }, [recheck]);

  return (
    <BackendContext.Provider
      value={{
        isConnected,
        latency,
        backendVersion: health?.version ?? null,
        uptimeSeconds: health?.uptimeSeconds ?? null,
        health,
        lastChecked,
        recheck,
      }}
    >
      {children}
    </BackendContext.Provider>
  );
};

export function useBackend() {
  return useContext(BackendContext);
}

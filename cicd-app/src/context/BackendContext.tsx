import React, { useState, useEffect, useCallback } from 'react';
import {
  api,
  isMockMode as getIsMockMode,
  setMockMode as setApiMockMode,
  subscribeApiEvents,
  type HealthResponse,
  type ApiEvent,
} from '../services/api';
import { BackendContext } from './useBackend';

export const BackendProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [latency, setLatency] = useState<number | null>(null);
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [lastChecked, setLastChecked] = useState<Date | null>(null);
  const [isMockMode, setIsMockModeState] = useState<boolean>(() => getIsMockMode());
  const [hasFallbackData, setHasFallbackData] = useState<boolean>(false);

  const setMockMode = useCallback((enabled: boolean) => {
    setApiMockMode(enabled);
    setIsMockModeState(enabled);
    if (enabled) {
      setHasFallbackData(true);
    }
  }, []);

  const clearFallbackData = useCallback(() => {
    setHasFallbackData(false);
  }, []);

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
    // Listen to API client events
    const unsubscribe = subscribeApiEvents((event: ApiEvent) => {
      if (event.type === 'fallback') {
        setHasFallbackData(true);
      } else if (event.type === 'disconnect') {
        setIsConnected(false);
      } else if (event.type === 'connect') {
        setIsConnected(true);
      }
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    let active = true;
    api.checkHealth().then((res) => {
      if (!active) return;
      setIsConnected(res.isConnected);
      setLatency(res.latency);
      if (res.health) {
        setHealth(res.health);
      }
      setLastChecked(new Date());
    }).catch(() => {
      if (!active) return;
      setIsConnected(false);
      setLatency(null);
    });

    const timer = setInterval(() => {
      api.checkHealth().then((res) => {
        if (!active) return;
        setIsConnected(res.isConnected);
        setLatency(res.latency);
        if (res.health) {
          setHealth(res.health);
        }
        setLastChecked(new Date());
      }).catch(() => {
        if (!active) return;
        setIsConnected(false);
      });
    }, 10000);

    return () => {
      active = false;
      clearInterval(timer);
    };
  }, []);

  return (
    <BackendContext.Provider
      value={{
        isConnected,
        latency,
        backendVersion: health?.version ?? null,
        uptimeSeconds: health?.uptimeSeconds ?? null,
        health,
        database: health?.database ?? null,
        mongoConnected: Boolean(health?.mongo_connected),
        mongoLatency: health?.mongo_latency_ms ?? null,
        mongoDb: health?.mongo_db ?? null,
        lastChecked,
        recheck,
        isMockMode,
        setMockMode,
        hasFallbackData,
        clearFallbackData,
      }}
    >
      {children}
    </BackendContext.Provider>
  );
};

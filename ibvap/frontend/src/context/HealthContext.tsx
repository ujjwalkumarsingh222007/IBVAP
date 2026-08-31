import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { healthApi } from '../api/healthApi';
import { SystemHealth } from '../types';

interface HealthContextValue {
  health: SystemHealth | null;
  isBackendOnline: boolean;
  isAiOnline: boolean;
  isDbConnected: boolean;
  loading: boolean;
  lastChecked: Date | null;
  refreshHealth: () => Promise<void>;
}

const HealthContext = createContext<HealthContextValue | undefined>(undefined);

export const HealthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [health, setHealth] = useState<SystemHealth | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastChecked, setLastChecked] = useState<Date | null>(null);

  const fetchHealth = useCallback(async () => {
    try {
      const data = await healthApi.getHealth();
      setHealth(data);
      setLastChecked(new Date());
    } catch {
      setHealth({
        status: 'unhealthy',
        service: 'IBVAP Backend',
        database: 'disconnected',
        version: '1.0.0',
        ai_pipeline_status: 'STANDBY',
      });
      setLastChecked(new Date());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchHealth();
    // Controlled 10-second polling for system health
    const interval = setInterval(fetchHealth, 10000);
    return () => clearInterval(interval);
  }, [fetchHealth]);

  const isBackendOnline = health?.status === 'healthy' || health?.database === 'connected';
  const isAiOnline = health?.ai_pipeline_status === 'ONLINE';
  const isDbConnected = health?.database === 'connected';

  return (
    <HealthContext.Provider
      value={{
        health,
        isBackendOnline,
        isAiOnline,
        isDbConnected,
        loading,
        lastChecked,
        refreshHealth: fetchHealth,
      }}
    >
      {children}
    </HealthContext.Provider>
  );
};

export const useHealth = (): HealthContextValue => {
  const context = useContext(HealthContext);
  if (!context) {
    throw new Error('useHealth must be used within a HealthProvider');
  }
  return context;
};

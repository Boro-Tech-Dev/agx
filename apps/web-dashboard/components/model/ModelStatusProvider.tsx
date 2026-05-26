'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import { getModelOverview, getModelStatus } from '../../lib/api';
import { deriveModelNavTone, type ModelNavTone } from '../../lib/modelNavStatus';
import { parseModelOverviewPayload, type ModelOverviewPayload } from '../../lib/modelOverviewTypes';
import { modelStatusPollIntervalMs } from '../../lib/modelStatusPolling';
import { parseModelStatusPayload, type ModelStatusPayload } from '../../lib/modelStatusTypes';

export type ModelStatusContextValue = {
  data: ModelStatusPayload | null;
  raw: unknown | null;
  error: string | null;
  loading: boolean;
  lastUpdated: number | null;
  tone: ModelNavTone;
  overviewForNav: ModelOverviewPayload | null;
  refresh: () => Promise<void>;
};

const ModelStatusContext = createContext<ModelStatusContextValue | null>(null);

export function ModelStatusProvider({
  children,
  enabled = true,
}: {
  children: ReactNode;
  enabled?: boolean;
}) {
  const [data, setData] = useState<ModelStatusPayload | null>(null);
  const [raw, setRaw] = useState<unknown | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(enabled);
  const [lastUpdated, setLastUpdated] = useState<number | null>(null);
  const [tone, setTone] = useState<ModelNavTone>('yellow');
  const [overviewForNav, setOverviewForNav] = useState<ModelOverviewPayload | null>(null);

  const refresh = useCallback(async () => {
    if (!enabled) return;
    try {
      const res = await getModelStatus();
      const parsed = parseModelStatusPayload(res);
      setRaw(res);
      setData(parsed);
      setTone(deriveModelNavTone(res, overviewForNav));
      setError(null);
      setLastUpdated(Date.now());
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg);
      setData(null);
      setRaw(null);
      setTone('red');
    } finally {
      setLoading(false);
    }
  }, [enabled, overviewForNav]);

  const refreshOverviewForNav = useCallback(async () => {
    if (!enabled) return;
    try {
      const res = await getModelOverview();
      setOverviewForNav(parseModelOverviewPayload(res));
    } catch {
      /* nav tone falls back to status-only */
    }
  }, [enabled]);

  useEffect(() => {
    if (raw != null) {
      setTone(deriveModelNavTone(raw, overviewForNav));
    }
  }, [raw, overviewForNav]);

  useEffect(() => {
    if (!enabled) return;
    void refreshOverviewForNav();
    const id = window.setInterval(() => void refreshOverviewForNav(), 30_000);
    return () => window.clearInterval(id);
  }, [enabled, refreshOverviewForNav]);

  useEffect(() => {
    if (!enabled) {
      setLoading(false);
      return;
    }
    void refresh();
  }, [enabled, refresh]);

  useEffect(() => {
    if (!enabled) return;

    const tick = () => {
      if (typeof document !== 'undefined' && document.hidden) return;
      void refresh();
    };

    const intervalMs = modelStatusPollIntervalMs(data);
    const id = window.setInterval(tick, intervalMs);

    const onVis = () => {
      if (typeof document !== 'undefined' && !document.hidden) void refresh();
    };
    const onFocus = () => void refresh();

    document.addEventListener('visibilitychange', onVis);
    window.addEventListener('focus', onFocus);

    return () => {
      window.clearInterval(id);
      document.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('focus', onFocus);
    };
  }, [enabled, refresh, data?.ok, data?.models_ready, data?.models_runnable]);

  const value = useMemo<ModelStatusContextValue>(
    () => ({
      data,
      raw,
      error,
      loading,
      lastUpdated,
      tone,
      overviewForNav,
      refresh,
    }),
    [data, raw, error, loading, lastUpdated, tone, overviewForNav, refresh],
  );

  return <ModelStatusContext.Provider value={value}>{children}</ModelStatusContext.Provider>;
}

export function useModelStatusContext(): ModelStatusContextValue {
  const ctx = useContext(ModelStatusContext);
  if (ctx == null) {
    throw new Error('useModelStatusContext must be used within ModelStatusProvider');
  }
  return ctx;
}

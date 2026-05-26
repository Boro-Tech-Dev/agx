'use client';

import { useCallback, useEffect, useState } from 'react';

import { getModelOverview } from '../lib/api';
import {
  isOverviewFullyHealthy,
  parseModelOverviewPayload,
  type ModelOverviewPayload,
} from '../lib/modelOverviewTypes';

const POLL_HEALTHY_MS = 30_000;
const POLL_ATTENTION_MS = 8_000;

export function useModelOverview() {
  const [data, setData] = useState<ModelOverviewPayload | null>(null);
  const [raw, setRaw] = useState<unknown | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<number | null>(null);

  const refresh = useCallback(async () => {
    try {
      const res = await getModelOverview();
      const parsed = parseModelOverviewPayload(res);
      setRaw(res);
      setData(parsed);
      setError(null);
      setLastUpdated(Date.now());
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    const interval = isOverviewFullyHealthy(data) ? POLL_HEALTHY_MS : POLL_ATTENTION_MS;
    const id = window.setInterval(() => {
      void refresh();
    }, interval);
    return () => window.clearInterval(id);
  }, [data, refresh]);

  return { data, raw, error, loading, lastUpdated, refresh };
}

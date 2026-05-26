'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import { getQueueMonitoring } from '../lib/api';
import {
  type KpiMetricKey,
  type KpiSample,
  type SparkRow,
  monitoringToSample,
  pushSample,
  samplesToSparkRows,
  seedSamplesFromMonitoring,
} from '../lib/home/kpiSeries';
import type { QueueMonitoringResponse } from '../lib/monitoringTypes';

const DEFAULT_POLL_MS = 20_000;
const DEFAULT_MAX_POINTS = 24;

export type UseKpiTimeSeriesOptions = {
  pollMs?: number;
  maxPoints?: number;
  enabled?: boolean;
};

export type KpiTimeSeriesState = {
  samples: KpiSample[];
  monitoring: QueueMonitoringResponse | null;
  monitoringError: string | null;
  pollError: string | null;
  sparkline: (key: KpiMetricKey) => SparkRow[];
};

export function useKpiTimeSeries(
  initialMonitoring: QueueMonitoringResponse | null,
  initialError: string | null,
  options: UseKpiTimeSeriesOptions = {},
): KpiTimeSeriesState {
  const pollMs = options.pollMs ?? DEFAULT_POLL_MS;
  const maxPoints = options.maxPoints ?? DEFAULT_MAX_POINTS;
  const enabled = options.enabled ?? true;

  const [samples, setSamples] = useState<KpiSample[]>(() =>
    seedSamplesFromMonitoring(initialMonitoring, maxPoints),
  );
  const [monitoring, setMonitoring] = useState<QueueMonitoringResponse | null>(initialMonitoring);
  const [monitoringError, setMonitoringError] = useState<string | null>(initialError);
  const [pollError, setPollError] = useState<string | null>(null);
  const visibleRef = useRef(true);

  const appendMonitoring = useCallback(
    (payload: QueueMonitoringResponse) => {
      setMonitoring(payload);
      setMonitoringError(null);
      setPollError(null);
      setSamples((prev) => pushSample(prev, monitoringToSample(payload), maxPoints));
    },
    [maxPoints],
  );

  useEffect(() => {
    if (initialMonitoring) {
      setSamples(seedSamplesFromMonitoring(initialMonitoring, maxPoints));
      setMonitoring(initialMonitoring);
    }
    setMonitoringError(initialError);
  }, [initialMonitoring, initialError, maxPoints]);

  useEffect(() => {
    if (!enabled || monitoringError) return;

    const onVisibility = () => {
      visibleRef.current = !document.hidden;
    };
    document.addEventListener('visibilitychange', onVisibility);
    onVisibility();

    let cancelled = false;

    const tick = async () => {
      if (!visibleRef.current || cancelled) return;
      try {
        const payload = await getQueueMonitoring();
        if (cancelled) return;
        appendMonitoring(payload);
      } catch (e: unknown) {
        if (cancelled) return;
        setPollError(e instanceof Error ? e.message : String(e));
      }
    };

    void tick();
    const id = window.setInterval(() => {
      void tick();
    }, pollMs);

    return () => {
      cancelled = true;
      window.clearInterval(id);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [enabled, monitoringError, pollMs, appendMonitoring]);

  const sparkline = useCallback(
    (key: KpiMetricKey) => samplesToSparkRows(samples, key),
    [samples],
  );

  return {
    samples,
    monitoring,
    monitoringError,
    pollError,
    sparkline,
  };
}

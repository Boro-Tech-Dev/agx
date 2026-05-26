'use client';

import { createContext, useContext, type ReactNode } from 'react';

import { useKpiTimeSeries, type KpiTimeSeriesState } from '../../hooks/useKpiTimeSeries';
import type { QueueMonitoringResponse } from '../../lib/monitoringTypes';

const HomeKpiMetricsContext = createContext<KpiTimeSeriesState | null>(null);

export function HomeKpiMetricsProvider({
  initialMonitoring,
  monitoringError,
  children,
}: {
  initialMonitoring: QueueMonitoringResponse | null;
  monitoringError: string | null;
  children: ReactNode;
}) {
  const value = useKpiTimeSeries(initialMonitoring, monitoringError);
  return <HomeKpiMetricsContext.Provider value={value}>{children}</HomeKpiMetricsContext.Provider>;
}

export function useHomeKpiMetrics(): KpiTimeSeriesState {
  const ctx = useContext(HomeKpiMetricsContext);
  if (!ctx) {
    throw new Error('useHomeKpiMetrics must be used within HomeKpiMetricsProvider');
  }
  return ctx;
}

/** Safe for optional dossier wiring when provider is absent. */
export function useHomeKpiMetricsOptional(): KpiTimeSeriesState | null {
  return useContext(HomeKpiMetricsContext);
}

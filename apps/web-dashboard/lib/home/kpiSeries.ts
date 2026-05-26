import type { QueueMonitoringResponse } from '../monitoringTypes';

export type KpiSample = {
  at: string;
  queuePressure: number;
  dlq: number;
  activeRuns: number;
  tokens: number;
};

export type KpiMetricKey = 'queuePressure' | 'dlq' | 'activeRuns' | 'tokens';

export type SparkRow = { x: string; y: number };

/** Append a sample and keep at most `maxLen` points (oldest dropped). */
export function pushSample(buffer: KpiSample[], sample: KpiSample, maxLen: number): KpiSample[] {
  const next = [...buffer, sample];
  if (next.length <= maxLen) return next;
  return next.slice(next.length - maxLen);
}

/** Extract one monitoring snapshot into KPI sample fields. */
export function monitoringToSample(monitoring: QueueMonitoringResponse, at: Date = new Date()): KpiSample {
  const q = monitoring.queues;
  const pending = q?.pending_length ?? 0;
  const processing = q?.processing_length ?? 0;
  return {
    at: at.toISOString(),
    queuePressure: pending + processing,
    dlq: q?.dead_letter_length ?? 0,
    activeRuns: monitoring.active_runs?.length ?? 0,
    tokens: Math.max(0, Math.floor(Number(monitoring.llm_usage?.total_tokens) || 0)),
  };
}

/** Short clock label for sparkline x-axis (decorative). */
export function formatSampleTimeLabel(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
}

export function samplesToSparkRows(samples: KpiSample[], key: KpiMetricKey): SparkRow[] {
  return samples.map((s) => ({ x: formatSampleTimeLabel(s.at), y: s[key] }));
}

export function seedSamplesFromMonitoring(
  monitoring: QueueMonitoringResponse | null,
  maxLen: number,
): KpiSample[] {
  if (!monitoring) return [];
  return pushSample([], monitoringToSample(monitoring), maxLen);
}

import { describe, expect, it } from 'vitest';

import type { QueueMonitoringResponse } from '../monitoringTypes';
import {
  formatSampleTimeLabel,
  monitoringToSample,
  pushSample,
  samplesToSparkRows,
  seedSamplesFromMonitoring,
} from './kpiSeries';

function mockMonitoring(overrides: Partial<QueueMonitoringResponse> = {}): QueueMonitoringResponse {
  return {
    queues: {
      pending_length: 3,
      processing_length: 2,
      dead_letter_length: 1,
      pending_name: 'p',
      processing_name: 'x',
      dead_name: 'd',
    },
    active_runs: [{ id: '1', agent_key: 'pm', status: 'running', title: null, created_at: '' }],
    llm_usage: {
      prompt_tokens: 10,
      completion_tokens: 5,
      total_tokens: 15,
      estimated_savings_usd: 0,
      usd_per_1k_tokens: 0,
    },
    ...overrides,
  };
}

describe('pushSample', () => {
  it('caps buffer length', () => {
    const s1 = monitoringToSample(mockMonitoring(), new Date('2026-01-01T00:00:00Z'));
    const s2 = monitoringToSample(mockMonitoring(), new Date('2026-01-01T00:01:00Z'));
    const s3 = monitoringToSample(mockMonitoring(), new Date('2026-01-01T00:02:00Z'));
    let buf = pushSample([], s1, 2);
    buf = pushSample(buf, s2, 2);
    buf = pushSample(buf, s3, 2);
    expect(buf).toHaveLength(2);
    expect(buf[0].at).toBe(s2.at);
    expect(buf[1].at).toBe(s3.at);
  });
});

describe('monitoringToSample', () => {
  it('sums queue pressure and reads active runs', () => {
    const sample = monitoringToSample(mockMonitoring(), new Date('2026-05-18T14:30:00Z'));
    expect(sample.queuePressure).toBe(5);
    expect(sample.dlq).toBe(1);
    expect(sample.activeRuns).toBe(1);
    expect(sample.tokens).toBe(15);
    expect(sample.at).toBe('2026-05-18T14:30:00.000Z');
  });
});

describe('samplesToSparkRows', () => {
  it('maps metric keys to chart rows', () => {
    const samples = seedSamplesFromMonitoring(mockMonitoring(), 8);
    const rows = samplesToSparkRows(samples, 'queuePressure');
    expect(rows.length).toBe(1);
    expect(rows[0].y).toBe(5);
    expect(rows[0].x).toMatch(/\d{2}:\d{2}/);
  });
});

describe('formatSampleTimeLabel', () => {
  it('returns HH:mm for valid ISO', () => {
    expect(formatSampleTimeLabel('2026-05-18T14:30:00Z')).toMatch(/^\d{1,2}:\d{2}$/);
  });
});

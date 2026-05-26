import { describe, expect, it } from 'vitest';

import {
  agentRetrievalDefaultLabel,
  buildRerankerRunOptions,
  RERANKER_RUN_DEFAULT,
  rerankerOverrideForRun,
} from './retrievalRunOptions';

describe('retrievalRunOptions', () => {
  const catalog = [
    { reranker_id: 'off', display_name: 'Off' },
    { reranker_id: 'colbert_gte_modern', display_name: 'ColBERT (GTE Modern v1)' },
  ];

  it('builds agent default plus catalog entries', () => {
    const options = buildRerankerRunOptions(catalog, {
      agent: 'pm',
      reranker_id: 'colbert_gte_modern',
      reranker_display: 'ColBERT (GTE Modern v1)',
    });
    expect(options[0]).toEqual({
      value: RERANKER_RUN_DEFAULT,
      label: 'Agent default (ColBERT (GTE Modern v1))',
    });
    expect(options.find((o) => o.value === 'off')?.label).toBe('Off (RRF only)');
    expect(options.some((o) => o.value === 'colbert_gte_modern')).toBe(true);
  });

  it('maps agent default to undefined override', () => {
    expect(rerankerOverrideForRun(RERANKER_RUN_DEFAULT)).toBeUndefined();
    expect(rerankerOverrideForRun('')).toBeUndefined();
  });

  it('maps explicit choices to override ids', () => {
    expect(rerankerOverrideForRun('off')).toBe('off');
    expect(rerankerOverrideForRun('colbert_gte_modern')).toBe('colbert_gte_modern');
  });

  it('falls back when agent row missing', () => {
    expect(agentRetrievalDefaultLabel(null)).toBe('not configured');
  });
});

import { describe, expect, it } from 'vitest';

import {
  MODEL_STATUS_POLL_ATTENTION_MS,
  MODEL_STATUS_POLL_HEALTHY_MS,
  isModelStatusFullyHealthy,
  modelStatusPollIntervalMs,
} from './modelStatusPolling';
import type { ModelStatusPayload } from './modelStatusTypes';

const healthy: ModelStatusPayload = {
  ok: true,
  models_ready: true,
  models_runnable: true,
  required: [],
  backends: {},
  routes: {},
  embed_model: 'nomic-embed-text',
  features: { ollama_pull_enabled: true },
};

describe('modelStatusPolling', () => {
  it('uses attention interval when not fully healthy', () => {
    expect(modelStatusPollIntervalMs({ ...healthy, models_runnable: false })).toBe(
      MODEL_STATUS_POLL_ATTENTION_MS,
    );
    expect(modelStatusPollIntervalMs(null)).toBe(MODEL_STATUS_POLL_ATTENTION_MS);
  });

  it('uses healthy interval when all green', () => {
    expect(modelStatusPollIntervalMs(healthy)).toBe(MODEL_STATUS_POLL_HEALTHY_MS);
    expect(isModelStatusFullyHealthy(healthy)).toBe(true);
  });
});

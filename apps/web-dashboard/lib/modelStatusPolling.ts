import type { ModelStatusPayload } from './modelStatusTypes';

/** Poll quickly while router/models are degraded so the nav dot tracks recovery. */
export const MODEL_STATUS_POLL_ATTENTION_MS = 4_000;

/** Steady-state interval — fast enough to feel live without hammering Ollama probes. */
export const MODEL_STATUS_POLL_HEALTHY_MS = 15_000;

export function isModelStatusFullyHealthy(data: ModelStatusPayload | null): boolean {
  if (data == null) return false;
  return data.ok === true && data.models_ready === true && data.models_runnable === true;
}

export function modelStatusPollIntervalMs(data: ModelStatusPayload | null): number {
  return isModelStatusFullyHealthy(data) ? MODEL_STATUS_POLL_HEALTHY_MS : MODEL_STATUS_POLL_ATTENTION_MS;
}

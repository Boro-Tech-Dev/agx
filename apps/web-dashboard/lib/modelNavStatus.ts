import { parseModelStatusPayload } from './modelStatusTypes';
import { agentsWithRerankerFailures, type ModelOverviewPayload } from './modelOverviewTypes';

/**
 * Maps model-router `/v1/models` payload (via agent-api `/api/model/status`) to a nav traffic-light tone.
 * Uses the same parsing as the Model status page so null/odd payloads become red, not a neutral "unknown".
 * Optional overview elevates to yellow when a tool-capable agent's reranker probe failed.
 */
export type ModelNavTone = 'green' | 'yellow' | 'red';

export function deriveModelNavTone(raw: unknown, overview?: ModelOverviewPayload | null): ModelNavTone {
  const parsed = parseModelStatusPayload(raw);
  if (!parsed.ok) return 'red';
  if (!parsed.models_ready || !parsed.models_runnable) return 'yellow';
  if (overview && agentsWithRerankerFailures(overview).length > 0) return 'yellow';
  return 'green';
}

export function modelNavToneTitle(tone: ModelNavTone, overview?: ModelOverviewPayload | null): string {
  const rerankAgents = overview ? agentsWithRerankerFailures(overview) : [];
  switch (tone) {
    case 'green':
      return 'Models: AI stack healthy';
    case 'yellow':
      if (rerankAgents.length > 0) {
        return `Models: reranker degraded for ${rerankAgents.join(', ')} — open Models for details`;
      }
      return 'Models: router reachable but models missing or not runnable — open Models for details';
    case 'red':
      return 'Models: router or backends unreachable — open Models for details';
  }
}

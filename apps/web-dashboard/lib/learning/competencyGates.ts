import type { ToolCatalogId } from '../toolCatalog';

/** Tools gated until learner holds competency (Phase 3). */
const TOOL_REQUIRED_COMPETENCY: Partial<Record<ToolCatalogId, string>> = {
  veeva_suite: 'veeva_orientation',
  ask_clarifier: 'client_ai_safe',
  reply_coach: 'client_ai_safe',
};

export function competencyRequiredForTool(toolId: ToolCatalogId): string | null {
  if (process.env.NEXT_PUBLIC_LEARNING_GATES_DISABLED === '1') return null;
  return TOOL_REQUIRED_COMPETENCY[toolId] ?? null;
}

export function isToolGated(toolId: ToolCatalogId, held: Set<string>): boolean {
  const req = competencyRequiredForTool(toolId);
  if (!req) return false;
  return !held.has(req);
}

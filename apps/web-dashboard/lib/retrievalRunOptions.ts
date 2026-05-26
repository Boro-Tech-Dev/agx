/** Per-run reranker select helpers for tool-capable agent pages. */

export type RerankerCatalogRow = {
  reranker_id: string;
  display_name: string;
};

export type AgentRetrievalRow = {
  agent: string;
  reranker_id: string;
  reranker_display?: string;
};

/** Sentinel: use agent default from retrieval playground (omit reranker_override). */
export const RERANKER_RUN_DEFAULT = '' as const;

export type RerankerRunChoice = typeof RERANKER_RUN_DEFAULT | string;

export function agentRetrievalDefaultLabel(agentRow?: AgentRetrievalRow | null): string {
  if (!agentRow) return 'not configured';
  return agentRow.reranker_display ?? agentRow.reranker_id ?? 'off';
}

export function buildRerankerRunOptions(
  rerankers: RerankerCatalogRow[],
  agentDefault?: AgentRetrievalRow | null,
): { value: RerankerRunChoice; label: string }[] {
  const defaultLabel = agentRetrievalDefaultLabel(agentDefault);
  const options: { value: RerankerRunChoice; label: string }[] = [
    { value: RERANKER_RUN_DEFAULT, label: `Agent default (${defaultLabel})` },
  ];
  for (const r of rerankers) {
    const label =
      r.reranker_id === 'off' ? 'Off (RRF only)' : r.display_name || r.reranker_id;
    options.push({ value: r.reranker_id, label });
  }
  return options;
}

/** Map UI choice to run input.reranker_override (undefined = agent default). */
export function rerankerOverrideForRun(choice: RerankerRunChoice): string | undefined {
  if (!choice || choice === RERANKER_RUN_DEFAULT) return undefined;
  return choice;
}

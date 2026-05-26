import type {
  AgentRetrievalRow,
  EmbedderCatalogRow,
  ModelOverviewPayload,
  RerankerCatalogRow,
  RerankerHealthRow,
} from './modelOverviewTypes';

export type EmbedderTileState = 'default' | 'ready' | 'missing_model' | 'needs_backfill' | 'optional';

export type RerankerTileState = 'off' | 'healthy' | 'stub' | 'failed' | 'ollama';

export function agentsByEmbedder(agents: AgentRetrievalRow[]): Map<string, string[]> {
  const map = new Map<string, string[]>();
  for (const a of agents) {
    const list = map.get(a.embedder_id) ?? [];
    list.push(a.agent);
    map.set(a.embedder_id, list);
  }
  for (const [k, v] of Array.from(map.entries())) {
    map.set(k, [...v].sort());
  }
  return map;
}

export function agentsByReranker(agents: AgentRetrievalRow[]): Map<string, string[]> {
  const map = new Map<string, string[]>();
  for (const a of agents) {
    const list = map.get(a.reranker_id) ?? [];
    list.push(a.agent);
    map.set(a.reranker_id, list);
  }
  for (const [k, v] of Array.from(map.entries())) {
    map.set(k, [...v].sort());
  }
  return map;
}

function isEmbedderInOllamaRequired(
  embedder: EmbedderCatalogRow,
  requiredIds: Set<string>,
): boolean {
  const tag = embedder.ollama_tag ?? embedder.embedder_id;
  return requiredIds.has(tag) || requiredIds.has(embedder.embedder_id);
}

function ollamaTagInstalled(required: string, installed: string[]): boolean {
  return installed.some((name) => name === required || name.startsWith(`${required}:`));
}

function isEmbedderModelInstalled(
  embedder: EmbedderCatalogRow,
  installed: string[],
): boolean {
  const tag = embedder.ollama_tag ?? embedder.embedder_id;
  return ollamaTagInstalled(tag, installed) || ollamaTagInstalled(embedder.embedder_id, installed);
}

export function deriveEmbedderTileState(
  embedder: EmbedderCatalogRow,
  overview: ModelOverviewPayload,
): EmbedderTileState {
  const defaultEmbed = overview.ollama.embed_model;
  const tag = embedder.ollama_tag ?? embedder.embedder_id;
  const isDefault = embedder.embedder_id === defaultEmbed || tag === defaultEmbed;
  const requiredIds = new Set(overview.ollama.required.map((r) => r.id));
  const inRequired = isEmbedderInOllamaRequired(embedder, requiredIds);
  const installed = overview.ollama.backends.ollama?.installed ?? [];
  const modelInstalled = isEmbedderModelInstalled(embedder, installed);
  const missing = overview.retrieval.missing_embeddings[embedder.embedder_id] ?? 0;

  if (isDefault) {
    if (!modelInstalled) return 'missing_model';
    if (missing > 0) return 'needs_backfill';
    return 'default';
  }

  if (inRequired) {
    if (!modelInstalled) return 'missing_model';
    if (missing > 0) return 'needs_backfill';
    return 'ready';
  }

  if (!modelInstalled) return 'optional';
  if (missing > 0) return 'needs_backfill';
  return 'optional';
}

export function deriveRerankerTileState(
  reranker: RerankerCatalogRow,
  health: RerankerHealthRow | undefined,
): RerankerTileState {
  if (reranker.backend === 'none' || reranker.reranker_id === 'off') return 'off';
  if (reranker.backend === 'ollama') return 'ollama';
  if (health?.ok === true && health.health?.backend === 'stub') return 'stub';
  if (health?.ok === true) return 'healthy';
  if (health?.ok === false) return 'failed';
  return 'failed';
}

export function embedderStateLabel(state: EmbedderTileState): string {
  switch (state) {
    case 'default':
      return 'Default';
    case 'ready':
      return 'Ready';
    case 'missing_model':
      return 'Missing';
    case 'needs_backfill':
      return 'Needs backfill';
    case 'optional':
      return 'Pull + backfill';
    default:
      return 'Unknown';
  }
}

export function rerankerStateLabel(state: RerankerTileState, health?: RerankerHealthRow): string {
  switch (state) {
    case 'off':
      return 'Off';
    case 'healthy':
      return health?.latency_ms != null ? `${health.latency_ms}ms` : 'Healthy';
    case 'stub':
      return 'Stub';
    case 'failed':
      return 'Failed';
    case 'ollama':
      return 'Ollama tag';
    default:
      return 'Unknown';
  }
}

export function embedderStateDotClass(state: EmbedderTileState): string {
  switch (state) {
    case 'default':
    case 'ready':
      return 'bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.6)]';
    case 'missing_model':
      return 'bg-amber-400 shadow-[0_0_10px_rgba(251,191,36,0.45)] motion-safe:animate-pulse';
    case 'needs_backfill':
      return 'bg-amber-400 shadow-[0_0_10px_rgba(251,191,36,0.45)]';
    case 'optional':
      return 'bg-slate-400';
    default:
      return 'bg-slate-400';
  }
}

export function rerankerStateDotClass(state: RerankerTileState): string {
  switch (state) {
    case 'healthy':
      return 'bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.6)]';
    case 'stub':
      return 'bg-amber-400 shadow-[0_0_10px_rgba(251,191,36,0.45)]';
    case 'failed':
      return 'bg-rose-400 shadow-[0_0_10px_rgba(251,113,133,0.5)]';
    case 'off':
    case 'ollama':
      return 'bg-slate-400';
    default:
      return 'bg-slate-400';
  }
}

export function embedderBadgeClass(state: EmbedderTileState): string {
  switch (state) {
    case 'default':
      return 'bg-violet-100 text-violet-800 dark:bg-violet-500/15 dark:text-violet-200';
    case 'ready':
      return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-200';
    case 'missing_model':
    case 'needs_backfill':
      return 'bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-200';
    default:
      return 'bg-slate-100 text-slate-700 dark:bg-slate-500/15 dark:text-slate-200';
  }
}

export function rerankerBadgeClass(state: RerankerTileState): string {
  switch (state) {
    case 'healthy':
      return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-200';
    case 'stub':
      return 'bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-200';
    case 'failed':
      return 'bg-rose-100 text-rose-800 dark:bg-rose-500/20 dark:text-rose-200';
    case 'off':
    case 'ollama':
      return 'bg-slate-100 text-slate-700 dark:bg-slate-500/15 dark:text-slate-200';
    default:
      return 'bg-slate-100 text-slate-700 dark:bg-slate-500/15 dark:text-slate-200';
  }
}

/** Heuristic accent from embedder_id or reranker_id. */
export function retrievalFamilyClasses(
  id: string,
  kind: 'embedder' | 'reranker',
): { ring: string; chip: string; glow: string } {
  const lower = id.toLowerCase();

  if (kind === 'embedder') {
    if (lower.includes('nomic') || lower.includes('embed'))
      return {
        ring: 'ring-violet-500/25 hover:ring-violet-500/40',
        chip: 'bg-violet-100 text-violet-800 dark:bg-violet-500/15 dark:text-violet-200',
        glow: 'from-violet-500/10',
      };
    if (lower.includes('gemma'))
      return {
        ring: 'ring-rose-500/25 hover:ring-rose-500/40',
        chip: 'bg-rose-100 text-rose-800 dark:bg-rose-500/15 dark:text-rose-200',
        glow: 'from-rose-500/10',
      };
    if (lower.includes('mxbai'))
      return {
        ring: 'ring-sky-500/25 hover:ring-sky-500/40',
        chip: 'bg-sky-100 text-sky-800 dark:bg-sky-500/15 dark:text-sky-200',
        glow: 'from-sky-500/10',
      };
    if (lower.includes('bge'))
      return {
        ring: 'ring-cyan-500/25 hover:ring-cyan-500/40',
        chip: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-500/15 dark:text-cyan-200',
        glow: 'from-cyan-500/10',
      };
  }

  if (kind === 'reranker') {
    if (lower === 'off')
      return {
        ring: 'ring-slate-500/25 hover:ring-slate-500/40',
        chip: 'bg-slate-100 text-slate-700 dark:bg-slate-500/15 dark:text-slate-200',
        glow: 'from-slate-500/10',
      };
    if (lower.includes('bge'))
      return {
        ring: 'ring-cyan-500/25 hover:ring-cyan-500/40',
        chip: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-500/15 dark:text-cyan-200',
        glow: 'from-cyan-500/10',
      };
    if (lower.includes('jina'))
      return {
        ring: 'ring-amber-500/25 hover:ring-amber-500/40',
        chip: 'bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-200',
        glow: 'from-amber-500/10',
      };
    if (lower.includes('colbert'))
      return {
        ring: 'ring-indigo-500/25 hover:ring-indigo-500/40',
        chip: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-500/15 dark:text-indigo-200',
        glow: 'from-indigo-500/10',
      };
    if (lower.includes('mxbai'))
      return {
        ring: 'ring-sky-500/25 hover:ring-sky-500/40',
        chip: 'bg-sky-100 text-sky-800 dark:bg-sky-500/15 dark:text-sky-200',
        glow: 'from-sky-500/10',
      };
    if (lower.includes('qwen'))
      return {
        ring: 'ring-teal-500/25 hover:ring-teal-500/40',
        chip: 'bg-teal-100 text-teal-800 dark:bg-teal-500/15 dark:text-teal-200',
        glow: 'from-teal-500/10',
      };
  }

  return {
    ring: 'ring-slate-500/25 hover:ring-slate-500/40',
    chip: 'bg-slate-100 text-slate-700 dark:bg-slate-500/15 dark:text-slate-200',
    glow: 'from-slate-500/10',
  };
}

export function embedderPullTag(embedder: EmbedderCatalogRow): string {
  return embedder.ollama_tag ?? embedder.embedder_id;
}

export function isEmbedderModelMissing(
  embedder: EmbedderCatalogRow,
  overview: ModelOverviewPayload,
): boolean {
  const installed = overview.ollama.backends.ollama?.installed ?? [];
  return !isEmbedderModelInstalled(embedder, installed);
}

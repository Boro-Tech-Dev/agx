/**
 * Typed view of model-router `/v1/models` (via agent-api `/api/model/status`).
 */

export type RequiredModelRow = {
  id: string;
  backend: string;
  satisfied: boolean;
  runnable: boolean;
  run_error?: string;
};

export type OllamaBackendInfo = {
  reachable: boolean | null;
  base_url?: string;
  installed: string[];
  error?: string;
};

export type ModelStatusFeatures = {
  ollama_pull_enabled: boolean;
};

export type ModelStatusPayload = {
  ok: boolean;
  error?: string;
  models_ready: boolean;
  models_runnable: boolean;
  required: RequiredModelRow[];
  backends: { ollama?: OllamaBackendInfo };
  routes: Record<string, string>;
  embed_model: string;
  features: ModelStatusFeatures;
};

function asRecord(v: unknown): Record<string, unknown> | null {
  return v != null && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
}

function parseRequiredRow(v: unknown): RequiredModelRow | null {
  const o = asRecord(v);
  if (!o) return null;
  const id = typeof o.id === 'string' ? o.id : '';
  if (!id) return null;
  return {
    id,
    backend: typeof o.backend === 'string' ? o.backend : 'ollama',
    satisfied: o.satisfied === true,
    runnable: o.runnable === true,
    run_error: typeof o.run_error === 'string' ? o.run_error : undefined,
  };
}

function parseOllamaBackend(v: unknown): OllamaBackendInfo | undefined {
  const o = asRecord(v);
  if (!o) return undefined;
  const installedRaw = o.installed;
  const installed = Array.isArray(installedRaw)
    ? installedRaw.filter((x): x is string => typeof x === 'string')
    : [];
  return {
    reachable: typeof o.reachable === 'boolean' ? o.reachable : null,
    base_url: typeof o.base_url === 'string' ? o.base_url : undefined,
    installed,
    error: typeof o.error === 'string' ? o.error : undefined,
  };
}

function parseRoutes(v: unknown): Record<string, string> {
  const o = asRecord(v);
  if (!o) return {};
  const out: Record<string, string> = {};
  for (const [k, val] of Object.entries(o)) {
    if (typeof val === 'string' && val) out[k] = val;
  }
  return out;
}

/** Safe parse for UI; never throws. */
export function parseModelStatusPayload(raw: unknown): ModelStatusPayload {
  const o = asRecord(raw);
  if (!o) {
    return {
      ok: false,
      error: 'Invalid status payload',
      models_ready: false,
      models_runnable: false,
      required: [],
      backends: {},
      routes: {},
      embed_model: '',
      features: { ollama_pull_enabled: false },
    };
  }

  const requiredRaw = o.required;
  const required: RequiredModelRow[] = Array.isArray(requiredRaw)
    ? (requiredRaw.map(parseRequiredRow).filter(Boolean) as RequiredModelRow[])
    : [];

  const missing = required.filter((r) => !r.satisfied);
  const models_ready =
    typeof o.models_ready === 'boolean' ? o.models_ready : missing.length === 0;

  const models_runnable = typeof o.models_runnable === 'boolean' ? o.models_runnable : true;

  const backendsObj = asRecord(o.backends);
  const ollama = backendsObj ? parseOllamaBackend(backendsObj.ollama) : undefined;
  const backends: ModelStatusPayload['backends'] = ollama ? { ollama } : {};

  const featuresRaw = asRecord(o.features);
  const ollama_pull_enabled =
    featuresRaw && typeof featuresRaw.ollama_pull_enabled === 'boolean'
      ? featuresRaw.ollama_pull_enabled
      : true;

  return {
    ok: o.ok === true,
    error: typeof o.error === 'string' ? o.error : undefined,
    models_ready,
    models_runnable,
    required,
    backends,
    routes: parseRoutes(o.routes),
    embed_model: typeof o.embed_model === 'string' ? o.embed_model : '',
    features: { ollama_pull_enabled },
  };
}

export function agentsUsingModel(routes: Record<string, string>, modelId: string): string[] {
  return Object.entries(routes)
    .filter(([, mid]) => mid === modelId)
    .map(([agent]) => agent)
    .sort();
}

export type TileState = 'ready' | 'missing' | 'probe_failed';

export function deriveTileState(row: RequiredModelRow): TileState {
  if (!row.satisfied) return 'missing';
  if (!row.runnable) return 'probe_failed';
  return 'ready';
}

/** Heuristic accent from model id (no extra assets). */
export function modelFamilyClasses(modelId: string): { ring: string; chip: string; glow: string } {
  const base = modelId.split(':')[0]?.toLowerCase() ?? '';
  if (base.includes('nomic') || base.includes('embed'))
    return {
      ring: 'ring-violet-500/25 hover:ring-violet-500/40',
      chip: 'bg-violet-100 text-violet-800 dark:bg-violet-500/15 dark:text-violet-200',
      glow: 'from-violet-500/10',
    };
  if (base.includes('qwen'))
    return {
      ring: 'ring-cyan-500/25 hover:ring-cyan-500/40',
      chip: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-500/15 dark:text-cyan-200',
      glow: 'from-cyan-500/10',
    };
  if (base.includes('llama'))
    return {
      ring: 'ring-amber-500/25 hover:ring-amber-500/40',
      chip: 'bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-200',
      glow: 'from-amber-500/10',
    };
  if (base.includes('deepseek'))
    return {
      ring: 'ring-sky-500/25 hover:ring-sky-500/40',
      chip: 'bg-sky-100 text-sky-800 dark:bg-sky-500/15 dark:text-sky-200',
      glow: 'from-sky-500/10',
    };
  if (base.includes('gemma'))
    return {
      ring: 'ring-rose-500/25 hover:ring-rose-500/40',
      chip: 'bg-rose-100 text-rose-800 dark:bg-rose-500/15 dark:text-rose-200',
      glow: 'from-rose-500/10',
    };
  if (base.includes('tiny'))
    return {
      ring: 'ring-emerald-500/25 hover:ring-emerald-500/40',
      chip: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-200',
      glow: 'from-emerald-500/10',
    };
  return {
    ring: 'ring-slate-500/25 hover:ring-slate-500/40',
    chip: 'bg-slate-100 text-slate-700 dark:bg-slate-500/15 dark:text-slate-200',
    glow: 'from-slate-500/10',
  };
}

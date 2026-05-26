/**
 * Typed view of agent-api GET /api/model/overview.
 */

import { parseModelStatusPayload, type ModelStatusPayload } from './modelStatusTypes';

export type EmbedderCatalogRow = {
  embedder_id: string;
  dim: number;
  ollama_tag?: string;
  display_name?: string;
  backend?: string;
};

export type RerankerCatalogRow = {
  reranker_id: string;
  backend: string;
  endpoint?: string | null;
  model_tag?: string | null;
  display_name?: string;
};

export type RerankerHealthRow = {
  reranker_id: string;
  endpoint?: string;
  ok: boolean;
  error?: string;
  latency_ms?: number;
  health?: Record<string, unknown>;
};

export type AgentRetrievalRow = {
  agent: string;
  embedder_id: string;
  reranker_id: string;
  top_k_retrieve?: number;
  top_k_rerank?: number;
  embedder_display?: string;
  reranker_display?: string;
};

export type AgentLaneRow = {
  agent_key: string;
  lane?: string;
  lane_label?: string;
  lane_description?: string;
  default_model?: string;
  tool_model?: string;
  tool_allowlist?: string[];
  default_web_search?: boolean;
  default_use_tools?: boolean;
};

export type RouterFeatures = {
  ollama_pull_enabled?: boolean;
  ollama_probe_chat?: boolean;
  ollama_grammar_failure_fallback?: boolean;
  pm_schema_fallback?: boolean;
  kitt_router_grammar_mode?: string;
  default_embed_model?: string;
  embedding_dim?: number;
  mcp_bridge_enabled?: boolean;
  mcp_targets?: string[];
};

export type ModelOverviewPayload = {
  version: number;
  ok: boolean;
  errors: string[];
  ollama: ModelStatusPayload;
  router: {
    health: Record<string, unknown> | null;
    features: RouterFeatures;
  };
  catalog: {
    embedders: EmbedderCatalogRow[];
    rerankers: RerankerCatalogRow[];
  };
  retrieval: {
    agents: AgentRetrievalRow[];
    embedders: EmbedderCatalogRow[];
    missing_embeddings: Record<string, number>;
  };
  lanes: {
    lanes: Record<string, { label?: string; description?: string }>;
    agents: AgentLaneRow[];
  };
  reranker_health: RerankerHealthRow[];
  runtime: {
    web_deepfetch_reranker_id?: string;
    retrieval_v2_enabled?: boolean;
  };
};

function asRecord(v: unknown): Record<string, unknown> | null {
  return v != null && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
}

function parseEmbedder(v: unknown): EmbedderCatalogRow | null {
  const o = asRecord(v);
  if (!o || typeof o.embedder_id !== 'string') return null;
  return {
    embedder_id: o.embedder_id,
    dim: typeof o.dim === 'number' ? o.dim : 768,
    ollama_tag: typeof o.ollama_tag === 'string' ? o.ollama_tag : undefined,
    display_name: typeof o.display_name === 'string' ? o.display_name : undefined,
    backend: typeof o.backend === 'string' ? o.backend : undefined,
  };
}

function parseReranker(v: unknown): RerankerCatalogRow | null {
  const o = asRecord(v);
  if (!o || typeof o.reranker_id !== 'string') return null;
  return {
    reranker_id: o.reranker_id,
    backend: typeof o.backend === 'string' ? o.backend : '',
    endpoint: typeof o.endpoint === 'string' ? o.endpoint : o.endpoint === null ? null : undefined,
    model_tag: typeof o.model_tag === 'string' ? o.model_tag : o.model_tag === null ? null : undefined,
    display_name: typeof o.display_name === 'string' ? o.display_name : undefined,
  };
}

function parseRerankerHealth(v: unknown): RerankerHealthRow | null {
  const o = asRecord(v);
  if (!o || typeof o.reranker_id !== 'string') return null;
  return {
    reranker_id: o.reranker_id,
    endpoint: typeof o.endpoint === 'string' ? o.endpoint : undefined,
    ok: o.ok === true,
    error: typeof o.error === 'string' ? o.error : undefined,
    latency_ms: typeof o.latency_ms === 'number' ? o.latency_ms : undefined,
    health: asRecord(o.health) ?? undefined,
  };
}

function parseAgentRetrieval(v: unknown): AgentRetrievalRow | null {
  const o = asRecord(v);
  if (!o || typeof o.agent !== 'string') return null;
  return {
    agent: o.agent,
    embedder_id: typeof o.embedder_id === 'string' ? o.embedder_id : '',
    reranker_id: typeof o.reranker_id === 'string' ? o.reranker_id : 'off',
    top_k_retrieve: typeof o.top_k_retrieve === 'number' ? o.top_k_retrieve : undefined,
    top_k_rerank: typeof o.top_k_rerank === 'number' ? o.top_k_rerank : undefined,
    embedder_display: typeof o.embedder_display === 'string' ? o.embedder_display : undefined,
    reranker_display: typeof o.reranker_display === 'string' ? o.reranker_display : undefined,
  };
}

function parseAgentLane(v: unknown): AgentLaneRow | null {
  const o = asRecord(v);
  if (!o || typeof o.agent_key !== 'string') return null;
  const allowRaw = o.tool_allowlist;
  const tool_allowlist = Array.isArray(allowRaw)
    ? allowRaw.filter((x): x is string => typeof x === 'string')
    : undefined;
  return {
    agent_key: o.agent_key,
    lane: typeof o.lane === 'string' ? o.lane : undefined,
    lane_label: typeof o.lane_label === 'string' ? o.lane_label : undefined,
    lane_description: typeof o.lane_description === 'string' ? o.lane_description : undefined,
    default_model: typeof o.default_model === 'string' ? o.default_model : undefined,
    tool_model: typeof o.tool_model === 'string' ? o.tool_model : undefined,
    tool_allowlist,
    default_web_search: o.default_web_search === true,
    default_use_tools: o.default_use_tools === true,
  };
}

function parseRouterFeatures(v: unknown): RouterFeatures {
  const o = asRecord(v);
  if (!o) return {};
  const targetsRaw = o.mcp_targets;
  const mcp_targets = Array.isArray(targetsRaw)
    ? targetsRaw.filter((x): x is string => typeof x === 'string')
    : undefined;
  return {
    ollama_pull_enabled: o.ollama_pull_enabled === true,
    ollama_probe_chat: o.ollama_probe_chat === true,
    ollama_grammar_failure_fallback: o.ollama_grammar_failure_fallback === true,
    pm_schema_fallback: o.pm_schema_fallback === true,
    kitt_router_grammar_mode:
      typeof o.kitt_router_grammar_mode === 'string' ? o.kitt_router_grammar_mode : undefined,
    default_embed_model: typeof o.default_embed_model === 'string' ? o.default_embed_model : undefined,
    embedding_dim: typeof o.embedding_dim === 'number' ? o.embedding_dim : undefined,
    mcp_bridge_enabled: o.mcp_bridge_enabled === true,
    mcp_targets,
  };
}

function parseMissingEmbeddings(v: unknown): Record<string, number> {
  const o = asRecord(v);
  if (!o) return {};
  const out: Record<string, number> = {};
  for (const [k, val] of Object.entries(o)) {
    if (typeof val === 'number') out[k] = val;
  }
  return out;
}

/** Safe parse for UI; never throws. */
export function parseModelOverviewPayload(raw: unknown): ModelOverviewPayload {
  const o = asRecord(raw);
  if (!o) {
    return {
      version: 0,
      ok: false,
      errors: ['Invalid overview payload'],
      ollama: parseModelStatusPayload(null),
      router: { health: null, features: {} },
      catalog: { embedders: [], rerankers: [] },
      retrieval: { agents: [], embedders: [], missing_embeddings: {} },
      lanes: { lanes: {}, agents: [] },
      reranker_health: [],
      runtime: {},
    };
  }

  const errorsRaw = o.errors;
  const errors = Array.isArray(errorsRaw) ? errorsRaw.filter((x): x is string => typeof x === 'string') : [];

  const catalogObj = asRecord(o.catalog);
  const embeddersRaw = catalogObj?.embedders;
  const rerankersRaw = catalogObj?.rerankers;

  const retrievalObj = asRecord(o.retrieval);
  const retrievalAgentsRaw = retrievalObj?.agents;

  const lanesObj = asRecord(o.lanes);
  const laneAgentsRaw = lanesObj?.agents;
  const lanesMetaRaw = asRecord(lanesObj?.lanes);
  const lanesMeta: ModelOverviewPayload['lanes']['lanes'] = {};
  if (lanesMetaRaw) {
    for (const [k, val] of Object.entries(lanesMetaRaw)) {
      const row = asRecord(val);
      if (row) {
        lanesMeta[k] = {
          label: typeof row.label === 'string' ? row.label : undefined,
          description: typeof row.description === 'string' ? row.description : undefined,
        };
      }
    }
  }

  const routerObj = asRecord(o.router);
  const runtimeObj = asRecord(o.runtime);

  return {
    version: typeof o.version === 'number' ? o.version : 1,
    ok: o.ok === true,
    errors,
    ollama: parseModelStatusPayload(o.ollama),
    router: {
      health: asRecord(routerObj?.health),
      features: parseRouterFeatures(routerObj?.features),
    },
    catalog: {
      embedders: Array.isArray(embeddersRaw)
        ? (embeddersRaw.map(parseEmbedder).filter(Boolean) as EmbedderCatalogRow[])
        : [],
      rerankers: Array.isArray(rerankersRaw)
        ? (rerankersRaw.map(parseReranker).filter(Boolean) as RerankerCatalogRow[])
        : [],
    },
    retrieval: {
      agents: Array.isArray(retrievalAgentsRaw)
        ? (retrievalAgentsRaw.map(parseAgentRetrieval).filter(Boolean) as AgentRetrievalRow[])
        : [],
      embedders: Array.isArray(retrievalObj?.embedders)
        ? (retrievalObj!.embedders as unknown[])
            .map(parseEmbedder)
            .filter(Boolean) as EmbedderCatalogRow[]
        : [],
      missing_embeddings: parseMissingEmbeddings(retrievalObj?.missing_embeddings),
    },
    lanes: {
      lanes: lanesMeta,
      agents: Array.isArray(laneAgentsRaw)
        ? (laneAgentsRaw.map(parseAgentLane).filter(Boolean) as AgentLaneRow[])
        : [],
    },
    reranker_health: Array.isArray(o.reranker_health)
      ? (o.reranker_health.map(parseRerankerHealth).filter(Boolean) as RerankerHealthRow[])
      : [],
    runtime: {
      web_deepfetch_reranker_id:
        typeof runtimeObj?.web_deepfetch_reranker_id === 'string'
          ? runtimeObj.web_deepfetch_reranker_id
          : undefined,
      retrieval_v2_enabled: runtimeObj?.retrieval_v2_enabled === true,
    },
  };
}

export function rerankerHealthById(
  rows: RerankerHealthRow[],
): Map<string, RerankerHealthRow> {
  return new Map(rows.map((r) => [r.reranker_id, r]));
}

export function isOverviewFullyHealthy(data: ModelOverviewPayload | null): boolean {
  if (data == null) return false;
  const ollamaOk =
    data.ollama.ok === true && data.ollama.models_ready === true && data.ollama.models_runnable === true;
  const rerankersOk = data.reranker_health.every((h) => h.ok);
  return data.ok === true && ollamaOk && rerankersOk;
}

export function agentsWithRerankerFailures(data: ModelOverviewPayload): string[] {
  const healthMap = rerankerHealthById(data.reranker_health);
  const out: string[] = [];
  for (const a of data.retrieval.agents) {
    if (a.reranker_id === 'off') continue;
    const h = healthMap.get(a.reranker_id);
    if (h && !h.ok) out.push(a.agent);
  }
  return out;
}

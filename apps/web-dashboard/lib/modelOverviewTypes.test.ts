import { describe, expect, it } from 'vitest';

import { deriveModelNavTone } from './modelNavStatus';
import { agentsWithRerankerFailures, parseModelOverviewPayload } from './modelOverviewTypes';

describe('parseModelOverviewPayload', () => {
  it('parses a minimal valid overview', () => {
    const raw = {
      version: 1,
      ok: true,
      errors: [],
      ollama: {
        ok: true,
        models_ready: true,
        models_runnable: true,
        required: [],
        routes: { pm: 'llama3.1:8b' },
        embed_model: 'nomic-embed-text',
        features: { ollama_pull_enabled: true },
      },
      router: { health: { ok: true }, features: { mcp_bridge_enabled: false } },
      catalog: {
        embedders: [{ embedder_id: 'nomic-embed-text', dim: 768, ollama_tag: 'nomic-embed-text' }],
        rerankers: [{ reranker_id: 'colbert_gte_modern', backend: 'tei', endpoint: 'http://reranker-colbert:8097' }],
      },
      retrieval: {
        agents: [{ agent: 'pm', embedder_id: 'nomic-embed-text', reranker_id: 'colbert_gte_modern' }],
        embedders: [],
        missing_embeddings: { 'nomic-embed-text': 0 },
      },
      lanes: { lanes: {}, agents: [{ agent_key: 'pm', lane: 'tool_capable' }] },
      reranker_health: [{ reranker_id: 'colbert_gte_modern', ok: true, latency_ms: 10 }],
      runtime: { web_deepfetch_reranker_id: 'colbert_gte_modern', retrieval_v2_enabled: true },
    };
    const parsed = parseModelOverviewPayload(raw);
    expect(parsed.version).toBe(1);
    expect(parsed.ok).toBe(true);
    expect(parsed.ollama.routes.pm).toBe('llama3.1:8b');
    expect(parsed.catalog.embedders).toHaveLength(1);
    expect(parsed.reranker_health[0]?.ok).toBe(true);
  });

  it('returns safe defaults for invalid input', () => {
    const parsed = parseModelOverviewPayload(null);
    expect(parsed.ok).toBe(false);
    expect(parsed.errors).toContain('Invalid overview payload');
  });
});

describe('agentsWithRerankerFailures', () => {
  it('lists agents whose reranker probe failed', () => {
    const overview = parseModelOverviewPayload({
      version: 1,
      ok: false,
      errors: [],
      ollama: { ok: true, models_ready: true, models_runnable: true, required: [], routes: {} },
      router: { features: {} },
      catalog: { embedders: [], rerankers: [] },
      retrieval: {
        agents: [
          { agent: 'pm', embedder_id: 'n', reranker_id: 'colbert_gte_modern' },
          { agent: 'kitt', embedder_id: 'n', reranker_id: 'off' },
        ],
        embedders: [],
        missing_embeddings: {},
      },
      lanes: { lanes: {}, agents: [] },
      reranker_health: [{ reranker_id: 'colbert_gte_modern', ok: false }],
      runtime: {},
    });
    expect(agentsWithRerankerFailures(overview)).toEqual(['pm']);
  });
});

describe('deriveModelNavTone with overview', () => {
  it('returns yellow when reranker failed for assigned agent', () => {
    const status = { ok: true, models_ready: true, models_runnable: true, required: [], routes: {} };
    const overview = parseModelOverviewPayload({
      version: 1,
      ok: false,
      errors: [],
      ollama: status,
      router: { features: {} },
      catalog: { embedders: [], rerankers: [] },
      retrieval: {
        agents: [{ agent: 'forge', embedder_id: 'n', reranker_id: 'colbert_jina_v2' }],
        embedders: [],
        missing_embeddings: {},
      },
      lanes: { lanes: {}, agents: [] },
      reranker_health: [{ reranker_id: 'colbert_jina_v2', ok: false }],
      runtime: {},
    });
    expect(deriveModelNavTone(status, overview)).toBe('yellow');
  });
});

import { describe, expect, it } from 'vitest';

import { parseModelOverviewPayload, type ModelOverviewPayload } from './modelOverviewTypes';
import {
  agentsByEmbedder,
  agentsByReranker,
  deriveEmbedderTileState,
  deriveRerankerTileState,
} from './retrievalTileState';

function makeOverview(overrides: Partial<ModelOverviewPayload> = {}): ModelOverviewPayload {
  const base = parseModelOverviewPayload({
    version: 1,
    ok: true,
    errors: [],
    ollama: {
      ok: true,
      models_ready: true,
      models_runnable: true,
      required: [{ id: 'nomic-embed-text', backend: 'ollama', satisfied: true, runnable: true }],
      routes: { pm: 'llama3.1:8b' },
      embed_model: 'nomic-embed-text',
      features: { ollama_pull_enabled: true },
      backends: { ollama: { reachable: true, installed: ['nomic-embed-text'] } },
    },
    router: { health: { ok: true }, features: {} },
    catalog: {
      embedders: [
        { embedder_id: 'nomic-embed-text', dim: 768, ollama_tag: 'nomic-embed-text', backend: 'ollama' },
        { embedder_id: 'bge-m3', dim: 1024, ollama_tag: 'bge-m3', backend: 'ollama' },
      ],
      rerankers: [
        { reranker_id: 'off', backend: 'none' },
        { reranker_id: 'colbert_gte_modern', backend: 'tei', endpoint: 'http://reranker-colbert:8097' },
        { reranker_id: 'ollama_mxbai_rerank', backend: 'ollama', model_tag: 'mxbai-rerank-large-v2' },
      ],
    },
    retrieval: {
      agents: [
        { agent: 'pm', embedder_id: 'nomic-embed-text', reranker_id: 'colbert_gte_modern' },
        { agent: 'clinic', embedder_id: 'nomic-embed-text', reranker_id: 'off' },
      ],
      embedders: [],
      missing_embeddings: { 'nomic-embed-text': 0, 'bge-m3': 5 },
    },
    lanes: { lanes: {}, agents: [] },
    reranker_health: [
      { reranker_id: 'colbert_gte_modern', ok: true, latency_ms: 12 },
      { reranker_id: 'colbert_jina_v2', ok: false, error: 'connection refused' },
    ],
    runtime: { web_deepfetch_reranker_id: 'colbert_gte_modern' },
  });
  return { ...base, ...overrides };
}

describe('retrievalTileState', () => {
  it('groups agents by embedder and reranker', () => {
    const overview = makeOverview();
    const byEmbedder = agentsByEmbedder(overview.retrieval.agents);
    expect(byEmbedder.get('nomic-embed-text')).toEqual(['clinic', 'pm']);
    const byReranker = agentsByReranker(overview.retrieval.agents);
    expect(byReranker.get('colbert_gte_modern')).toEqual(['pm']);
    expect(byReranker.get('off')).toEqual(['clinic']);
  });

  it('derives default embedder state when installed and no missing embeddings', () => {
    const overview = makeOverview();
    const nomic = overview.catalog.embedders[0]!;
    expect(deriveEmbedderTileState(nomic, overview)).toBe('default');
  });

  it('derives needs_backfill when default embedder has missing embeddings', () => {
    const overview = makeOverview({
      retrieval: {
        ...makeOverview().retrieval,
        missing_embeddings: { 'nomic-embed-text': 2, 'bge-m3': 5 },
      },
    });
    const nomic = overview.catalog.embedders[0]!;
    expect(deriveEmbedderTileState(nomic, overview)).toBe('needs_backfill');
  });

  it('derives missing_model when default embedder not installed', () => {
    const overview = makeOverview();
    overview.ollama.backends.ollama = { reachable: true, installed: [] };
    const nomic = overview.catalog.embedders[0]!;
    expect(deriveEmbedderTileState(nomic, overview)).toBe('missing_model');
  });

  it('derives optional for unpulled non-default embedder', () => {
    const overview = makeOverview();
    const bge = overview.catalog.embedders[1]!;
    expect(deriveEmbedderTileState(bge, overview)).toBe('optional');
  });

  it('derives needs_backfill for optional embedder with missing embeddings', () => {
    const overview = makeOverview();
    overview.ollama.backends.ollama = {
      reachable: true,
      installed: ['nomic-embed-text', 'bge-m3'],
    };
    const bge = overview.catalog.embedders[1]!;
    expect(deriveEmbedderTileState(bge, overview)).toBe('needs_backfill');
  });

  it('derives default embedder state when installed with :latest tag', () => {
    const overview = makeOverview();
    overview.ollama.backends.ollama = { reachable: true, installed: ['nomic-embed-text:latest'] };
    const nomic = overview.catalog.embedders[0]!;
    expect(deriveEmbedderTileState(nomic, overview)).toBe('default');
  });

  it('derives needs_backfill when default embedder has :latest tag and missing embeddings', () => {
    const overview = makeOverview({
      retrieval: {
        ...makeOverview().retrieval,
        missing_embeddings: { 'nomic-embed-text': 2, 'bge-m3': 5 },
      },
    });
    overview.ollama.backends.ollama = { reachable: true, installed: ['nomic-embed-text:latest'] };
    const nomic = overview.catalog.embedders[0]!;
    expect(deriveEmbedderTileState(nomic, overview)).toBe('needs_backfill');
  });

  it('derives needs_backfill for optional embedder with :latest tag and missing embeddings', () => {
    const overview = makeOverview();
    overview.ollama.backends.ollama = {
      reachable: true,
      installed: ['nomic-embed-text:latest', 'bge-m3:latest'],
    };
    const bge = overview.catalog.embedders[1]!;
    expect(deriveEmbedderTileState(bge, overview)).toBe('needs_backfill');
  });

  it('derives reranker states for off, healthy, stub, failed, and ollama', () => {
    const off = { reranker_id: 'off', backend: 'none' };
    const tei = { reranker_id: 'colbert_gte_modern', backend: 'tei', endpoint: 'http://reranker-colbert:8097' };
    const ollama = { reranker_id: 'ollama_mxbai_rerank', backend: 'ollama', model_tag: 'mxbai-rerank-large-v2' };

    expect(deriveRerankerTileState(off, undefined)).toBe('off');
    expect(deriveRerankerTileState(tei, { reranker_id: 'colbert_gte_modern', ok: true, latency_ms: 12 })).toBe('healthy');
    expect(
      deriveRerankerTileState(
        { reranker_id: 'colbert_gte_modern', backend: 'tei', endpoint: 'http://reranker-colbert:8097' },
        {
          reranker_id: 'colbert_gte_modern',
          ok: true,
          latency_ms: 20,
          health: { ok: true, backend: 'stub', model: 'stub://length-overlap' },
        },
      ),
    ).toBe('stub');
    expect(
      deriveRerankerTileState(
        { reranker_id: 'colbert_jina_v2', backend: 'tei', endpoint: 'http://reranker-colbert:8097' },
        { reranker_id: 'colbert_jina_v2', ok: false, error: 'connection refused' },
      ),
    ).toBe('failed');
    expect(deriveRerankerTileState(ollama, undefined)).toBe('ollama');
  });
});

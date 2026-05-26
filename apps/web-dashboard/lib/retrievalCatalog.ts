/**
 * Static reference copy for embedder and reranker catalog tiles.
 * Keys match embedder_id / reranker_id from Postgres and model-router.
 */

export type RetrievalCatalogEntry = {
  summary: string;
  strengths: string[];
  weaknesses: string[];
};

/** Canonical embedder IDs from embedder_catalog seed. */
export const EMBEDDER_CATALOG_IDS = [
  'nomic-embed-text',
  'embeddinggemma',
  'mxbai-embed-large',
  'bge-m3',
] as const;

/** Canonical reranker IDs from reranker_catalog seed. */
export const RERANKER_CATALOG_IDS = [
  'off',
  'tei_bge',
  'tei_jina',
  'colbert_gte_modern',
  'colbert_jina_v2',
  'ollama_mxbai_rerank',
  'ollama_qwen3_rerank',
] as const;

const EMBEDDER_ENTRIES: Record<string, RetrievalCatalogEntry> = {
  'nomic-embed-text': {
    summary:
      'An open text embedding model used for semantic search and retrieval—not for chat. Turns text into vectors for similarity, RAG, and clustering.',
    strengths: [
      'Strong open-source retrieval embeddings',
      'Predictable for chunk / document matching',
      'Common choice for local RAG stacks',
    ],
    weaknesses: [
      'Not a generative model—cannot answer prompts directly',
      'Quality varies by domain vs latest closed embeddings',
      'Sensitive to chunking and preprocessing',
    ],
  },
  embeddinggemma: {
    summary:
      'Google EmbeddingGemma 300M — 768-dim embedder, drop-in alternative to nomic for English-heavy RAG without schema migration.',
    strengths: [
      'Same dimension as nomic (no column migration)',
      'Good quality for size on English retrieval',
      'Runs on Ollama locally',
    ],
    weaknesses: [
      'Not a chat model',
      'Weaker than 1024-dim embedders on hard retrieval benchmarks',
      'Less proven than nomic in mixed-domain corpora',
    ],
  },
  'mxbai-embed-large': {
    summary:
      'Mixedbread AI large embedder — 1024-dim vectors for stronger semantic recall when you can afford re-embed and extra storage.',
    strengths: [
      'Higher MTEB scores than small embedders',
      'Good general-purpose retrieval quality',
      'Strong on paraphrase and semantic similarity',
    ],
    weaknesses: [
      'Requires re-embed plus 1024-dim storage',
      'Heavier than 768-dim models',
      'Slower embedding throughput on modest hardware',
    ],
  },
  'bge-m3': {
    summary:
      'BAAI BGE-M3 dense embeddings — 1024-dim, strong multilingual retrieval for mixed-language knowledge bases.',
    strengths: [
      'Multilingual coverage out of the box',
      'Well-tested in open RAG stacks',
      'Strong dense retrieval on MTEB benchmarks',
    ],
    weaknesses: [
      '1024-dim migration from legacy 768-dim indexes',
      'Slower than 768-dim models',
      'Heavier Ollama pull than nomic',
    ],
  },
};

const RERANKER_ENTRIES: Record<string, RetrievalCatalogEntry> = {
  off: {
    summary:
      'No cross-encoder or LLM reranking — retrieval results stay in RRF / vector order. Lowest latency; use when recall is already good.',
    strengths: [
      'Zero rerank latency',
      'No sidecar or Ollama rerank model required',
      'Simplest operational path',
    ],
    weaknesses: [
      'No second-pass relevance scoring',
      'Top-k order may miss nuanced matches',
      'Weaker on ambiguous queries vs cross-encoders',
    ],
  },
  tei_bge: {
    summary:
      'BGE TEI cross-encoder (optional). Not deployed in the default Compose stack — catalog entry disabled on ColBERT-only hosts.',
    strengths: [
      'High cross-encoder quality when TEI sidecars are run manually',
      'Strong passage ranking on English corpora',
      'TEI-compatible /rerank wire format',
    ],
    weaknesses: [
      'Not in default compose',
      'High RAM on CPU hosts',
      'Requires optional TEI setup',
    ],
  },
  tei_jina: {
    summary:
      'Fast TEI cross-encoder slot (optional). Not deployed in the default Compose stack.',
    strengths: [
      'Lower latency than BGE v2 M3 when TEI is enabled',
      'Good multilingual cross-encoder baseline',
      'TEI-compatible /rerank wire format',
    ],
    weaknesses: [
      'Not in default compose',
      'Requires optional TEI setup',
      'Superseded by ColBERT default on VPS hosts',
    ],
  },
  colbert_gte_modern: {
    summary:
      'Default reranker — ColBERT late-interaction (GTE Modern v1) on reranker-colbert:8097. Used for tool-capable agents and web deep-fetch.',
    strengths: [
      'Strong late-interaction recall on long passages',
      'TEI-compatible /rerank wire format',
      'Shares reranker-colbert sidecar with Jina ColBERT variant',
    ],
    weaknesses: [
      'CPU-heavy on first load',
      'Not an embedder or chat model',
      'Only one ColBERT model active per sidecar at a time',
    ],
  },
  colbert_jina_v2: {
    summary:
      'ColBERT Jina v2 multilingual late-interaction reranker — same reranker-colbert sidecar; switch via COLBERT_MODEL env on the container.',
    strengths: [
      'Multilingual ColBERT scoring',
      'Same sidecar host as GTE Modern ColBERT',
      'Better cross-lingual passage matching than dense-only',
    ],
    weaknesses: [
      'Larger model download than GTE Modern',
      'Requires reranker-colbert healthy',
      'Mutually exclusive with GTE Modern on one sidecar',
    ],
  },
  ollama_mxbai_rerank: {
    summary:
      'MxBAI LLM-as-reranker on Ollama — scores passages via generative model instead of a dedicated cross-encoder container.',
    strengths: [
      'No extra TEI sidecar required',
      'Flexible prompting for scoring criteria',
      'Good for experimentation without new infra',
    ],
    weaknesses: [
      'Higher latency than TEI cross-encoders',
      'More score variance than dedicated rerankers',
      'Not probed from overview — needs Ollama pull',
    ],
  },
  ollama_qwen3_rerank: {
    summary:
      'Qwen3 Reranker 0.6B on Ollama — lightweight LLM reranking slice for local experimentation.',
    strengths: [
      'Smaller than mxbai rerank on Ollama',
      'No TEI sidecar required',
      'Good for trying LLM-as-reranker locally',
    ],
    weaknesses: [
      'Slower than TEI cross-encoders',
      'Needs Ollama pull and tag management',
      'Not probed from overview health checks',
    ],
  },
};

export function getEmbedderCatalogEntry(embedderId: string): RetrievalCatalogEntry | null {
  return EMBEDDER_ENTRIES[embedderId] ?? null;
}

export function getRerankerCatalogEntry(rerankerId: string): RetrievalCatalogEntry | null {
  return RERANKER_ENTRIES[rerankerId] ?? null;
}

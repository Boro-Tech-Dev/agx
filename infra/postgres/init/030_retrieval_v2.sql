-- Phase 10: Pluggable embedder + reranker playground

ALTER TABLE memories ADD COLUMN IF NOT EXISTS text_hash TEXT;

-- Unified embeddings (chunk + memory) keyed by embedder
CREATE TABLE IF NOT EXISTS embeddings (
  source_type TEXT NOT NULL CHECK (source_type IN ('document_chunk', 'memory')),
  source_id UUID NOT NULL,
  embedder_id TEXT NOT NULL,
  dim INT NOT NULL CHECK (dim IN (768, 1024)),
  text_hash TEXT NOT NULL,
  embedding_768 vector(768),
  embedding_1024 vector(1024),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (source_type, source_id, embedder_id),
  CONSTRAINT embeddings_dim_vector CHECK (
    (dim = 768 AND embedding_768 IS NOT NULL AND embedding_1024 IS NULL)
    OR (dim = 1024 AND embedding_1024 IS NOT NULL AND embedding_768 IS NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_embeddings_chunk_768
  ON embeddings (embedder_id)
  WHERE source_type = 'document_chunk' AND embedding_768 IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_embeddings_chunk_1024
  ON embeddings (embedder_id)
  WHERE source_type = 'document_chunk' AND embedding_1024 IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_embeddings_memory_768
  ON embeddings (embedder_id)
  WHERE source_type = 'memory' AND embedding_768 IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_embeddings_memory_1024
  ON embeddings (embedder_id)
  WHERE source_type = 'memory' AND embedding_1024 IS NOT NULL;

-- HNSW indexes for cosine search (per dim)
CREATE INDEX IF NOT EXISTS idx_embeddings_hnsw_768
  ON embeddings USING hnsw (embedding_768 vector_cosine_ops)
  WHERE embedding_768 IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_embeddings_hnsw_1024
  ON embeddings USING hnsw (embedding_1024 vector_cosine_ops)
  WHERE embedding_1024 IS NOT NULL;

CREATE TABLE IF NOT EXISTS embedder_catalog (
  embedder_id TEXT PRIMARY KEY,
  dim INT NOT NULL,
  backend TEXT NOT NULL DEFAULT 'ollama',
  ollama_tag TEXT NOT NULL,
  display_name TEXT NOT NULL,
  notes TEXT,
  enabled BOOLEAN NOT NULL DEFAULT true
);

CREATE TABLE IF NOT EXISTS reranker_catalog (
  reranker_id TEXT PRIMARY KEY,
  backend TEXT NOT NULL,
  endpoint TEXT,
  model_tag TEXT,
  display_name TEXT NOT NULL,
  notes TEXT,
  enabled BOOLEAN NOT NULL DEFAULT true
);

CREATE TABLE IF NOT EXISTS agent_retrieval_config (
  agent TEXT PRIMARY KEY CHECK (
    agent IN ('pm', 'synergy', 'clinic', 'builder', 'canon', 'forge', 'kitt', 'eddie', 'bubs')
  ),
  embedder_id TEXT NOT NULL REFERENCES embedder_catalog(embedder_id),
  reranker_id TEXT NOT NULL REFERENCES reranker_catalog(reranker_id),
  top_k_retrieve INT NOT NULL DEFAULT 60 CHECK (top_k_retrieve >= 5 AND top_k_retrieve <= 200),
  top_k_rerank INT NOT NULL DEFAULT 12 CHECK (top_k_rerank >= 1 AND top_k_rerank <= 50),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by TEXT
);

INSERT INTO embedder_catalog (embedder_id, dim, backend, ollama_tag, display_name, notes) VALUES
  ('nomic-embed-text', 768, 'ollama', 'nomic-embed-text', 'Nomic Embed Text', 'Default open embedder; 768-dim'),
  ('embeddinggemma', 768, 'ollama', 'embeddinggemma', 'EmbeddingGemma 300M', 'Google Gemma embedding; 768-dim drop-in'),
  ('mxbai-embed-large', 1024, 'ollama', 'mxbai-embed-large', 'MxBAI Embed Large', 'Stronger retrieval; 1024-dim'),
  ('bge-m3', 1024, 'ollama', 'bge-m3', 'BGE-M3', 'Multilingual dense; 1024-dim')
ON CONFLICT (embedder_id) DO NOTHING;

INSERT INTO reranker_catalog (reranker_id, backend, endpoint, model_tag, display_name, notes) VALUES
  ('off', 'none', NULL, NULL, 'Off', 'No reranking; use RRF order only'),
  ('tei_bge', 'tei', 'http://reranker-bge:8095', 'BAAI/bge-reranker-v2-m3', 'BGE Reranker v2 M3', 'Cross-encoder via TEI'),
  ('tei_jina', 'tei', 'http://reranker-jina:8096', 'jinaai/jina-reranker-v2-base-multilingual', 'Jina Reranker v2', 'Faster TEI cross-encoder'),
  ('colbert_gte_modern', 'tei', 'http://reranker-colbert:8097', 'lightonai/GTE-ModernColBERT-v1', 'ColBERT (GTE Modern v1)', 'Late-interaction reranker (PyLate); default for reranker-colbert.'),
  ('colbert_jina_v2', 'tei', 'http://reranker-colbert:8097', 'jinaai/jina-colbert-v2', 'ColBERT (Jina v2 multilingual)', 'Late-interaction reranker (PyLate); set COLBERT_MODEL on reranker-colbert to switch.'),
  ('ollama_mxbai_rerank', 'ollama', NULL, 'mxbai-rerank-large-v2', 'MxBAI LLM Rerank', 'LLM-as-reranker on Ollama'),
  ('ollama_qwen3_rerank', 'ollama', NULL, 'qwen3-reranker:0.6b', 'Qwen3 Reranker 0.6B', 'LLM-as-reranker on Ollama')
ON CONFLICT (reranker_id) DO NOTHING;

-- Per-agent defaults: tool-capable get rerank; others nomic + off
INSERT INTO agent_retrieval_config (agent, embedder_id, reranker_id, top_k_retrieve, top_k_rerank) VALUES
  ('pm', 'nomic-embed-text', 'colbert_gte_modern', 60, 12),
  ('builder', 'nomic-embed-text', 'colbert_gte_modern', 60, 12),
  ('forge', 'nomic-embed-text', 'colbert_gte_modern', 60, 12),
  ('canon', 'nomic-embed-text', 'colbert_gte_modern', 60, 12),
  ('synergy', 'nomic-embed-text', 'off', 40, 12),
  ('clinic', 'nomic-embed-text', 'off', 40, 12),
  ('kitt', 'nomic-embed-text', 'off', 30, 8),
  ('eddie', 'nomic-embed-text', 'off', 30, 8),
  ('bubs', 'nomic-embed-text', 'off', 30, 8)
ON CONFLICT (agent) DO NOTHING;

-- Backfill embeddings from legacy document_chunks.embedding (nomic only)
INSERT INTO embeddings (source_type, source_id, embedder_id, dim, text_hash, embedding_768)
SELECT
  'document_chunk',
  dc.id,
  'nomic-embed-text',
  768,
  encode(sha256(dc.content::bytea), 'hex'),
  dc.embedding
FROM document_chunks dc
WHERE dc.embedding IS NOT NULL
ON CONFLICT (source_type, source_id, embedder_id) DO NOTHING;

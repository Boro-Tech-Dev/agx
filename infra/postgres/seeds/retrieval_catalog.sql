-- Retrieval playground catalog + per-agent defaults (fresh DB init).
-- ColBERT-only compose: TEI rerankers are catalogued but disabled.

INSERT INTO embedder_catalog (embedder_id, dim, backend, ollama_tag, display_name, notes) VALUES
  ('nomic-embed-text', 768, 'ollama', 'nomic-embed-text', 'Nomic Embed Text', 'Default open embedder; 768-dim'),
  ('embeddinggemma', 768, 'ollama', 'embeddinggemma', 'EmbeddingGemma 300M', 'Google Gemma embedding; 768-dim drop-in'),
  ('mxbai-embed-large', 1024, 'ollama', 'mxbai-embed-large', 'MxBAI Embed Large', 'Stronger retrieval; 1024-dim'),
  ('bge-m3', 1024, 'ollama', 'bge-m3', 'BGE-M3', 'Multilingual dense; 1024-dim')
ON CONFLICT (embedder_id) DO NOTHING;

INSERT INTO reranker_catalog (reranker_id, backend, endpoint, model_tag, display_name, notes, enabled) VALUES
  ('off', 'none', NULL, NULL, 'Off', 'No reranking; use RRF order only', true),
  (
    'tei_bge',
    'tei',
    'http://reranker-bge:8095',
    'newtechstudio/bge-reranker-v2-m3-onnx',
    'BGE Reranker v2 M3 (TEI)',
    'Not deployed in default compose (ColBERT-only stack)',
    false
  ),
  (
    'tei_jina',
    'tei',
    'http://reranker-jina:8096',
    'BAAI/bge-reranker-base',
    'BGE Reranker base (TEI)',
    'Not deployed in default compose (ColBERT-only stack)',
    false
  ),
  (
    'colbert_gte_modern',
    'tei',
    'http://reranker-colbert:8097',
    'lightonai/GTE-ModernColBERT-v1',
    'ColBERT (GTE Modern v1)',
    'Default late-interaction reranker for tool-capable agents',
    true
  ),
  (
    'colbert_jina_v2',
    'tei',
    'http://reranker-colbert:8097',
    'jinaai/jina-colbert-v2',
    'ColBERT (Jina v2 multilingual)',
    'Set COLBERT_MODEL on reranker-colbert to switch',
    true
  ),
  ('ollama_mxbai_rerank', 'ollama', NULL, 'mxbai-rerank-large-v2', 'MxBAI LLM Rerank', 'LLM-as-reranker on Ollama', true),
  ('ollama_qwen3_rerank', 'ollama', NULL, 'qwen3-reranker:0.6b', 'Qwen3 Reranker 0.6B', 'LLM-as-reranker on Ollama', true)
ON CONFLICT (reranker_id) DO NOTHING;

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

-- Phase 2A: register ColBERT-as-reranker entries in the catalog.
-- The HTTP wire shape is TEI-compatible (apps/reranker-colbert exposes
-- POST /rerank returning [{index, score}, ...]) so backend='tei' lets
-- apps/model-router/router/rerank.py _rerank_tei consume it without changes.
--
-- Run once on existing databases. New databases pick up these rows via the
-- updated 030_retrieval_v2.sql bootstrap (same INSERT list).

INSERT INTO reranker_catalog (reranker_id, backend, endpoint, model_tag, display_name, notes) VALUES
  (
    'colbert_gte_modern',
    'tei',
    'http://reranker-colbert:8097',
    'lightonai/GTE-ModernColBERT-v1',
    'ColBERT (GTE Modern v1)',
    'Late-interaction reranker; smaller/faster on CPU. Default model for reranker-colbert.'
  ),
  (
    'colbert_jina_v2',
    'tei',
    'http://reranker-colbert:8097',
    'jinaai/jina-colbert-v2',
    'ColBERT (Jina v2 multilingual)',
    'Late-interaction reranker; multilingual MIT-licensed; flip via COLBERT_MODEL env on reranker-colbert.'
  )
ON CONFLICT (reranker_id) DO NOTHING;

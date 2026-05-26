import { describe, expect, it } from 'vitest';

import {
  EMBEDDER_CATALOG_IDS,
  getEmbedderCatalogEntry,
  getRerankerCatalogEntry,
  RERANKER_CATALOG_IDS,
} from './retrievalCatalog';

describe('retrievalCatalog', () => {
  it('has non-empty catalog entries for every embedder ID', () => {
    for (const id of EMBEDDER_CATALOG_IDS) {
      const entry = getEmbedderCatalogEntry(id);
      expect(entry, `missing embedder catalog for ${id}`).not.toBeNull();
      expect(entry!.summary.length).toBeGreaterThan(0);
      expect(entry!.strengths.length).toBeGreaterThanOrEqual(3);
      expect(entry!.weaknesses.length).toBeGreaterThanOrEqual(3);
    }
  });

  it('has non-empty catalog entries for every reranker ID', () => {
    for (const id of RERANKER_CATALOG_IDS) {
      const entry = getRerankerCatalogEntry(id);
      expect(entry, `missing reranker catalog for ${id}`).not.toBeNull();
      expect(entry!.summary.length).toBeGreaterThan(0);
      expect(entry!.strengths.length).toBeGreaterThanOrEqual(3);
      expect(entry!.weaknesses.length).toBeGreaterThanOrEqual(3);
    }
  });

  it('returns null for unknown IDs', () => {
    expect(getEmbedderCatalogEntry('unknown-embedder')).toBeNull();
    expect(getRerankerCatalogEntry('unknown-reranker')).toBeNull();
  });
});

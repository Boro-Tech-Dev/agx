import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import type { ToolCatalogId } from '../toolCatalog';
import { allHowItsMadeDocs, collectSourceRefPaths, TOOL_CATALOG_IDS } from './registry';

const REPO_ROOT = join(__dirname, '../../../..');

const EXPECTED_LLM_TOOLS: ToolCatalogId[] = [
  'ask_clarifier',
  'reply_coach',
  'brief_generator',
  'learning',
];

describe('howItsMade registry', () => {
  it('has a doc for every ToolCatalogId', () => {
    const docs = allHowItsMadeDocs();
    expect(docs).toHaveLength(TOOL_CATALOG_IDS.length);
    const ids = new Set(docs.map((d) => d.toolId));
    for (const id of TOOL_CATALOG_IDS) {
      expect(ids.has(id)).toBe(true);
    }
  });

  it('LLM tools set usesLlm true', () => {
    for (const doc of allHowItsMadeDocs()) {
      const expectsLlm = EXPECTED_LLM_TOOLS.includes(doc.toolId);
      expect(doc.ai.usesLlm, doc.toolId).toBe(expectsLlm);
    }
  });

  it('every source ref path exists under repo root', () => {
    const missing: string[] = [];
    for (const rel of collectSourceRefPaths()) {
      const abs = join(REPO_ROOT, rel);
      if (!existsSync(abs)) missing.push(rel);
    }
    expect(missing, `Missing source refs:\n${missing.join('\n')}`).toEqual([]);
  });

  it('each doc has at least one section and architecture summary', () => {
    for (const doc of allHowItsMadeDocs()) {
      expect(doc.sections.length).toBeGreaterThan(0);
      expect(doc.architectureSummary.length).toBeGreaterThan(10);
      expect(doc.lastVerifiedFromCode).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });
});

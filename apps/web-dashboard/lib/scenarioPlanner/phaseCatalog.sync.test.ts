import { readFileSync } from 'fs';
import { resolve } from 'path';
import { describe, expect, it } from 'vitest';

import { PHASE_CATALOG } from './phaseCatalog';

describe('phaseCatalog vs Python PHASE_ROWS', () => {
  it('phase_id order matches timeline_phase_catalog.py', () => {
    const pyPath = resolve(process.cwd(), '../ingestion-worker/ingestion/timeline_phase_catalog.py');
    const text = readFileSync(pyPath, 'utf8');
    const start = text.indexOf('PHASE_ROWS: list[PhaseDef] = [');
    expect(start).toBeGreaterThan(-1);
    const slice = text.slice(start);
    const endIdx = slice.indexOf('\n]\n\n');
    expect(endIdx).toBeGreaterThan(-1);
    const block = slice.slice(0, endIdx);
    const ids = Array.from(block.matchAll(/'phase_id':\s*'([^']+)'/g), (m) => m[1]);
    expect(ids.length).toBe(PHASE_CATALOG.length);
    expect(ids).toEqual(PHASE_CATALOG.map((p) => p.phase_id));
  });
});

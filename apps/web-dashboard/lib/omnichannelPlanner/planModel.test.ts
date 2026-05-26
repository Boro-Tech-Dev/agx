import { describe, expect, it } from 'vitest';

import type { OmnichannelPlanRow } from './types';
import {
  createEmptyPlan,
  moveRow,
  normalizePlanOrders,
  parseUnknownPlan,
  scenarioTacticFromLibraryMetadata,
  timingProfileFromLibraryMetadata,
} from './planModel';

describe('planModel', () => {
  it('timingProfileFromLibraryMetadata prefers timing_profile over legacy scenario_tactic', () => {
    expect(timingProfileFromLibraryMetadata({ timing_profile: 'sem_seo', scenario_tactic: 'generic_tactic' })).toBe(
      'sem_seo',
    );
    expect(timingProfileFromLibraryMetadata({ scenario_tactic: 'website' })).toBe('website');
    expect(timingProfileFromLibraryMetadata({ scenario_tactic: 'bad' })).toBe(null);
    expect(timingProfileFromLibraryMetadata(null)).toBe(null);
  });

  it('scenarioTacticFromLibraryMetadata delegates to timing helper', () => {
    expect(scenarioTacticFromLibraryMetadata({ scenario_tactic: 'email' })).toBe('generic_tactic');
    expect(scenarioTacticFromLibraryMetadata({ timing_profile: 'display_standard' })).toBe('display_standard');
  });

  it('normalizePlanOrders reindexes', () => {
    const rows: OmnichannelPlanRow[] = [
      { id: 'a', order: 2, tactic_library_id: '00000000-0000-4000-8000-000000000001' },
      { id: 'b', order: 0, tactic_library_id: '00000000-0000-4000-8000-000000000002' },
    ];
    const out = normalizePlanOrders(rows);
    expect(out.map((r) => r.order)).toEqual([0, 1]);
    expect(out[0]!.id).toBe('b');
  });

  it('moveRow swaps adjacent', () => {
    const rows: OmnichannelPlanRow[] = [
      { id: 'a', order: 0, tactic_library_id: '00000000-0000-4000-8000-000000000001' },
      { id: 'b', order: 1, tactic_library_id: '00000000-0000-4000-8000-000000000002' },
    ];
    const down = moveRow(rows, 'a', 1);
    expect(down.map((r) => r.id)).toEqual(['b', 'a']);
    const up = moveRow(down, 'a', -1);
    expect(up.map((r) => r.id)).toEqual(['a', 'b']);
  });

  it('parseUnknownPlan validates project_key and UUID', () => {
    const raw = {
      version: 1,
      project_key: 'proj-a',
      rows: [
        {
          id: 'r1',
          order: 0,
          tactic_library_id: '00000000-0000-4000-8000-000000000099',
          timing_profile: 'website',
        },
      ],
    };
    const ok = parseUnknownPlan(raw, 'proj-a');
    expect(ok.ok).toBe(true);
    if (ok.ok) {
      expect(ok.plan.rows).toHaveLength(1);
      expect(ok.plan.rows[0]!.timing_profile).toBe('website');
    }
    const legacyAlias = parseUnknownPlan(
      {
        version: 1,
        project_key: 'proj-a',
        rows: [
          {
            id: 'r2',
            order: 0,
            tactic_library_id: '00000000-0000-4000-8000-000000000099',
            timing_profile: 'email',
          },
        ],
      },
      'proj-a',
    );
    expect(legacyAlias.ok).toBe(true);
    if (legacyAlias.ok) {
      expect(legacyAlias.plan.rows[0]!.timing_profile).toBe('generic_tactic');
    }
    const badProj = parseUnknownPlan(raw, 'other');
    expect(badProj.ok).toBe(false);
  });

  it('createEmptyPlan sets project_key', () => {
    expect(createEmptyPlan('x').project_key).toBe('x');
    expect(createEmptyPlan('x').rows).toEqual([]);
  });
});

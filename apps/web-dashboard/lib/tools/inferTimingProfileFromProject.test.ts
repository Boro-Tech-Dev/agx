import { describe, expect, it } from 'vitest';

import {
  inferClientFamilyForPlanner,
  timingProfileIdsForScenarioPlanner,
} from '../scenarioPlanner/timingProfiles';
import { inferTimingProfileFromProject } from './inferTimingProfileFromProject';

describe('inferTimingProfileFromProject', () => {
  it('returns resolved_timing_profile when present', () => {
    expect(
      inferTimingProfileFromProject({
        workspace_key: 'happyguy-1',
        client_key: 'happyguy',
        resolved_timing_profile: 'happyguy_submit_thursday',
      }),
    ).toBe('happyguy_submit_thursday');
  });

  it('falls back to timing_profile_id on row', () => {
    expect(
      inferTimingProfileFromProject({
        timing_profile_id: 'generic_tactic',
      }),
    ).toBe('generic_tactic');
  });

  it('returns null when no profile fields', () => {
    expect(inferTimingProfileFromProject({ workspace_key: 'other' })).toBeNull();
  });
});

describe('inferClientFamilyForPlanner', () => {
  it('infers happyguy from profile client_family', () => {
    expect(inferClientFamilyForPlanner(null, 'happyguy_submit_thursday')).toBe('happyguy');
  });

  it('infers skillarts from tiered profile', () => {
    expect(inferClientFamilyForPlanner(null, 'skillarts_generic')).toBe('skillarts');
  });

  it('infers schematic from generic_tactic', () => {
    expect(inferClientFamilyForPlanner(null, 'generic_tactic')).toBe('schematic');
  });

  it('returns null without profile hint', () => {
    expect(inferClientFamilyForPlanner({ workspace_key: 'other', client_key: 'x' })).toBeNull();
  });
});

describe('timingProfileIdsForScenarioPlanner', () => {
  const happyCtx = { workspace_key: 'happyguy-1', client_key: 'happyguy' };

  it('filters to happyguy profiles when family resolved from profile', () => {
    const ids = timingProfileIdsForScenarioPlanner(happyCtx, 'happyguy_submit_thursday');
    expect(ids.length).toBeGreaterThan(0);
    expect(ids).toContain('happyguy_submit_thursday');
    for (const id of ids) {
      expect(id.startsWith('happyguy_') || id === 'happyguy_submit_thursday').toBeTruthy();
    }
  });

  it('returns skillarts tiered profiles', () => {
    const ids = timingProfileIdsForScenarioPlanner(
      { workspace_key: 'skillarts-1', client_key: 'skillarts' },
      'skillarts_generic',
    );
    expect(ids).toEqual(['skillarts_generic']);
  });

  it('returns schematic family profiles', () => {
    const ids = timingProfileIdsForScenarioPlanner(
      { workspace_key: 'argon-1', client_key: 'schematic-1' },
      'generic_tactic',
    );
    expect(ids).toContain('generic_tactic');
    expect(ids).toContain('generic_tactic_linear');
  });

  it('returns full catalog when family unknown', () => {
    const ids = timingProfileIdsForScenarioPlanner({ workspace_key: 'noop' });
    expect(ids.length).toBeGreaterThan(20);
  });
});

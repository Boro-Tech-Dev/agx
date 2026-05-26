import { describe, expect, it } from 'vitest';

import {
  resolveTimingProfileFromProjectTacticRow,
  resolveTimingProfileFromTacticLibraryRow,
  timingProfileFromCatalogTacticKey,
} from './resolveTimingProfileFromTacticRow';

describe('resolveTimingProfileFromTacticLibraryRow', () => {
  it('uses metadata.timing_profile when present', () => {
    expect(
      resolveTimingProfileFromTacticLibraryRow(
        { key: 'hcp_email', metadata: { timing_profile: 'happyguy_submit_thursday' } },
        { workspace_key: 'argon-1', client_key: 'schematic-1' },
      ),
    ).toBe('happyguy_submit_thursday');
  });

  it('falls back to catalog timing_profile by tactic key', () => {
    expect(resolveTimingProfileFromTacticLibraryRow({ key: 'hcp_email', metadata: {} }, null)).toBe('generic_tactic');
  });

  it('infers from project when metadata and catalog miss', () => {
    expect(
      resolveTimingProfileFromTacticLibraryRow({ key: 'unknown_xyz_no_catalog', metadata: {} }, {
        workspace_key: 'happyguy-1',
        client_key: 'happyguy',
      }),
    ).toBe('happyguy_submit_thursday');
  });

  it('returns null when nothing resolves', () => {
    expect(
      resolveTimingProfileFromTacticLibraryRow({ key: 'unknown_xyz_no_catalog', metadata: {} }, {
        workspace_key: 'dood-1',
        client_key: 'data',
      }),
    ).toBeNull();
  });

  it('with no row, infers from project only', () => {
    expect(resolveTimingProfileFromTacticLibraryRow(null, { client_key: 'skillarts' })).toBe('skillarts_generic');
  });
});

describe('resolveTimingProfileFromProjectTacticRow', () => {
  it('reads timing_profile from tactic_metadata', () => {
    expect(
      resolveTimingProfileFromProjectTacticRow(
        { tactic_metadata: { timing_profile: 'generic_tactic_linear' }, tactic_key: 'dtc_email' },
        null,
      ),
    ).toBe('generic_tactic_linear');
  });

  it('merges legacy top-level scenario_tactic into metadata read', () => {
    expect(
      resolveTimingProfileFromProjectTacticRow(
        { tactic_metadata: {}, scenario_tactic: 'happyguy_submit_thursday', tactic_key: 'x' },
        null,
      ),
    ).toBe('happyguy_submit_thursday');
  });

  it('uses catalog key when metadata empty', () => {
    expect(resolveTimingProfileFromProjectTacticRow({ tactic_key: 'paid_search_sem', tactic_metadata: {} }, null)).toBe(
      'sem_seo',
    );
  });
});

describe('timingProfileFromCatalogTacticKey', () => {
  it('returns known profile for happyguy catalog entry', () => {
    expect(timingProfileFromCatalogTacticKey('happyguy_tactic_1')).toBe('happyguy_submit_thursday');
  });

  it('returns HappyGuy calibrated timing profiles by tactic key', () => {
    expect(timingProfileFromCatalogTacticKey('happyguy_mad_healthgrades_360_email')).toBe(
      'happyguy_mad_healthgrades_360_email',
    );
    expect(timingProfileFromCatalogTacticKey('happyguy_mad_patient_profiles_tll')).toBe(
      'happyguy_mad_patient_profiles_tll',
    );
    expect(timingProfileFromCatalogTacticKey('happyguy_mad_liver_brochure_training_blueprint')).toBe(
      'happyguy_mad_liver_brochure_training_blueprint',
    );
  });
});

import { describe, expect, it } from 'vitest';

import { EMAIL_BASELINE, EMAIL_BASELINE_KICKOFF_ISO } from './emailBaseline';
import { PHASE_CATALOG } from './phaseCatalog';

describe('emailBaseline', () => {
  it('has one row per catalog phase in order', () => {
    expect(EMAIL_BASELINE.length).toBe(PHASE_CATALOG.length);
    for (let i = 0; i < EMAIL_BASELINE.length; i++) {
      expect(EMAIL_BASELINE[i]!.phase_id).toBe(PHASE_CATALOG[i]!.phase_id);
    }
  });

  it('kickoff constant matches first row', () => {
    expect(EMAIL_BASELINE[0]!.start_date).toBe(EMAIL_BASELINE_KICKOFF_ISO);
  });
});

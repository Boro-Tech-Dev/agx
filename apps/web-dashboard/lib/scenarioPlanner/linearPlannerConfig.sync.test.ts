import { describe, expect, it } from 'vitest';

import { PHASE_CATALOG } from './phaseCatalog';
import { happyGuyMlrSpineWeekday } from './timingProfiles';
import { getScenarioStepsOrdered, STEPS_CONFIG } from './linear/loadPlannerConfig';

function assertSpineMatchesCatalog(
  steps: ReturnType<typeof getScenarioStepsOrdered>,
  catalog: typeof PHASE_CATALOG = PHASE_CATALOG,
) {
  expect(steps.length).toBe(catalog.length);
  for (let i = 0; i < catalog.length; i++) {
    expect(steps[i]!.id).toBe(catalog[i]!.phase_id);
    expect(steps[i]!.label).toBe(catalog[i]!.label);
  }
}

describe('scenario planner config vs phase catalog', () => {
  it('steps.json order and ids match PHASE_CATALOG', () => {
    const steps = getScenarioStepsOrdered();
    expect(steps.length).toBe(PHASE_CATALOG.length);
    for (let i = 0; i < PHASE_CATALOG.length; i++) {
      expect(steps[i]!.id).toBe(PHASE_CATALOG[i]!.phase_id);
      expect(steps[i]!.label).toBe(PHASE_CATALOG[i]!.label);
    }
  });

  it('steps.json version is 1', () => {
    expect(STEPS_CONFIG.version).toBe(1);
  });

  it('HappyGuy MLR spines match PHASE_CATALOG order and labels', () => {
    const happyGuyOmitted = new Set(['development_prb1', 'development_prb2', 'development_prb3']);
    const filtered = PHASE_CATALOG.filter((r) => !happyGuyOmitted.has(r.phase_id));
    assertSpineMatchesCatalog(getScenarioStepsOrdered('happyguy_submit_thursday'), filtered);
    assertSpineMatchesCatalog(getScenarioStepsOrdered('happyguy_submit_tuesday'), filtered);
    assertSpineMatchesCatalog(getScenarioStepsOrdered('happyguy_mad_healthgrades_360_email'), filtered);
    assertSpineMatchesCatalog(getScenarioStepsOrdered('happyguy_mad_patient_profiles_tll'), filtered);
    assertSpineMatchesCatalog(getScenarioStepsOrdered('happyguy_mad_liver_brochure_training_blueprint'), filtered);
  });

  it('HappyGuy Thursday spine embeds milestone notes on key phases', () => {
    const steps = getScenarioStepsOrdered('happyguy_submit_thursday');
    const route = steps.find((s) => s.id === 'route_to_clean');
    expect(route?.note).toContain('HappyGuy Submit Thursday');
    expect(route?.note).toContain('Thursday prior');
    const defaultRoute = STEPS_CONFIG.steps.find((s) => s.id === 'route_to_clean');
    expect(route?.baseline_days).toBe(defaultRoute?.baseline_days);
  });

  it('happyGuyMlrSpineWeekday reads happyguy_spine and submit_anchor_weekday', () => {
    expect(happyGuyMlrSpineWeekday('happyguy_submit_tuesday')).toBe('tuesday');
    expect(happyGuyMlrSpineWeekday('happyguy_submit_thursday')).toBe('thursday');
    expect(happyGuyMlrSpineWeekday('happyguy_mad_healthgrades_360_email')).toBe('thursday');
    expect(happyGuyMlrSpineWeekday('generic_tactic')).toBe('thursday');
  });
});

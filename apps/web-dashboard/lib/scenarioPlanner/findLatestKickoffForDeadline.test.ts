import { describe, expect, it } from 'vitest';

import { computeScenarioSteps } from './computeScenarioSteps';
import { findLatestKickoffForDeadline } from './findLatestKickoffForDeadline';
import { PHASE_CATALOG } from './phaseCatalog';

const ALL_CALENDAR = Object.fromEntries(PHASE_CATALOG.map((p) => [p.phase_id, true] as const));

describe('findLatestKickoffForDeadline', () => {
  it('recovers kickoff when deadline equals milestone end for a known forward generic tactic plan', () => {
    const anchor = '2026-04-01';
    const forward = computeScenarioSteps({
      tactic: 'generic_tactic',
      anchorStartIso: anchor,
      phaseAllowNonWorkingDays: ALL_CALENDAR,
    });
    expect(forward.ok).toBe(true);
    if (!forward.ok) return;
    const lastIdx = forward.breakdown.length - 1;
    const milestoneId = forward.breakdown[lastIdx]!.phase_id;
    const deadline = forward.steps[lastIdx]!.end_date;

    const rev = findLatestKickoffForDeadline({
      tactic: 'generic_tactic',
      deadlineIso: deadline,
      anchorPhaseId: milestoneId,
      phaseAllowNonWorkingDays: ALL_CALENDAR,
    });
    expect(rev.ok).toBe(true);
    if (!rev.ok) return;
    expect(rev.kickoffIso).toBe(anchor);
    expect(rev.steps[lastIdx]!.end_date).toBe(deadline);
    expect(rev.breakdown.length).toBe(rev.steps.length);
  });

  it('rejects invalid deadline', () => {
    const r = findLatestKickoffForDeadline({
      tactic: 'generic_tactic',
      deadlineIso: 'nope',
      anchorPhaseId: 'release_assets_vendors',
    });
    expect(r.ok).toBe(false);
    if (r.ok === true) return;
    expect(r.error).toMatch(/Deadline/);
  });

  it('rejects unknown milestone phase', () => {
    const r = findLatestKickoffForDeadline({
      tactic: 'generic_tactic',
      deadlineIso: '2026-12-31',
      anchorPhaseId: 'not_a_phase',
    });
    expect(r.ok).toBe(false);
  });

  it('rejects milestone not included for selected complexity', () => {
    const r = findLatestKickoffForDeadline({
      tactic: 'generic_tactic',
      deadlineIso: '2026-12-31',
      anchorPhaseId: 'submit_prb3',
      complexity: 'basic',
      holidays: new Set(),
    });
    expect(r.ok).toBe(false);
    if (r.ok === true) return;
    expect(r.error).toMatch(/not in the schedule|PRB round/i);
  });

  it('fails when deadline is too aggressive for a narrow kickoff window', () => {
    const r = findLatestKickoffForDeadline({
      tactic: 'website',
      deadlineIso: '2026-06-30',
      anchorPhaseId: 'release_assets_vendors',
      searchWindowDays: 2,
    });
    expect(r.ok).toBe(false);
    if (r.ok === true) return;
    expect(r.error).toMatch(/too aggressive|deadline/i);
  });

  it('recovers kickoff for working-day forward plan', () => {
    const anchor = '2026-03-02';
    const hol = new Set<string>();
    const forward = computeScenarioSteps({
      tactic: 'website',
      anchorStartIso: anchor,
      holidays: hol,
    });
    expect(forward.ok).toBe(true);
    if (!forward.ok) return;
    const lastIdx = forward.breakdown.length - 1;
    const milestoneId = forward.breakdown[lastIdx]!.phase_id;
    const deadline = forward.steps[lastIdx]!.end_date;

    const rev = findLatestKickoffForDeadline({
      tactic: 'website',
      deadlineIso: deadline,
      anchorPhaseId: milestoneId,
      holidays: hol,
    });
    expect(rev.ok).toBe(true);
    if (!rev.ok) return;
    expect(rev.kickoffIso).toBe(anchor);
    expect(rev.steps[lastIdx]!.end_date).toBe(deadline);
    expect(rev.breakdown.length).toBe(rev.steps.length);
  });
});

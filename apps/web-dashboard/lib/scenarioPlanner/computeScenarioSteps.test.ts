import { describe, expect, it } from 'vitest';

import { filterScenarioStepsForPrbRounds, prbRoundsForComplexity } from './complexity';
import { addCalendarDaysUTC, inclusiveCalendarDaySpan } from './dateCalendar';
import { computeScenarioSteps } from './computeScenarioSteps';
import { PHASE_CATALOG } from './phaseCatalog';
import type { ScenarioTactic } from './tactics';
import { inclusiveWorkingDaySpan, nextWorkingDay } from './workingDays';
import { getScenarioStepsOrdered } from './linear/loadPlannerConfig';
import type { LinearStepBreakdown } from './linear/types';
import {
  firstWorkingThursdayOnOrAfter,
  firstWorkingTuesdayOnOrAfter,
  maxIsoDate,
  neutralShiftedSubmitStartFromKickoff,
  pickHappyGuySubmitAnchorWeekday,
  resolvePrbAnchorDay,
  type PrbBrandConfig,
} from './prbWeekdayAnchors';

const EMAIL_PRB_BRAND_FROM_SHIFTED: PrbBrandConfig = { mode: 'from_shifted_baseline' };

const ALL_CALENDAR = Object.fromEntries(PHASE_CATALOG.map((p) => [p.phase_id, true] as const));

function idxPhase(breakdown: LinearStepBreakdown[], phaseId: string): number {
  const i = breakdown.findIndex((b) => b.phase_id === phaseId);
  if (i < 0) throw new Error(`missing phase ${phaseId} in breakdown`);
  return i;
}

/** UTC weekday (0 Sun … 4 Thu). Planner dates are YYYY-MM-DD in UTC. */
function utcWeekdaySun0(iso: string): number {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, (m ?? 1) - 1, d ?? 1)).getUTCDay();
}

describe('computeScenarioSteps (linear planner)', () => {
  it('generic tactic (HCP MLR) clamps PRB submit to Monday and review to second working Wednesday (baseline kickoff)', () => {
    const r = computeScenarioSteps({
      tactic: 'generic_tactic',
      anchorStartIso: '2026-03-02',
      holidays: new Set(),
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const iSubmit = idxPhase(r.breakdown, 'submit_prb1');
    const iRev = idxPhase(r.breakdown, 'prb1_review');
    expect(r.steps[iSubmit]!.start_date).toBe('2026-04-06');
    expect(r.steps[iRev]!.start_date).toBe('2026-04-15');
  });

  it('SkillArts tiered (RTE spine): PRB1 submit on a working Thursday; 30+ pages → 10 inclusive WD submit→review', () => {
    const r = computeScenarioSteps({
      tactic: 'skillarts_generic',
      anchorStartIso: '2026-03-02',
      holidays: new Set(),
      pageCount: 30,
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const iSubmit = idxPhase(r.breakdown, 'submit_prb1');
    const iRev = idxPhase(r.breakdown, 'prb1_review');
    expect(utcWeekdaySun0(r.steps[iSubmit]!.start_date)).toBe(4);
    expect(inclusiveWorkingDaySpan(r.steps[iSubmit]!.start_date, r.steps[iRev]!.start_date, new Set())).toBe(10);
  });

  it('SkillArts tiered: pageCount 14 uses 3 inclusive working days submit start → review start', () => {
    const r = computeScenarioSteps({
      tactic: 'skillarts_generic',
      anchorStartIso: '2026-03-02',
      holidays: new Set(),
      pageCount: 14,
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const iSubmit = idxPhase(r.breakdown, 'submit_prb1');
    const iRev = idxPhase(r.breakdown, 'prb1_review');
    expect(inclusiveWorkingDaySpan(r.steps[iSubmit]!.start_date, r.steps[iRev]!.start_date, new Set())).toBe(3);
  });

  it('SkillArts tiered: pageCount 20 uses 5 inclusive working days (15–29 band)', () => {
    const r = computeScenarioSteps({
      tactic: 'skillarts_generic',
      anchorStartIso: '2026-03-02',
      holidays: new Set(),
      pageCount: 20,
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const iSubmit = idxPhase(r.breakdown, 'submit_prb1');
    const iRev = idxPhase(r.breakdown, 'prb1_review');
    expect(inclusiveWorkingDaySpan(r.steps[iSubmit]!.start_date, r.steps[iRev]!.start_date, new Set())).toBe(5);
  });

  it('SkillArts tiered (RTE spine): holiday on resolved submit Thursday moves PRB1 submit to the next working Thursday', () => {
    const base = computeScenarioSteps({
      tactic: 'skillarts_generic',
      anchorStartIso: '2026-03-02',
      holidays: new Set(),
      pageCount: 30,
    });
    expect(base.ok).toBe(true);
    if (!base.ok) return;
    const iSubmit = idxPhase(base.breakdown, 'submit_prb1');
    const submitIso = base.steps[iSubmit]!.start_date;

    const hol = new Set([submitIso]);
    const r = computeScenarioSteps({
      tactic: 'skillarts_generic',
      anchorStartIso: '2026-03-02',
      holidays: hol,
      pageCount: 30,
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.steps[iSubmit]!.start_date).not.toBe(submitIso);
    expect(utcWeekdaySun0(r.steps[iSubmit]!.start_date)).toBe(4);
    const iRev = idxPhase(r.breakdown, 'prb1_review');
    expect(inclusiveWorkingDaySpan(r.steps[iSubmit]!.start_date, r.steps[iRev]!.start_date, hol)).toBe(10);
  });

  it('generic tactic (HCP MLR) places Development between PRB submit Monday and anchored review Wednesday', () => {
    const r = computeScenarioSteps({
      tactic: 'generic_tactic',
      anchorStartIso: '2026-03-02',
      holidays: new Set(),
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const iDev1 = idxPhase(r.breakdown, 'development_prb1');
    const iDev2 = idxPhase(r.breakdown, 'development_prb2');
    const iSubmit1 = idxPhase(r.breakdown, 'submit_prb1');
    const iRev1 = idxPhase(r.breakdown, 'prb1_review');
    const iSubmit2 = idxPhase(r.breakdown, 'submit_prb2');
    const iRev2 = idxPhase(r.breakdown, 'prb2_review');
    expect(r.steps[iDev1]!.start_date > r.steps[iSubmit1]!.end_date).toBe(true);
    expect(r.steps[iDev1]!.end_date < r.steps[iRev1]!.start_date).toBe(true);
    expect(r.steps[iDev2]!.start_date > r.steps[iSubmit2]!.end_date).toBe(true);
    expect(r.steps[iDev2]!.end_date < r.steps[iRev2]!.start_date).toBe(true);
    expect(inclusiveWorkingDaySpan(r.steps[iDev1]!.start_date, r.steps[iDev1]!.end_date, new Set())).toBe(
      r.breakdown[iDev1]!.effective_days,
    );
  });

  it('generic_tactic_linear profile uses sequential PRB spans (not Monday/Wednesday MLR cadence)', () => {
    const emailR = computeScenarioSteps({
      tactic: 'generic_tactic',
      anchorStartIso: '2026-03-02',
      holidays: new Set(),
    });
    const linearR = computeScenarioSteps({
      tactic: 'generic_tactic_linear',
      anchorStartIso: '2026-03-02',
      holidays: new Set(),
    });
    expect(emailR.ok && linearR.ok).toBe(true);
    if (!emailR.ok || !linearR.ok) return;
    const iSubmit = idxPhase(emailR.breakdown, 'submit_prb1');
    expect(linearR.steps[iSubmit]!.start_date).not.toBe(emailR.steps[iSubmit]!.start_date);
  });

  it('suffix recompute: preserves pinned prefix and shifts following steps', () => {
    const base = computeScenarioSteps({
      tactic: 'generic_tactic',
      anchorStartIso: '2026-03-02',
      holidays: new Set(),
    });
    expect(base.ok).toBe(true);
    if (!base.ok) return;
    const idx = Math.min(8, base.steps.length - 3);
    const prefix = base.steps.slice(0, idx + 1).map((s) => ({ ...s }));
    prefix[idx] = { ...prefix[idx]!, end_date: addCalendarDaysUTC(prefix[idx]!.end_date, 3) };
    const r = computeScenarioSteps({
      tactic: 'generic_tactic',
      anchorStartIso: '2026-03-02',
      holidays: new Set(),
      freezeAfterStepIndex: idx,
      pinnedPrefixSteps: prefix,
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    for (let i = 0; i <= idx; i++) {
      expect(r.steps[i]).toEqual(prefix[i]);
    }
    expect(r.steps[idx + 1]!.start_date).not.toBe(base.steps[idx + 1]!.start_date);
  });

  it('returns breakdown aligned with steps', () => {
    const r = computeScenarioSteps({
      tactic: 'generic_tactic',
      anchorStartIso: '2026-03-02',
      holidays: new Set(),
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const ordered = filterScenarioStepsForPrbRounds(
      getScenarioStepsOrdered(),
      prbRoundsForComplexity('medium'),
    );
    expect(r.steps.length).toBe(ordered.length);
    expect(r.breakdown.length).toBe(ordered.length);
    for (let i = 0; i < ordered.length; i++) {
      expect(r.breakdown[i]!.phase_id).toBe(ordered[i]!.id);
      expect(r.breakdown[i]!.baseline_days).toBe(ordered[i]!.baseline_days);
    }
  });

  it('generic tactic + all calendar uses inclusive calendar spans per phase', () => {
    const r = computeScenarioSteps({
      tactic: 'generic_tactic',
      anchorStartIso: '2026-03-02',
      phaseAllowNonWorkingDays: ALL_CALENDAR,
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.steps[0]!.start_date).toBe('2026-03-02');
    expect(r.steps[0]!.allow_non_working_days).toBe(true);
    const idx = idxPhase(r.breakdown, 'manuscript_development');
    expect(inclusiveCalendarDaySpan(r.steps[idx]!.start_date, r.steps[idx]!.end_date)).toBe(
      r.breakdown[idx]!.effective_days,
    );
  });

  it('website tactic lengthens manuscript vs generic tactic (all calendar)', () => {
    const emailR = computeScenarioSteps({
      tactic: 'generic_tactic',
      anchorStartIso: '2026-03-02',
      phaseAllowNonWorkingDays: ALL_CALENDAR,
    });
    const webR = computeScenarioSteps({
      tactic: 'website',
      anchorStartIso: '2026-03-02',
      phaseAllowNonWorkingDays: ALL_CALENDAR,
    });
    expect(emailR.ok && webR.ok).toBe(true);
    if (!emailR.ok || !webR.ok) return;
    const idx = idxPhase(webR.breakdown, 'manuscript_development');
    expect(webR.breakdown[idx]!.scaled_days).toBeGreaterThan(emailR.breakdown[idx]!.scaled_days);
    expect(webR.steps[idx]!.end_date >= webR.steps[idx]!.start_date).toBe(true);
  });

  it('working-day mode skips weekends for sequential phases', () => {
    const hol = new Set<string>();
    const r = computeScenarioSteps({
      tactic: 'banner',
      anchorStartIso: '2026-01-10',
      holidays: hol,
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.steps[0]!.start_date).toBe('2026-01-12');
  });

  it('per-phase allow non-working uses calendar for that phase only', () => {
    const hol = new Set<string>();
    const r = computeScenarioSteps({
      tactic: 'banner',
      anchorStartIso: '2026-01-05',
      holidays: hol,
      phaseAllowNonWorkingDays: { kickoff: true },
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.steps[0]!.start_date).toBe('2026-01-05');
    expect(r.steps[0]!.allow_non_working_days).toBe(true);
    expect(r.steps[1]!.allow_non_working_days).toBeUndefined();
  });

  it('rejects invalid anchor', () => {
    const r = computeScenarioSteps({
      tactic: 'generic_tactic',
      anchorStartIso: 'not-a-date',
    });
    expect(r.ok).toBe(false);
  });

  it('each step end is on or after start', () => {
    const r = computeScenarioSteps({ tactic: 'banner', anchorStartIso: '2026-01-05' });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    for (const s of r.steps) {
      expect(s.end_date >= s.start_date).toBe(true);
    }
  });

  it('complexity scales non-PRB spans; PRB working-day spans stay baseline', () => {
    const hol = new Set<string>();
    const idx = (bd: LinearStepBreakdown[], pid: string) => idxPhase(bd, pid);
    const basic = computeScenarioSteps({
      tactic: 'website',
      anchorStartIso: '2026-03-02',
      holidays: hol,
      complexity: 'basic',
    });
    const complex = computeScenarioSteps({
      tactic: 'website',
      anchorStartIso: '2026-03-02',
      holidays: hol,
      complexity: 'complex',
    });
    expect(basic.ok && complex.ok).toBe(true);
    if (!basic.ok || !complex.ok) return;
    const midMs = idx(complex.breakdown, 'manuscript_development');
    const midMb = idx(basic.breakdown, 'manuscript_development');
    expect(
      inclusiveWorkingDaySpan(complex.steps[midMs]!.start_date, complex.steps[midMs]!.end_date, hol),
    ).toBeGreaterThan(
      inclusiveWorkingDaySpan(basic.steps[midMb]!.start_date, basic.steps[midMb]!.end_date, hol),
    );
    const prbAnchors = [
      'submit_prb1',
      'prb1_review',
      'submit_prb2',
      'prb2_review',
      'submit_prb3',
      'prb3_review',
    ] as const;
    for (const pid of prbAnchors) {
      const ib = basic.breakdown.findIndex((b) => b.phase_id === pid);
      const ic = complex.breakdown.findIndex((b) => b.phase_id === pid);
      if (ib < 0 || ic < 0) continue;
      expect(complex.breakdown[ic]!.effective_days).toBe(basic.breakdown[ib]!.effective_days);
      expect(
        inclusiveWorkingDaySpan(complex.steps[ic]!.start_date, complex.steps[ic]!.end_date, hol),
      ).toBe(inclusiveWorkingDaySpan(basic.steps[ib]!.start_date, basic.steps[ib]!.end_date, hol));
    }
  });

  it('basic complexity fixes manuscript, initial edit/fact check, fact check, and route-to-clean spans', () => {
    const r = computeScenarioSteps({
      tactic: 'website',
      anchorStartIso: '2026-03-02',
      holidays: new Set(),
      complexity: 'basic',
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.breakdown[idxPhase(r.breakdown, 'manuscript_development')]!.effective_days).toBe(2);
    expect(r.breakdown[idxPhase(r.breakdown, 'complete_initial_edit_start_fact_check')]!.effective_days).toBe(
      1,
    );
    expect(r.breakdown[idxPhase(r.breakdown, 'complete_fact_check')]!.effective_days).toBe(1);
    expect(r.breakdown[idxPhase(r.breakdown, 'route_to_clean')]!.effective_days).toBe(1);
  });

  it('basic complexity omits PRB2 and PRB3 blocks; complex includes PRB3', () => {
    const basic = computeScenarioSteps({
      tactic: 'generic_tactic',
      anchorStartIso: '2026-03-02',
      holidays: new Set(),
      complexity: 'basic',
    });
    const complex = computeScenarioSteps({
      tactic: 'generic_tactic',
      anchorStartIso: '2026-03-02',
      holidays: new Set(),
      complexity: 'complex',
    });
    expect(basic.ok && complex.ok).toBe(true);
    if (!basic.ok || !complex.ok) return;
    expect(basic.breakdown.some((b) => b.phase_id === 'submit_prb2')).toBe(false);
    expect(complex.breakdown.some((b) => b.phase_id === 'submit_prb3')).toBe(true);
    const i3s = idxPhase(complex.breakdown, 'submit_prb3');
    const i3r = idxPhase(complex.breakdown, 'prb3_review');
    expect(complex.steps[i3r]!.start_date > complex.steps[i3s]!.start_date).toBe(true);
  });

  it.each(['video_production', 'animation', 'tradeshow_panel'] as const satisfies readonly ScenarioTactic[])(
    'smoke: %s yields full catalog valid steps',
    (tactic) => {
      const r = computeScenarioSteps({ tactic, anchorStartIso: '2026-01-05' });
      expect(r.ok).toBe(true);
      if (!r.ok) return;
      const n = filterScenarioStepsForPrbRounds(
        getScenarioStepsOrdered(),
        prbRoundsForComplexity('medium'),
      ).length;
      expect(r.steps.length).toBe(n);
      for (const s of r.steps) {
        expect(s.end_date >= s.start_date).toBe(true);
      }
    },
  );

  it('stackable modifiers adjust effective days', () => {
    const r = computeScenarioSteps({
      tactic: 'generic_tactic',
      anchorStartIso: '2026-03-02',
      holidays: new Set(),
      activeModifierIds: ['expedited_manuscript', 'extra_client_buffer'],
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const mid = idxPhase(r.breakdown, 'manuscript_development');
    expect(r.breakdown[mid]!.modifier_deltas.expedited_manuscript).toBe(-2);
    const cr = idxPhase(r.breakdown, 'client_review_1_manuscript');
    expect(r.breakdown[cr]!.modifier_deltas.extra_client_buffer).toBe(1);
  });

  it('rejects unknown modifier id', () => {
    const r = computeScenarioSteps({
      tactic: 'generic_tactic',
      anchorStartIso: '2026-03-02',
      activeModifierIds: ['not_a_real_modifier'],
    });
    expect(r.ok).toBe(false);
  });

  it('HappyGuy week-aligned: PRB1 submit and review share weekday (proximity); includes OPDP binder track', () => {
    const r = computeScenarioSteps({
      timingProfile: 'happyguy_submit_thursday',
      anchorStartIso: '2026-03-02',
      holidays: new Set(),
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const iSubmit = idxPhase(r.breakdown, 'submit_prb1');
    const iRev = idxPhase(r.breakdown, 'prb1_review');
    expect(utcWeekdaySun0(r.steps[iSubmit]!.start_date)).toBe(utcWeekdaySun0(r.steps[iRev]!.start_date));
    expect(r.opdp_binder_steps?.length).toBe(7);
  });

  it('HappyGuy: happyguy_submit_tuesday and happyguy_submit_thursday profiles yield identical PRB1 dates (proximity only)', () => {
    const a = computeScenarioSteps({
      timingProfile: 'happyguy_submit_tuesday',
      anchorStartIso: '2026-03-02',
      holidays: new Set(),
    });
    const b = computeScenarioSteps({
      timingProfile: 'happyguy_submit_thursday',
      anchorStartIso: '2026-03-02',
      holidays: new Set(),
    });
    expect(a.ok && b.ok).toBe(true);
    if (!a.ok || !b.ok) return;
    const iS = idxPhase(a.breakdown, 'submit_prb1');
    const iR = idxPhase(a.breakdown, 'prb1_review');
    expect(a.steps[iS]).toEqual(b.steps[iS]);
    expect(a.steps[iR]).toEqual(b.steps[iR]);
  });

  it('HappyGuy: when submit+7 is a holiday on the submit-anchor weekday, review snaps forward on same weekday', () => {
    const base = computeScenarioSteps({
      timingProfile: 'happyguy_submit_tuesday',
      anchorStartIso: '2026-03-02',
      holidays: new Set(),
    });
    expect(base.ok).toBe(true);
    if (!base.ok) return;
    const iSubmit = idxPhase(base.breakdown, 'submit_prb1');
    const submitStart = base.steps[iSubmit]!.start_date;
    const idealReview = addCalendarDaysUTC(submitStart, 7);
    const r = computeScenarioSteps({
      timingProfile: 'happyguy_submit_tuesday',
      anchorStartIso: '2026-03-02',
      holidays: new Set([idealReview]),
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const iRev = idxPhase(r.breakdown, 'prb1_review');
    expect(utcWeekdaySun0(r.steps[iRev]!.start_date)).toBe(utcWeekdaySun0(submitStart));
    expect(r.steps[iRev]!.start_date >= idealReview).toBe(true);
  });

  it('HappyGuy pinned submit: prb1_review uses refIso anchor weekday not pin.start alone', () => {
    const hol = new Set<string>();
    const base = computeScenarioSteps({
      timingProfile: 'happyguy_submit_tuesday',
      anchorStartIso: '2026-03-02',
      holidays: hol,
    });
    expect(base.ok).toBe(true);
    if (!base.ok) return;
    const iSubmit = idxPhase(base.breakdown, 'submit_prb1');
    expect(pickHappyGuySubmitAnchorWeekday('2026-06-10', hol)).toBe('thursday');
    const prefix = base.steps.slice(0, iSubmit + 1).map((s) => ({ ...s }));
    prefix[iSubmit] = {
      ...prefix[iSubmit]!,
      start_date: '2026-06-10',
      end_date: '2026-06-10',
    };
    const prevEnd = prefix[iSubmit - 1]!.end_date;
    const minStart = nextWorkingDay(addCalendarDaysUTC(prevEnd, 1), hol);
    const refIso = maxIsoDate(
      minStart,
      neutralShiftedSubmitStartFromKickoff('2026-03-02', 'submit_prb1', EMAIL_PRB_BRAND_FROM_SHIFTED),
    );
    const anchorWd = pickHappyGuySubmitAnchorWeekday(refIso, hol);
    const r = computeScenarioSteps({
      timingProfile: 'happyguy_submit_tuesday',
      anchorStartIso: '2026-03-02',
      holidays: hol,
      freezeAfterStepIndex: iSubmit,
      pinnedPrefixSteps: prefix,
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const iRev = idxPhase(r.breakdown, 'prb1_review');
    const expectedWd = anchorWd === 'tuesday' ? 2 : 4;
    expect(utcWeekdaySun0(r.steps[iRev]!.start_date)).toBe(expectedWd);
  });

  it('HappyGuy PRB2 submit is proximity from cursor after preceding phase (no neutral merge)', () => {
    const hol = new Set<string>();
    const r = computeScenarioSteps({
      timingProfile: 'happyguy_submit_thursday',
      anchorStartIso: '2026-03-02',
      holidays: hol,
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const iSub2 = idxPhase(r.breakdown, 'submit_prb2');
    const prevEnd = r.steps[iSub2 - 1]!.end_date;
    const minStart = nextWorkingDay(addCalendarDaysUTC(prevEnd, 1), hol);
    const anchorWd = pickHappyGuySubmitAnchorWeekday(minStart, hol);
    const raw =
      anchorWd === 'tuesday'
        ? firstWorkingTuesdayOnOrAfter(minStart, hol)
        : firstWorkingThursdayOnOrAfter(minStart, hol);
    const resolved = resolvePrbAnchorDay(raw, hol, false);
    expect(r.steps[iSub2]!.start_date).toBe(resolved.iso);
  });

  it('HappyGuy: holiday on ideal review calendar day keeps review on submit weekday (forward snap)', () => {
    const base = computeScenarioSteps({
      timingProfile: 'happyguy_submit_thursday',
      anchorStartIso: '2026-03-02',
      holidays: new Set(),
    });
    expect(base.ok).toBe(true);
    if (!base.ok) return;
    const iSubmit = idxPhase(base.breakdown, 'submit_prb1');
    const submitStart = base.steps[iSubmit]!.start_date;
    const submitWd = utcWeekdaySun0(submitStart);
    const idealReview = addCalendarDaysUTC(submitStart, 7);
    const r = computeScenarioSteps({
      timingProfile: 'happyguy_submit_thursday',
      anchorStartIso: '2026-03-02',
      holidays: new Set([idealReview]),
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const iRev = idxPhase(r.breakdown, 'prb1_review');
    expect(utcWeekdaySun0(r.steps[iRev]!.start_date)).toBe(submitWd);
    expect(r.steps[iRev]!.start_date >= idealReview).toBe(true);
  });

  it('HappyGuy Wellscore email profile: PRB1 matches baseline HappyGuy Thursday; OPDP binder included', () => {
    const base = computeScenarioSteps({
      timingProfile: 'happyguy_submit_thursday',
      anchorStartIso: '2026-03-02',
      holidays: new Set(),
    });
    const mad = computeScenarioSteps({
      timingProfile: 'happyguy_mad_healthgrades_360_email',
      anchorStartIso: '2026-03-02',
      holidays: new Set(),
    });
    expect(base.ok && mad.ok).toBe(true);
    if (!base.ok || !mad.ok) return;
    const iS = idxPhase(base.breakdown, 'submit_prb1');
    const iR = idxPhase(base.breakdown, 'prb1_review');
    expect(mad.steps[iS]).toEqual(base.steps[iS]);
    expect(mad.steps[iR]).toEqual(base.steps[iR]);
    expect(mad.opdp_binder_steps?.length).toBe(7);
  });

  it('HappyGuy patient profiles TLL: no OPDP binder track', () => {
    const r = computeScenarioSteps({
      timingProfile: 'happyguy_mad_patient_profiles_tll',
      anchorStartIso: '2026-03-02',
      holidays: new Set(),
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.opdp_binder_steps).toBeUndefined();
  });

  it('HappyGuy Wellscore email prep_assets_release scaled_days exceeds Liver brochure profile', () => {
    const hg = computeScenarioSteps({
      timingProfile: 'happyguy_mad_healthgrades_360_email',
      anchorStartIso: '2026-03-02',
      holidays: new Set(),
    });
    const liver = computeScenarioSteps({
      timingProfile: 'happyguy_mad_liver_brochure_training_blueprint',
      anchorStartIso: '2026-03-02',
      holidays: new Set(),
    });
    expect(hg.ok && liver.ok).toBe(true);
    if (!hg.ok || !liver.ok) return;
    const iHg = idxPhase(hg.breakdown, 'prep_assets_release');
    const iLv = idxPhase(liver.breakdown, 'prep_assets_release');
    expect(hg.breakdown[iHg]!.scaled_days).toBeGreaterThan(liver.breakdown[iLv]!.scaled_days);
  });

  it('HappyGuy AASLD congress print pick-up: Excel-calibrated milestones from discovery anchor', () => {
    const r = computeScenarioSteps({
      timingProfile: 'happyguy_aasld_congress_print_pickup',
      anchorStartIso: '2026-04-29',
      holidays: new Set(),
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.opdp_binder_steps).toBeUndefined();
    expect(r.steps.some((s) => /PRB[123]/i.test(s.task))).toBe(false);
    expect(r.steps.length).toBe(35);

    const iKickoff = idxPhase(r.breakdown, 'aasld_pickup_kickoff');
    const iM1Route = idxPhase(r.breakdown, 'aasld_pickup_m1_route_team_clean');
    const iClientSend = idxPhase(r.breakdown, 'aasld_pickup_client_send_approval');
    const iPrintProofRoute = idxPhase(r.breakdown, 'aasld_pickup_print_proof_route');
    const iHandoff = idxPhase(r.breakdown, 'aasld_pickup_handoff_files_hardcode');
    const iCloseout = idxPhase(r.breakdown, 'aasld_pickup_project_closeout');

    expect(r.steps[iKickoff]!.start_date).toBe('2026-05-06');
    expect(r.steps[iM1Route]!.end_date).toBe('2026-05-21');
    expect(r.steps[iClientSend]!.start_date).toBe('2026-06-03');
    expect(r.steps[iPrintProofRoute]!.end_date).toBe('2026-07-20');
    expect(r.steps[iHandoff]!.start_date).toBe('2026-09-15');
    expect(r.steps[iCloseout]!.end_date).toBe('2026-09-17');

    const totalWd = inclusiveWorkingDaySpan(r.steps[0]!.start_date, r.steps[r.steps.length - 1]!.end_date, new Set());
    expect(totalWd).toBe(102);
  });

  it('HappyGuy AASLD congress wifi splash: Excel-calibrated milestones from discovery anchor', () => {
    const r = computeScenarioSteps({
      timingProfile: 'happyguy_aasld_congress_print_pickup',
      catalogTacticKey: 'happyguy_aasld_wifi_splash_page',
      anchorStartIso: '2026-04-29',
      holidays: new Set(),
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.opdp_binder_steps).toBeUndefined();
    expect(r.steps.some((s) => /PRB[123]/i.test(s.task))).toBe(false);
    expect(r.steps.length).toBe(31);

    const iKickoff = idxPhase(r.breakdown, 'aasld_wifi_kickoff');
    const iMarkup = idxPhase(r.breakdown, 'aasld_wifi_content_markup_files');
    const iReko = idxPhase(r.breakdown, 'aasld_wifi_rekickoff');
    const iPickup = idxPhase(r.breakdown, 'aasld_wifi_m1_pickup_revise_create');
    const iRoute = idxPhase(r.breakdown, 'aasld_wifi_d1_route_team_clean');
    const iClientSend = idxPhase(r.breakdown, 'aasld_wifi_client_send_approval');
    const iFinalClient = idxPhase(r.breakdown, 'aasld_wifi_final_client_receive_aasld_clearance');
    const iAasldFinal = idxPhase(r.breakdown, 'aasld_wifi_aasld_final_approval');
    const iFileRelease = idxPhase(r.breakdown, 'aasld_wifi_file_release_submit');
    const iHandoff = idxPhase(r.breakdown, 'aasld_wifi_handoff_files_hardcode');
    const iCloseout = idxPhase(r.breakdown, 'aasld_wifi_project_closeout');

    expect(r.steps[iKickoff]!.start_date).toBe('2026-05-06');
    expect(r.steps[iMarkup]!.start_date).toBe('2026-05-11');
    expect(r.steps[iReko]!.end_date).toBe('2026-05-18');
    expect(r.steps[iPickup]!.end_date).toBe('2026-06-02');
    expect(r.steps[iRoute]!.end_date).toBe('2026-06-03');
    expect(r.steps[iClientSend]!.start_date).toBe('2026-06-04');
    expect(r.steps[iFinalClient]!.end_date).toBe('2026-06-16');
    expect(r.steps[iAasldFinal]!.end_date).toBe('2026-07-06');
    expect(r.steps[iFileRelease]!.end_date).toBe('2026-07-09');
    expect(r.steps[iHandoff]!.start_date).toBe('2026-09-15');
    expect(r.steps[iCloseout]!.end_date).toBe('2026-09-17');

    const totalWd = inclusiveWorkingDaySpan(r.steps[0]!.start_date, r.steps[r.steps.length - 1]!.end_date, new Set());
    expect(totalWd).toBe(102);
  });

  it('HappyGuy MPS website update: Excel-calibrated milestones from markup anchor', () => {
    const r = computeScenarioSteps({
      timingProfile: 'happyguy_mps_website_update',
      anchorStartIso: '2026-05-06',
      holidays: new Set(),
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.opdp_binder_steps).toBeUndefined();
    expect(r.steps.some((s) => /PRB[123]/i.test(s.task))).toBe(false);
    expect(r.steps.length).toBe(49);

    const iKickoff = idxPhase(r.breakdown, 'mps_web_kickoff');
    const iSubmitPrc1 = idxPhase(r.breakdown, 'mps_web_submit_prc1');
    const iPrc1Review = idxPhase(r.breakdown, 'mps_web_prc1_review');
    const iFinalPrc = idxPhase(r.breakdown, 'mps_web_final_prc_approval');
    const iOpdpApproval = idxPhase(r.breakdown, 'mps_web_opdp_approval');
    const iFdaApproval = idxPhase(r.breakdown, 'mps_web_fda_approval_period');
    const iMoveProd = idxPhase(r.breakdown, 'mps_web_move_to_production');
    const iCloseout = idxPhase(r.breakdown, 'mps_web_project_closeout');

    expect(r.steps[iKickoff]!.start_date).toBe('2026-05-07');
    expect(r.steps[iSubmitPrc1]!.start_date).toBe('2026-05-22');
    expect(r.steps[iPrc1Review]!.start_date).toBe('2026-05-26');
    expect(r.steps[iFinalPrc]!.end_date).toBe('2026-06-15');
    expect(r.steps[iOpdpApproval]!.start_date).toBe('2026-08-12');
    expect(r.steps[iFdaApproval]!.end_date).toBe('2026-08-18');
    expect(r.steps[iMoveProd]!.start_date).toBe('2026-08-24');
    expect(r.steps[iCloseout]!.end_date).toBe('2026-08-31');

    const totalWd = inclusiveWorkingDaySpan(r.steps[0]!.start_date, r.steps[r.steps.length - 1]!.end_date, new Set());
    expect(totalWd).toBe(84);
  });

  it('HappyGuy branded CRM email: Excel-calibrated milestones from discovery anchor', () => {
    const r = computeScenarioSteps({
      timingProfile: 'happyguy_branded_crm_email',
      anchorStartIso: '2026-03-27',
      holidays: new Set(),
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.opdp_binder_steps).toBeUndefined();
    expect(r.steps.some((s) => /PRB3/i.test(s.task))).toBe(false);
    expect(r.steps.length).toBe(82);

    const iKickoff = idxPhase(r.breakdown, 'crm_email_kickoff_meeting');
    const iSubmitPrc1 = idxPhase(r.breakdown, 'crm_email_prc1_submit');
    const iPrc1Approval = idxPhase(r.breakdown, 'crm_email_prc1_approval');
    const iPrc2Submit = idxPhase(r.breakdown, 'crm_email_prc2_submit');
    const iFinalPrc = idxPhase(r.breakdown, 'crm_email_final_prc_approval');
    const iOpdpApproval = idxPhase(r.breakdown, 'crm_email_opdp_approval');
    const iFdaEnd = idxPhase(r.breakdown, 'crm_email_fda_filing_period');
    const iDeploy = idxPhase(r.breakdown, 'crm_email_martech_deploy_approval');
    const iCloseout = idxPhase(r.breakdown, 'crm_email_project_closeout');

    expect(r.steps[iKickoff]!.start_date).toBe('2026-04-08');
    expect(r.steps[iSubmitPrc1]!.start_date).toBe('2026-05-19');
    expect(r.steps[iPrc1Approval]!.start_date).toBe('2026-05-29');
    expect(r.steps[iPrc2Submit]!.start_date).toBe('2026-06-11');
    expect(r.steps[iFinalPrc]!.start_date).toBe('2026-07-13');
    expect(r.steps[iOpdpApproval]!.start_date).toBe('2026-09-03');
    expect(r.steps[iFdaEnd]!.end_date).toBe('2026-09-30');
    expect(r.steps[iDeploy]!.start_date).toBe('2026-09-22');
    expect(r.steps[iCloseout]!.end_date).toBe('2026-10-02');

    const totalWd = inclusiveWorkingDaySpan(r.steps[0]!.start_date, r.steps[r.steps.length - 1]!.end_date, new Set());
    expect(totalWd).toBe(136);
  });

  it('legacy tactic alias email matches canonical generic_tactic schedule', () => {
    const canonical = computeScenarioSteps({
      tactic: 'generic_tactic',
      anchorStartIso: '2026-03-02',
      holidays: new Set(),
    });
    const aliased = computeScenarioSteps({
      tactic: 'email',
      anchorStartIso: '2026-03-02',
      holidays: new Set(),
    });
    expect(canonical.ok && aliased.ok).toBe(true);
    if (!canonical.ok || !aliased.ok) return;
    expect(aliased.steps).toEqual(canonical.steps);
    expect(aliased.breakdown).toEqual(canonical.breakdown);
  });
});

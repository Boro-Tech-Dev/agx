import { describe, expect, it } from 'vitest';

import { calendarDaysOffset } from './dateCalendar';
import { EMAIL_BASELINE_KICKOFF_ISO } from './emailBaseline';
import {
  PRB1_SUBMIT_TO_REVIEW_CALENDAR_DELTA,
  PRB2_SUBMIT_TO_REVIEW_CALENDAR_DELTA,
  PRB3_SUBMIT_TO_REVIEW_CALENDAR_DELTA,
  countConsecutiveWorkingDaysBefore,
  neutralShiftedSubmitStartFromKickoff,
  pickHappyGuySubmitAnchorWeekday,
  resolveEmailMonWedPrbRows,
  resolveHappyGuyPrbReviewStart,
  resolvePrbAnchorDay,
  secondWorkingWednesdayAfterMondaySubmit,
  shiftHappyGuyClientShareApprovalIfOverloadedTuesday,
  utcMondayOfWeekContaining,
} from './prbWeekdayAnchors';

describe('prbWeekdayAnchors', () => {
  it('baseline submit→review deltas match email baseline (9 calendar days)', () => {
    expect(PRB1_SUBMIT_TO_REVIEW_CALENDAR_DELTA).toBe(9);
    expect(PRB2_SUBMIT_TO_REVIEW_CALENDAR_DELTA).toBe(9);
    expect(PRB3_SUBMIT_TO_REVIEW_CALENDAR_DELTA).toBe(9);
  });

  it('utcMondayOfWeekContaining', () => {
    expect(utcMondayOfWeekContaining('2026-04-14')).toBe('2026-04-13');
    expect(utcMondayOfWeekContaining('2026-04-13')).toBe('2026-04-13');
    expect(utcMondayOfWeekContaining('2026-04-12')).toBe('2026-04-06');
  });

  it('resolvePrbAnchorDay: working ideal unchanged', () => {
    const hol = new Set<string>();
    expect(resolvePrbAnchorDay('2026-04-13', hol, false)).toEqual({
      iso: '2026-04-13',
      needsAllowNonWorkingFlag: false,
    });
  });

  it('resolvePrbAnchorDay: Monday holiday → Friday when allow off', () => {
    const hol = new Set(['2026-04-13']);
    expect(resolvePrbAnchorDay('2026-04-13', hol, false)).toEqual({
      iso: '2026-04-10',
      needsAllowNonWorkingFlag: false,
    });
  });

  it('resolvePrbAnchorDay: Monday holiday → Sunday when allow on', () => {
    const hol = new Set(['2026-04-13']);
    expect(resolvePrbAnchorDay('2026-04-13', hol, true)).toEqual({
      iso: '2026-04-12',
      needsAllowNonWorkingFlag: true,
    });
  });

  it('resolveHappyGuyPrbReviewStart: holiday on ideal Tuesday → next working Tuesday, not Monday', () => {
    const hol = new Set(['2026-05-05']);
    expect(resolvePrbAnchorDay('2026-05-05', hol, false)).toEqual({
      iso: '2026-05-04',
      needsAllowNonWorkingFlag: false,
    });
    expect(resolveHappyGuyPrbReviewStart('2026-05-05', 'tuesday', hol, false)).toEqual({
      iso: '2026-05-12',
      needsAllowNonWorkingFlag: false,
    });
  });

  it('resolveHappyGuyPrbReviewStart: holiday on ideal Thursday → next working Thursday', () => {
    const hol = new Set(['2026-05-07']);
    expect(resolveHappyGuyPrbReviewStart('2026-05-07', 'thursday', hol, false)).toEqual({
      iso: '2026-05-14',
      needsAllowNonWorkingFlag: false,
    });
  });

  it('pickHappyGuySubmitAnchorWeekday: Monday ref → Tuesday', () => {
    const hol = new Set<string>();
    expect(pickHappyGuySubmitAnchorWeekday('2026-06-08', hol)).toBe('tuesday');
  });

  it('pickHappyGuySubmitAnchorWeekday: Wednesday ref → Thursday', () => {
    const hol = new Set<string>();
    expect(pickHappyGuySubmitAnchorWeekday('2026-06-10', hol)).toBe('thursday');
  });

  it('neutralShiftedSubmitStartFromKickoff: shifted baseline calendar date', () => {
    const iso = neutralShiftedSubmitStartFromKickoff('2026-03-02', 'submit_prb1', {
      mode: 'from_shifted_baseline',
    });
    expect(iso >= '2026-04-01').toBe(true);
  });

  it('mon_wed + baseline kickoff: chain-first PRB Mondays and reviews', () => {
    const hol = new Set<string>();
    const r = resolveEmailMonWedPrbRows(EMAIL_BASELINE_KICKOFF_ISO, hol, {}, { mode: 'from_shifted_baseline' });
    expect(r.submit_prb1.start).toBe('2026-03-02');
    expect(r.submit_prb1.end).toBe('2026-03-02');
    expect(r.prb1_review.start).toBe('2026-03-11');
    expect(r.submit_prb1.allowNonWorking).toBe(false);
    expect(r.submit_prb3.start).toBe('2026-03-30');
    expect(r.prb3_review.start).toBe('2026-04-08');
  });

  it('mon_wed + kickoff one day after baseline: first PRB Monday follows chain cursor', () => {
    const hol = new Set<string>();
    const anchor = '2026-03-03';
    const shift = calendarDaysOffset(EMAIL_BASELINE_KICKOFF_ISO, anchor);
    expect(shift).toBe(1);
    const r = resolveEmailMonWedPrbRows(anchor, hol, {}, { mode: 'from_shifted_baseline' });
    expect(r.submit_prb1.start).toBe('2026-03-09');
    expect(r.prb1_review.start).toBe('2026-03-18');
  });

  it('mon_wed + Monday holiday on first chain submit: snaps to next working Monday', () => {
    const hol = new Set(['2026-03-02']);
    const off = resolveEmailMonWedPrbRows(EMAIL_BASELINE_KICKOFF_ISO, hol, {}, { mode: 'from_shifted_baseline' });
    expect(off.submit_prb1.start).toBe('2026-03-09');
    expect(off.submit_prb1.allowNonWorking).toBe(false);

    const on = resolveEmailMonWedPrbRows(EMAIL_BASELINE_KICKOFF_ISO, hol, { submit_prb1: true }, {
      mode: 'from_shifted_baseline',
    });
    expect(on.submit_prb1.start).toBe('2026-03-09');
    expect(on.submit_prb1.allowNonWorking).toBe(false);
  });

  it('mon_wed + Wednesday holiday on PRB1 review: skips that Wed when counting working Wednesdays', () => {
    const hol = new Set(['2026-03-11']);
    const r = resolveEmailMonWedPrbRows(EMAIL_BASELINE_KICKOFF_ISO, hol, {}, { mode: 'from_shifted_baseline' });
    expect(r.prb1_review.start).toBe('2026-03-18');
  });

  it('secondWorkingWednesdayAfterMondaySubmit skips a holiday on the first Wednesday', () => {
    const hol = new Set(['2026-07-08']);
    expect(secondWorkingWednesdayAfterMondaySubmit('2026-07-06', hol)).toBe('2026-07-22');
  });

  it('explicit_submits uses provided Mondays and review offsets', () => {
    const hol = new Set<string>();
    const r = resolveEmailMonWedPrbRows('2026-01-01', hol, {}, {
      mode: 'explicit_submits',
      prb1SubmitIso: '2026-07-06',
      prb2SubmitIso: '2026-08-03',
      prb3SubmitIso: '2026-09-07',
    });
    expect(r.submit_prb1.start).toBe('2026-07-06');
    expect(r.prb1_review.start).toBe('2026-07-15');
    expect(r.submit_prb2.start).toBe('2026-08-03');
    expect(r.prb2_review.start).toBe('2026-08-12');
    expect(r.submit_prb3.start).toBe('2026-09-07');
    expect(r.prb3_review.start).toBe('2026-09-16');
  });

  it('countConsecutiveWorkingDaysBefore skips weekends when walking backward', () => {
    const hol = new Set<string>();
    expect(countConsecutiveWorkingDaysBefore('2026-06-16', hol)).toBe(6);
    expect(countConsecutiveWorkingDaysBefore('2026-06-10', hol)).toBeGreaterThanOrEqual(5);
  });

  it('shiftHappyGuyClientShareApprovalIfOverloadedTuesday moves Tue to Mon when streak > 4', () => {
    const hol = new Set<string>();
    const tue = '2026-06-16';
    expect(countConsecutiveWorkingDaysBefore(tue, hol)).toBeGreaterThan(4);
    const out = shiftHappyGuyClientShareApprovalIfOverloadedTuesday(tue, tue, hol);
    expect(out.start).toBe('2026-06-15');
    expect(out.end).toBe('2026-06-15');
  });

  it('shiftHappyGuyClientShareApprovalIfOverloadedTuesday leaves Tuesday when streak <= 4', () => {
    const hol = new Set(['2026-06-01']);
    const tue = '2026-06-02';
    expect(countConsecutiveWorkingDaysBefore(tue, hol)).toBeLessThanOrEqual(4);
    const out = shiftHappyGuyClientShareApprovalIfOverloadedTuesday(tue, tue, hol);
    expect(out.start).toBe(tue);
  });
});

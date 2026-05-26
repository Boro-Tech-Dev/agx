import { addCalendarDaysUTC, calendarDaysOffset, parseIsoDateUTC } from './dateCalendar';
import { EMAIL_BASELINE, EMAIL_BASELINE_KICKOFF_ISO } from './emailBaseline';
import {
  addWorkingDaysUTC,
  inclusiveWorkingDaySpan,
  isWeekendIso,
  isWorkingDay,
  nextWorkingDay,
  previousWorkingDayOnOrBefore,
  type HolidaySet,
} from './workingDays';

/** First calendar Tuesday that is a working day on or after `iso`. */
export function firstWorkingTuesdayOnOrAfter(iso: string, holidays: HolidaySet): string {
  let cur = iso;
  for (let g = 0; g < 400; g++) {
    const d = parseIsoDateUTC(cur);
    if (d.getUTCDay() === 2 && isWorkingDay(cur, holidays)) return cur;
    cur = addCalendarDaysUTC(cur, 1);
  }
  throw new Error('firstWorkingTuesdayOnOrAfter: exceeded search window');
}

/** First calendar Thursday that is a working day on or after `iso`. */
export function firstWorkingThursdayOnOrAfter(iso: string, holidays: HolidaySet): string {
  let cur = iso;
  for (let g = 0; g < 400; g++) {
    const d = parseIsoDateUTC(cur);
    if (d.getUTCDay() === 4 && isWorkingDay(cur, holidays)) return cur;
    cur = addCalendarDaysUTC(cur, 1);
  }
  throw new Error('firstWorkingThursdayOnOrAfter: exceeded search window');
}

/** Lexicographic max for ISO dates (YYYY-MM-DD). */
export function maxIsoDate(a: string, b: string): string {
  return a >= b ? a : b;
}

/** First calendar Monday that is a working day on or after `iso`. */
export function firstWorkingMondayOnOrAfter(iso: string, holidays: HolidaySet): string {
  let cur = iso;
  for (let g = 0; g < 400; g++) {
    const d = parseIsoDateUTC(cur);
    if (d.getUTCDay() === 1 && isWorkingDay(cur, holidays)) return cur;
    cur = addCalendarDaysUTC(cur, 1);
  }
  throw new Error('firstWorkingMondayOnOrAfter: exceeded search window');
}

/**
 * Second **working** Wednesday after PRB submission Monday (`submitMondayIso`).
 * Example: Mon 2026-04-13 → Wed 2026-04-22 (skips non-working Wednesdays).
 */
export function secondWorkingWednesdayAfterMondaySubmit(
  submitMondayIso: string,
  holidays: HolidaySet,
): string {
  let wed = addCalendarDaysUTC(submitMondayIso, 2);
  while (parseIsoDateUTC(wed).getUTCDay() !== 3) {
    wed = addCalendarDaysUTC(wed, 1);
  }
  let counted = 0;
  for (let i = 0; i < 120; i++) {
    if (isWorkingDay(wed, holidays)) {
      counted += 1;
      if (counted === 2) return wed;
    }
    wed = addCalendarDaysUTC(wed, 7);
  }
  throw new Error('secondWorkingWednesdayAfterMondaySubmit: exceeded search window');
}

function baselineRow(phaseId: string) {
  const r = EMAIL_BASELINE.find((x) => x.phase_id === phaseId);
  if (!r) throw new Error(`Missing EMAIL_BASELINE row: ${phaseId}`);
  return r;
}

function submitToReviewCalendarDelta(submitPhaseId: string, reviewPhaseId: string): number {
  const s = baselineRow(submitPhaseId);
  const e = baselineRow(reviewPhaseId);
  return calendarDaysOffset(s.start_date, e.start_date);
}

/** Calendar days from PRB1 submit start to PRB1 review start (reference baseline schedule). */
export const PRB1_SUBMIT_TO_REVIEW_CALENDAR_DELTA = submitToReviewCalendarDelta(
  'submit_prb1',
  'prb1_review',
);

/** Calendar days from PRB2 submit start to PRB2 review start (reference baseline schedule). */
export const PRB2_SUBMIT_TO_REVIEW_CALENDAR_DELTA = submitToReviewCalendarDelta(
  'submit_prb2',
  'prb2_review',
);

/** Calendar days from PRB3 submit start to PRB3 review start (reference baseline schedule). */
export const PRB3_SUBMIT_TO_REVIEW_CALENDAR_DELTA = submitToReviewCalendarDelta(
  'submit_prb3',
  'prb3_review',
);

export type PrbBrandConfig =
  | { mode: 'from_shifted_baseline' }
  | {
      mode: 'explicit_submits';
      prb1SubmitIso: string;
      prb2SubmitIso: string;
      /** When omitted, PRB3 Monday follows shifted baseline like `from_shifted_baseline`. */
      prb3SubmitIso?: string;
    };

/** Monday-start week (UTC): the Monday of the calendar week containing `iso`. */
export function utcMondayOfWeekContaining(iso: string): string {
  const d = parseIsoDateUTC(iso);
  const wd = d.getUTCDay();
  const daysFromMonday = (wd + 6) % 7;
  return addCalendarDaysUTC(iso, -daysFromMonday);
}

/** ISO week (Mon–Sun): the Thursday of the same calendar week as `utcMondayOfWeekContaining`. */
export function utcThursdayOfWeekContaining(iso: string): string {
  return addCalendarDaysUTC(utcMondayOfWeekContaining(iso), 3);
}

/** Same ISO week as Monday anchor: Tuesday = Monday + 1 calendar day. */
export function utcTuesdayOfWeekContaining(iso: string): string {
  return addCalendarDaysUTC(utcMondayOfWeekContaining(iso), 1);
}

/**
 * Single-day PRB anchor: if ideal is off, try calendar day before; then either
 * allow non-working on that day (when permitted) or snap to previous working day.
 */
export function resolvePrbAnchorDay(
  idealIso: string,
  holidays: HolidaySet,
  allowNonWorking: boolean,
): { iso: string; needsAllowNonWorkingFlag: boolean } {
  if (isWorkingDay(idealIso, holidays)) {
    return { iso: idealIso, needsAllowNonWorkingFlag: false };
  }
  const candidate = addCalendarDaysUTC(idealIso, -1);
  if (isWorkingDay(candidate, holidays)) {
    return { iso: candidate, needsAllowNonWorkingFlag: false };
  }
  if (allowNonWorking) {
    return {
      iso: candidate,
      needsAllowNonWorkingFlag: !isWorkingDay(candidate, holidays),
    };
  }
  return {
    iso: previousWorkingDayOnOrBefore(candidate, holidays),
    needsAllowNonWorkingFlag: false,
  };
}

/** Submit anchor weekday for HappyGuy week-aligned PRB cadence (per PRB round after proximity). */
export type HappyGuyPrbSubmitAnchorWeekday = 'tuesday' | 'thursday';

/**
 * Kickoff-shifted baseline submit date for a PRB round **without** snapping to Monday/Tuesday/Thursday.
 * Used as the neutral reference for HappyGuy Tuesday-vs-Thursday proximity.
 */
export function neutralShiftedSubmitStartFromKickoff(
  anchorStartIso: string,
  submitPhaseId: 'submit_prb1' | 'submit_prb2' | 'submit_prb3',
  brand: PrbBrandConfig,
): string {
  if (brand.mode === 'explicit_submits') {
    if (submitPhaseId === 'submit_prb1') return brand.prb1SubmitIso;
    if (submitPhaseId === 'submit_prb2') return brand.prb2SubmitIso;
    const raw =
      brand.prb3SubmitIso !== undefined
        ? brand.prb3SubmitIso
        : addCalendarDaysUTC(
            baselineRow('submit_prb3').start_date,
            calendarDaysOffset(EMAIL_BASELINE_KICKOFF_ISO, anchorStartIso),
          );
    return raw;
  }
  const shift = calendarDaysOffset(EMAIL_BASELINE_KICKOFF_ISO, anchorStartIso);
  const baselineSubmit = baselineRow(submitPhaseId).start_date;
  return addCalendarDaysUTC(baselineSubmit, shift);
}

/**
 * HappyGuy PRB submit: pick Tuesday vs Thursday by **proximity** — whichever first working
 * Tuesday or Thursday on or after `refIso` is closer in calendar days; tie → Tuesday.
 */
export function pickHappyGuySubmitAnchorWeekday(
  refIso: string,
  holidays: HolidaySet,
): HappyGuyPrbSubmitAnchorWeekday {
  const t = firstWorkingTuesdayOnOrAfter(refIso, holidays);
  const h = firstWorkingThursdayOnOrAfter(refIso, holidays);
  const dTue = calendarDaysOffset(refIso, t);
  const dThu = calendarDaysOffset(refIso, h);
  if (dTue <= dThu) return 'tuesday';
  return 'thursday';
}

/**
 * HappyGuy `prb*_review`: `submit_start + 7` calendar days, then the first **working**
 * Tuesday or Thursday **on or after** that date. Never slides backward (e.g. holiday
 * Tuesday does not become Monday).
 */
export function resolveHappyGuyPrbReviewStart(
  idealReviewCalIso: string,
  anchorWeekday: HappyGuyPrbSubmitAnchorWeekday,
  holidays: HolidaySet,
  _allowNonWorking: boolean,
): { iso: string; needsAllowNonWorkingFlag: boolean } {
  const iso =
    anchorWeekday === 'tuesday'
      ? firstWorkingTuesdayOnOrAfter(idealReviewCalIso, holidays)
      : firstWorkingThursdayOnOrAfter(idealReviewCalIso, holidays);
  return { iso, needsAllowNonWorkingFlag: false };
}

/**
 * Working days strictly before `startIso`, walking backward through at most **two ISO weeks**:
 * from the Monday of the week before `startIso`'s calendar day through `start - 1 day`.
 * Weekends are skipped (bridge). Stops at a holiday (non-working weekday).
 */
export function countConsecutiveWorkingDaysBefore(startIso: string, holidays: HolidaySet): number {
  const dayBefore = addCalendarDaysUTC(startIso, -1);
  const weekMonday = utcMondayOfWeekContaining(dayBefore);
  const windowStart = addCalendarDaysUTC(weekMonday, -7);
  let cur = dayBefore;
  let n = 0;
  while (cur >= windowStart) {
    if (isWeekendIso(cur)) {
      cur = addCalendarDaysUTC(cur, -1);
      continue;
    }
    if (!isWorkingDay(cur, holidays)) break;
    n += 1;
    cur = addCalendarDaysUTC(cur, -1);
  }
  return n;
}

function previousWorkingMondayFromCalendarMonday(mondayIso: string, holidays: HolidaySet): string {
  let mon = mondayIso;
  for (let g = 0; g < 60; g++) {
    if (parseIsoDateUTC(mon).getUTCDay() !== 1) {
      throw new Error('previousWorkingMondayFromCalendarMonday: expected Monday');
    }
    if (isWorkingDay(mon, holidays)) return mon;
    mon = addCalendarDaysUTC(mon, -7);
  }
  throw new Error('previousWorkingMondayFromCalendarMonday: exceeded search');
}

/**
 * HappyGuy client share-for-approval: if it lands on a working Tuesday after more than four
 * consecutive working days, move to the previous working Monday (preserving working-day span).
 */
export function shiftHappyGuyClientShareApprovalIfOverloadedTuesday(
  startIso: string,
  endIso: string,
  holidays: HolidaySet,
): { start: string; end: string } {
  if (!isWorkingDay(startIso, holidays)) return { start: startIso, end: endIso };
  if (parseIsoDateUTC(startIso).getUTCDay() !== 2) return { start: startIso, end: endIso };
  if (countConsecutiveWorkingDaysBefore(startIso, holidays) <= 4) return { start: startIso, end: endIso };

  const calMonday = addCalendarDaysUTC(startIso, -1);
  const newStart = previousWorkingMondayFromCalendarMonday(calMonday, holidays);
  const wdSpan = inclusiveWorkingDaySpan(startIso, endIso, holidays);
  const newEnd = wdSpan <= 1 ? newStart : addWorkingDaysUTC(newStart, wdSpan - 1, holidays);
  return { start: newStart, end: newEnd };
}

export function idealMondayForSubmitFromKickoff(
  anchorStartIso: string,
  submitPhaseId: 'submit_prb1' | 'submit_prb2' | 'submit_prb3',
  brand: PrbBrandConfig,
): string {
  if (brand.mode === 'explicit_submits') {
    if (submitPhaseId === 'submit_prb1') return utcMondayOfWeekContaining(brand.prb1SubmitIso);
    if (submitPhaseId === 'submit_prb2') return utcMondayOfWeekContaining(brand.prb2SubmitIso);
    const raw =
      brand.prb3SubmitIso !== undefined
        ? brand.prb3SubmitIso
        : addCalendarDaysUTC(
            baselineRow('submit_prb3').start_date,
            calendarDaysOffset(EMAIL_BASELINE_KICKOFF_ISO, anchorStartIso),
          );
    return utcMondayOfWeekContaining(raw);
  }
  const shift = calendarDaysOffset(EMAIL_BASELINE_KICKOFF_ISO, anchorStartIso);
  const baselineSubmit = baselineRow(submitPhaseId).start_date;
  const shifted = addCalendarDaysUTC(baselineSubmit, shift);
  return utcMondayOfWeekContaining(shifted);
}

export function idealTuesdayForSubmitFromKickoff(
  anchorStartIso: string,
  submitPhaseId: 'submit_prb1' | 'submit_prb2' | 'submit_prb3',
  brand: PrbBrandConfig,
): string {
  if (brand.mode === 'explicit_submits') {
    if (submitPhaseId === 'submit_prb1') return utcTuesdayOfWeekContaining(brand.prb1SubmitIso!);
    if (submitPhaseId === 'submit_prb2') return utcTuesdayOfWeekContaining(brand.prb2SubmitIso!);
    const raw =
      brand.prb3SubmitIso !== undefined
        ? brand.prb3SubmitIso
        : addCalendarDaysUTC(
            baselineRow('submit_prb3').start_date,
            calendarDaysOffset(EMAIL_BASELINE_KICKOFF_ISO, anchorStartIso),
          );
    return utcTuesdayOfWeekContaining(raw);
  }
  const shift = calendarDaysOffset(EMAIL_BASELINE_KICKOFF_ISO, anchorStartIso);
  const baselineSubmit = baselineRow(submitPhaseId).start_date;
  const shifted = addCalendarDaysUTC(baselineSubmit, shift);
  return utcTuesdayOfWeekContaining(shifted);
}

export function idealThursdayForSubmitFromKickoff(
  anchorStartIso: string,
  submitPhaseId: 'submit_prb1' | 'submit_prb2' | 'submit_prb3',
  brand: PrbBrandConfig,
): string {
  if (brand.mode === 'explicit_submits') {
    if (submitPhaseId === 'submit_prb1') return utcThursdayOfWeekContaining(brand.prb1SubmitIso!);
    if (submitPhaseId === 'submit_prb2') return utcThursdayOfWeekContaining(brand.prb2SubmitIso!);
    const raw =
      brand.prb3SubmitIso !== undefined
        ? brand.prb3SubmitIso
        : addCalendarDaysUTC(
            baselineRow('submit_prb3').start_date,
            calendarDaysOffset(EMAIL_BASELINE_KICKOFF_ISO, anchorStartIso),
          );
    return utcThursdayOfWeekContaining(raw);
  }
  const shift = calendarDaysOffset(EMAIL_BASELINE_KICKOFF_ISO, anchorStartIso);
  const baselineSubmit = baselineRow(submitPhaseId).start_date;
  const shifted = addCalendarDaysUTC(baselineSubmit, shift);
  return utcThursdayOfWeekContaining(shifted);
}

export type MonWedPrbResolvedRow = { start: string; end: string; allowNonWorking: boolean };

export type MonWedPrbResolved = {
  submit_prb1: MonWedPrbResolvedRow;
  prb1_review: MonWedPrbResolvedRow;
  submit_prb2: MonWedPrbResolvedRow;
  prb2_review: MonWedPrbResolvedRow;
  submit_prb3: MonWedPrbResolvedRow;
  prb3_review: MonWedPrbResolvedRow;
};

function stepAllow(
  phaseAllows: boolean,
  iso: string,
  holidays: HolidaySet,
  needsFlagFromResolver: boolean,
): boolean {
  if (!phaseAllows) return false;
  if (needsFlagFromResolver) return true;
  return !isWorkingDay(iso, holidays);
}

/** Resolves all six PRB single-day rows for HCP MLR cadence (`email_ml_r`) under mon_wed policy.
 * `from_shifted_baseline`: chain-first — each submit snaps to the first working Monday on or after the
 * prior milestone cursor (starting at `anchorStartIso`); reviews follow submit Monday.
 * `explicit_submits`: submit Mondays derived from provided ISOs (unchanged). */
export function resolveEmailMonWedPrbRows(
  anchorStartIso: string,
  holidays: HolidaySet,
  phaseAllowNonWorkingDays: Readonly<Record<string, boolean>> | undefined,
  brand: PrbBrandConfig,
): MonWedPrbResolved {
  const allow = (id: string) => phaseAllowNonWorkingDays?.[id] === true;

  if (brand.mode === 'explicit_submits') {
    const idealMon1 = idealMondayForSubmitFromKickoff(anchorStartIso, 'submit_prb1', brand);
    const s1 = resolvePrbAnchorDay(idealMon1, holidays, allow('submit_prb1'));
    const idealWed1 = secondWorkingWednesdayAfterMondaySubmit(s1.iso, holidays);
    const r1 = resolvePrbAnchorDay(idealWed1, holidays, allow('prb1_review'));

    const idealMon2 = idealMondayForSubmitFromKickoff(anchorStartIso, 'submit_prb2', brand);
    const s2 = resolvePrbAnchorDay(idealMon2, holidays, allow('submit_prb2'));
    const idealWed2 = secondWorkingWednesdayAfterMondaySubmit(s2.iso, holidays);
    const r2 = resolvePrbAnchorDay(idealWed2, holidays, allow('prb2_review'));

    const idealMon3 = idealMondayForSubmitFromKickoff(anchorStartIso, 'submit_prb3', brand);
    const s3 = resolvePrbAnchorDay(idealMon3, holidays, allow('submit_prb3'));
    const idealWed3 = secondWorkingWednesdayAfterMondaySubmit(s3.iso, holidays);
    const r3 = resolvePrbAnchorDay(idealWed3, holidays, allow('prb3_review'));

    return {
      submit_prb1: {
        start: s1.iso,
        end: s1.iso,
        allowNonWorking: stepAllow(allow('submit_prb1'), s1.iso, holidays, s1.needsAllowNonWorkingFlag),
      },
      prb1_review: {
        start: r1.iso,
        end: r1.iso,
        allowNonWorking: stepAllow(allow('prb1_review'), r1.iso, holidays, r1.needsAllowNonWorkingFlag),
      },
      submit_prb2: {
        start: s2.iso,
        end: s2.iso,
        allowNonWorking: stepAllow(allow('submit_prb2'), s2.iso, holidays, s2.needsAllowNonWorkingFlag),
      },
      prb2_review: {
        start: r2.iso,
        end: r2.iso,
        allowNonWorking: stepAllow(allow('prb2_review'), r2.iso, holidays, r2.needsAllowNonWorkingFlag),
      },
      submit_prb3: {
        start: s3.iso,
        end: s3.iso,
        allowNonWorking: stepAllow(allow('submit_prb3'), s3.iso, holidays, s3.needsAllowNonWorkingFlag),
      },
      prb3_review: {
        start: r3.iso,
        end: r3.iso,
        allowNonWorking: stepAllow(allow('prb3_review'), r3.iso, holidays, r3.needsAllowNonWorkingFlag),
      },
    };
  }

  let cursorCal = anchorStartIso;

  const min1 = nextWorkingDay(cursorCal, holidays);
  const monRaw1 = firstWorkingMondayOnOrAfter(min1, holidays);
  const s1 = resolvePrbAnchorDay(monRaw1, holidays, allow('submit_prb1'));
  const idealWed1 = secondWorkingWednesdayAfterMondaySubmit(s1.iso, holidays);
  const r1 = resolvePrbAnchorDay(idealWed1, holidays, allow('prb1_review'));
  cursorCal = addCalendarDaysUTC(r1.iso, 1);

  const min2 = nextWorkingDay(cursorCal, holidays);
  const monRaw2 = firstWorkingMondayOnOrAfter(min2, holidays);
  const s2 = resolvePrbAnchorDay(monRaw2, holidays, allow('submit_prb2'));
  const idealWed2 = secondWorkingWednesdayAfterMondaySubmit(s2.iso, holidays);
  const r2 = resolvePrbAnchorDay(idealWed2, holidays, allow('prb2_review'));
  cursorCal = addCalendarDaysUTC(r2.iso, 1);

  const min3 = nextWorkingDay(cursorCal, holidays);
  const monRaw3 = firstWorkingMondayOnOrAfter(min3, holidays);
  const s3 = resolvePrbAnchorDay(monRaw3, holidays, allow('submit_prb3'));
  const idealWed3 = secondWorkingWednesdayAfterMondaySubmit(s3.iso, holidays);
  const r3 = resolvePrbAnchorDay(idealWed3, holidays, allow('prb3_review'));

  return {
    submit_prb1: {
      start: s1.iso,
      end: s1.iso,
      allowNonWorking: stepAllow(allow('submit_prb1'), s1.iso, holidays, s1.needsAllowNonWorkingFlag),
    },
    prb1_review: {
      start: r1.iso,
      end: r1.iso,
      allowNonWorking: stepAllow(allow('prb1_review'), r1.iso, holidays, r1.needsAllowNonWorkingFlag),
    },
    submit_prb2: {
      start: s2.iso,
      end: s2.iso,
      allowNonWorking: stepAllow(allow('submit_prb2'), s2.iso, holidays, s2.needsAllowNonWorkingFlag),
    },
    prb2_review: {
      start: r2.iso,
      end: r2.iso,
      allowNonWorking: stepAllow(allow('prb2_review'), r2.iso, holidays, r2.needsAllowNonWorkingFlag),
    },
    submit_prb3: {
      start: s3.iso,
      end: s3.iso,
      allowNonWorking: stepAllow(allow('submit_prb3'), s3.iso, holidays, s3.needsAllowNonWorkingFlag),
    },
    prb3_review: {
      start: r3.iso,
      end: r3.iso,
      allowNonWorking: stepAllow(allow('prb3_review'), r3.iso, holidays, r3.needsAllowNonWorkingFlag),
    },
  };
}

/**
 * HappyGuy week-aligned PRB cadence (Tuesday/Thursday submit, review +7 calendar, dev gaps, client-share shift).
 */

import type { HalTimelineStep } from '../../halScenario';
import { addCalendarDaysUTC, parseIsoDateUTC } from '../dateCalendar';
import type { HappyGuyPrbSubmitAnchorWeekday } from '../prbWeekdayAnchors';
import {
  firstWorkingThursdayOnOrAfter,
  firstWorkingTuesdayOnOrAfter,
  pickHappyGuySubmitAnchorWeekday,
  resolveHappyGuyPrbReviewStart,
  resolvePrbAnchorDay,
  shiftHappyGuyClientShareApprovalIfOverloadedTuesday,
} from '../prbWeekdayAnchors';
import type { ScenarioTactic } from '../tactics';
import { usesHappyGuyWeekAlignedPrbCadence } from '../timingProfiles';
import {
  addWorkingDaysUTC,
  inclusiveWorkingDaySpan,
  nextWorkingDay,
  previousWorkingDayOnOrBefore,
  type HolidaySet,
} from '../workingDays';
import type { ScenarioStepDef } from './types';
import { linearAllowNonWorkingFor, linearClampDays, linearPrbStepAllowNonWorking, linearStepPayload } from './scenario_linear_shared';

export const HAPPY_GUY_SHARE_CLIENT_APPROVAL_IDS = new Set([
  'share_client_approval_prb1',
  'share_client_approval_prb2',
  'share_client_approval_prb3',
]);

export function happyGuySubmitRefIsoFromCursor(cursorCal: string): string {
  return cursorCal;
}

export function maybeShiftHappyGuyClientShare(
  timingProfile: ScenarioTactic,
  rowId: string,
  start: string,
  end: string,
  holidays: HolidaySet,
): { start: string; end: string } {
  if (!usesHappyGuyWeekAlignedPrbCadence(timingProfile)) return { start, end };
  if (!HAPPY_GUY_SHARE_CLIENT_APPROVAL_IDS.has(rowId)) return { start, end };
  return shiftHappyGuyClientShareApprovalIfOverloadedTuesday(start, end, holidays);
}

export type HappyGuyPrbRefs = {
  happyGuyPrb1SubmitStart: string | null;
  happyGuyPrb1SubmitEnd: string | null;
  happyGuyPrb2SubmitStart: string | null;
  happyGuyPrb2SubmitEnd: string | null;
  happyGuyPrb3SubmitStart: string | null;
  happyGuyPrb3SubmitEnd: string | null;
  happyGuyPrb1AnchorWd: HappyGuyPrbSubmitAnchorWeekday | null;
  happyGuyPrb2AnchorWd: HappyGuyPrbSubmitAnchorWeekday | null;
  happyGuyPrb3AnchorWd: HappyGuyPrbSubmitAnchorWeekday | null;
  happyGuyLastPrbReviewStartForOpdp: string | null;
};

const HG_PRB_CADENCE_ROW_IDS = new Set([
  'submit_prb1',
  'prb1_review',
  'submit_prb2',
  'prb2_review',
  'submit_prb3',
  'prb3_review',
]);

export function happyGuyApplyPinnedPrefixPrbState(
  timingProfile: ScenarioTactic,
  allow: boolean,
  row: ScenarioStepDef,
  pin: HalTimelineStep,
  cursorCal: string,
  holidays: HolidaySet,
  refs: HappyGuyPrbRefs,
): void {
  if (!usesHappyGuyWeekAlignedPrbCadence(timingProfile) || allow || !HG_PRB_CADENCE_ROW_IDS.has(row.id)) return;
  if (row.id === 'submit_prb1') {
    const refIso = happyGuySubmitRefIsoFromCursor(cursorCal);
    refs.happyGuyPrb1AnchorWd = pickHappyGuySubmitAnchorWeekday(refIso, holidays);
    refs.happyGuyPrb1SubmitStart = pin.start_date;
    refs.happyGuyPrb1SubmitEnd = pin.end_date;
  } else if (row.id === 'prb1_review') {
    refs.happyGuyLastPrbReviewStartForOpdp = pin.start_date;
  } else if (row.id === 'submit_prb2') {
    const refIso = happyGuySubmitRefIsoFromCursor(cursorCal);
    refs.happyGuyPrb2AnchorWd = pickHappyGuySubmitAnchorWeekday(refIso, holidays);
    refs.happyGuyPrb2SubmitStart = pin.start_date;
    refs.happyGuyPrb2SubmitEnd = pin.end_date;
  } else if (row.id === 'prb2_review') {
    refs.happyGuyLastPrbReviewStartForOpdp = pin.start_date;
  } else if (row.id === 'submit_prb3') {
    const refIso = happyGuySubmitRefIsoFromCursor(cursorCal);
    refs.happyGuyPrb3AnchorWd = pickHappyGuySubmitAnchorWeekday(refIso, holidays);
    refs.happyGuyPrb3SubmitStart = pin.start_date;
    refs.happyGuyPrb3SubmitEnd = pin.end_date;
  } else if (row.id === 'prb3_review') {
    refs.happyGuyLastPrbReviewStartForOpdp = pin.start_date;
  }
}

export function happyGuyAdjustEffectiveForDevelopmentDevGap(
  timingProfile: ScenarioTactic,
  allow: boolean,
  row: ScenarioStepDef,
  holidays: HolidaySet,
  allowMap: Readonly<Record<string, boolean>> | undefined,
  modSum: number,
  effective: number,
  refs: HappyGuyPrbRefs,
): number | { ok: false; error: string } {
  const devPrbRow =
    row.id === 'development_prb1' || row.id === 'development_prb2' || row.id === 'development_prb3';
  const useHappyGuyWeekAlignedDevGap =
    usesHappyGuyWeekAlignedPrbCadence(timingProfile) && !allow && devPrbRow;
  if (!useHappyGuyWeekAlignedDevGap) return effective;

  let submitAnchor: string | null = null;
  let submitEnd: string | null = null;
  let reviewPhaseId: 'prb1_review' | 'prb2_review' | 'prb3_review';
  let roundAnchorWd: HappyGuyPrbSubmitAnchorWeekday | null = null;
  let errEarly: string | null = null;
  if (row.id === 'development_prb1') {
    submitAnchor = refs.happyGuyPrb1SubmitStart;
    submitEnd = refs.happyGuyPrb1SubmitEnd;
    reviewPhaseId = 'prb1_review';
    roundAnchorWd = refs.happyGuyPrb1AnchorWd;
    errEarly = 'PRB1 development scheduled before PRB1 submit (internal error).';
  } else if (row.id === 'development_prb2') {
    submitAnchor = refs.happyGuyPrb2SubmitStart;
    submitEnd = refs.happyGuyPrb2SubmitEnd;
    reviewPhaseId = 'prb2_review';
    roundAnchorWd = refs.happyGuyPrb2AnchorWd;
    errEarly = 'PRB2 development scheduled before PRB2 submit (internal error).';
  } else {
    submitAnchor = refs.happyGuyPrb3SubmitStart;
    submitEnd = refs.happyGuyPrb3SubmitEnd;
    reviewPhaseId = 'prb3_review';
    roundAnchorWd = refs.happyGuyPrb3AnchorWd;
    errEarly = 'PRB3 development scheduled before PRB3 submit (internal error).';
  }
  if (!submitAnchor || !submitEnd || !roundAnchorWd) {
    return { ok: false, error: errEarly! };
  }
  const idealReviewCal = addCalendarDaysUTC(submitAnchor, 7);
  const reviewAllow = linearAllowNonWorkingFor(reviewPhaseId, allowMap);
  const reviewResolved = resolveHappyGuyPrbReviewStart(
    idealReviewCal,
    roundAnchorWd,
    holidays,
    reviewAllow,
  );
  let gapStart = nextWorkingDay(addCalendarDaysUTC(submitEnd, 1), holidays);
  const gapEnd = previousWorkingDayOnOrBefore(addCalendarDaysUTC(reviewResolved.iso, -1), holidays);
  if (parseIsoDateUTC(gapStart).getTime() > parseIsoDateUTC(gapEnd).getTime()) {
    gapStart = gapEnd;
  }
  const rawSpan = Math.max(1, inclusiveWorkingDaySpan(gapStart, gapEnd, holidays));
  const bumped = linearClampDays(rawSpan + modSum, row);
  return Math.min(bumped, rawSpan);
}

const HG_PRB_PLACE_IDS = new Set([
  'submit_prb1',
  'prb1_review',
  'submit_prb2',
  'prb2_review',
  'submit_prb3',
  'prb3_review',
]);

export function happyGuyTryPlaceWeekAlignedPrbRow(
  timingProfile: ScenarioTactic,
  allow: boolean,
  row: ScenarioStepDef,
  cursorCal: string,
  holidays: HolidaySet,
  allowMap: Readonly<Record<string, boolean>> | undefined,
  effective: number,
  noteOut: string,
  refs: HappyGuyPrbRefs,
  steps: HalTimelineStep[],
): { placed: true; nextCursorCal: string } | { placed: false } | { ok: false; error: string } {
  const useHappyGuyWeekAlignedCadence =
    usesHappyGuyWeekAlignedPrbCadence(timingProfile) &&
    !allow &&
    HG_PRB_PLACE_IDS.has(row.id);
  if (!useHappyGuyWeekAlignedCadence) return { placed: false };

  const phaseAllow = linearAllowNonWorkingFor(row.id, allowMap);
  if (row.id === 'submit_prb1') {
    const refIso = happyGuySubmitRefIsoFromCursor(cursorCal);
    const anchorWd = pickHappyGuySubmitAnchorWeekday(refIso, holidays);
    refs.happyGuyPrb1AnchorWd = anchorWd;
    const raw =
      anchorWd === 'tuesday'
        ? firstWorkingTuesdayOnOrAfter(refIso, holidays)
        : firstWorkingThursdayOnOrAfter(refIso, holidays);
    const resolved = resolvePrbAnchorDay(raw, holidays, phaseAllow);
    const start = resolved.iso;
    const end = addWorkingDaysUTC(start, effective - 1, holidays);
    refs.happyGuyPrb1SubmitStart = start;
    refs.happyGuyPrb1SubmitEnd = end;
    steps.push(
      linearStepPayload(
        row.label,
        start,
        end,
        noteOut,
        linearPrbStepAllowNonWorking(phaseAllow, start, holidays, resolved.needsAllowNonWorkingFlag),
      ),
    );
    return { placed: true, nextCursorCal: addCalendarDaysUTC(end, 1) };
  }
  if (row.id === 'prb1_review') {
    if (!refs.happyGuyPrb1SubmitStart || !refs.happyGuyPrb1AnchorWd) {
      return { ok: false, error: 'PRB1 review scheduled before PRB1 submit (internal error).' };
    }
    const idealReviewCal = addCalendarDaysUTC(refs.happyGuyPrb1SubmitStart, 7);
    const resolved = resolveHappyGuyPrbReviewStart(
      idealReviewCal,
      refs.happyGuyPrb1AnchorWd,
      holidays,
      phaseAllow,
    );
    const start = resolved.iso;
    const end = addWorkingDaysUTC(start, effective - 1, holidays);
    refs.happyGuyLastPrbReviewStartForOpdp = start;
    steps.push(
      linearStepPayload(
        row.label,
        start,
        end,
        noteOut,
        linearPrbStepAllowNonWorking(phaseAllow, start, holidays, resolved.needsAllowNonWorkingFlag),
      ),
    );
    return { placed: true, nextCursorCal: addCalendarDaysUTC(end, 1) };
  }
  if (row.id === 'submit_prb2') {
    const refIso = happyGuySubmitRefIsoFromCursor(cursorCal);
    const anchorWd = pickHappyGuySubmitAnchorWeekday(refIso, holidays);
    refs.happyGuyPrb2AnchorWd = anchorWd;
    const raw =
      anchorWd === 'tuesday'
        ? firstWorkingTuesdayOnOrAfter(refIso, holidays)
        : firstWorkingThursdayOnOrAfter(refIso, holidays);
    const resolved = resolvePrbAnchorDay(raw, holidays, phaseAllow);
    const start = resolved.iso;
    const end = addWorkingDaysUTC(start, effective - 1, holidays);
    refs.happyGuyPrb2SubmitStart = start;
    refs.happyGuyPrb2SubmitEnd = end;
    steps.push(
      linearStepPayload(
        row.label,
        start,
        end,
        noteOut,
        linearPrbStepAllowNonWorking(phaseAllow, start, holidays, resolved.needsAllowNonWorkingFlag),
      ),
    );
    return { placed: true, nextCursorCal: addCalendarDaysUTC(end, 1) };
  }
  if (row.id === 'prb2_review') {
    if (!refs.happyGuyPrb2SubmitStart || !refs.happyGuyPrb2AnchorWd) {
      return { ok: false, error: 'PRB2 review scheduled before PRB2 submit (internal error).' };
    }
    const idealReviewCal = addCalendarDaysUTC(refs.happyGuyPrb2SubmitStart, 7);
    const resolved = resolveHappyGuyPrbReviewStart(
      idealReviewCal,
      refs.happyGuyPrb2AnchorWd,
      holidays,
      phaseAllow,
    );
    const start = resolved.iso;
    const end = addWorkingDaysUTC(start, effective - 1, holidays);
    refs.happyGuyLastPrbReviewStartForOpdp = start;
    steps.push(
      linearStepPayload(
        row.label,
        start,
        end,
        noteOut,
        linearPrbStepAllowNonWorking(phaseAllow, start, holidays, resolved.needsAllowNonWorkingFlag),
      ),
    );
    return { placed: true, nextCursorCal: addCalendarDaysUTC(end, 1) };
  }
  if (row.id === 'submit_prb3') {
    const refIso = happyGuySubmitRefIsoFromCursor(cursorCal);
    const anchorWd = pickHappyGuySubmitAnchorWeekday(refIso, holidays);
    refs.happyGuyPrb3AnchorWd = anchorWd;
    const raw =
      anchorWd === 'tuesday'
        ? firstWorkingTuesdayOnOrAfter(refIso, holidays)
        : firstWorkingThursdayOnOrAfter(refIso, holidays);
    const resolved = resolvePrbAnchorDay(raw, holidays, phaseAllow);
    const start = resolved.iso;
    const end = addWorkingDaysUTC(start, effective - 1, holidays);
    refs.happyGuyPrb3SubmitStart = start;
    refs.happyGuyPrb3SubmitEnd = end;
    steps.push(
      linearStepPayload(
        row.label,
        start,
        end,
        noteOut,
        linearPrbStepAllowNonWorking(phaseAllow, start, holidays, resolved.needsAllowNonWorkingFlag),
      ),
    );
    return { placed: true, nextCursorCal: addCalendarDaysUTC(end, 1) };
  }
  if (row.id === 'prb3_review') {
    if (!refs.happyGuyPrb3SubmitStart || !refs.happyGuyPrb3AnchorWd) {
      return { ok: false, error: 'PRB3 review scheduled before PRB3 submit (internal error).' };
    }
    const idealReviewCal = addCalendarDaysUTC(refs.happyGuyPrb3SubmitStart, 7);
    const resolved = resolveHappyGuyPrbReviewStart(
      idealReviewCal,
      refs.happyGuyPrb3AnchorWd,
      holidays,
      phaseAllow,
    );
    const start = resolved.iso;
    const end = addWorkingDaysUTC(start, effective - 1, holidays);
    refs.happyGuyLastPrbReviewStartForOpdp = start;
    steps.push(
      linearStepPayload(
        row.label,
        start,
        end,
        noteOut,
        linearPrbStepAllowNonWorking(phaseAllow, start, holidays, resolved.needsAllowNonWorkingFlag),
      ),
    );
    return { placed: true, nextCursorCal: addCalendarDaysUTC(end, 1) };
  }
  return { placed: false };
}

export function happyGuyTryPlaceWeekAlignedDevelopmentDevGapRow(
  timingProfile: ScenarioTactic,
  allow: boolean,
  row: ScenarioStepDef,
  holidays: HolidaySet,
  allowMap: Readonly<Record<string, boolean>> | undefined,
  effective: number,
  noteOut: string,
  refs: HappyGuyPrbRefs,
  steps: HalTimelineStep[],
): { placed: true; nextCursorCal: string } | { placed: false } | { ok: false; error: string } {
  const devPrbRow =
    row.id === 'development_prb1' || row.id === 'development_prb2' || row.id === 'development_prb3';
  const useHappyGuyWeekAlignedDevGap =
    usesHappyGuyWeekAlignedPrbCadence(timingProfile) && !allow && devPrbRow;
  if (!useHappyGuyWeekAlignedDevGap) return { placed: false };

  const roundWd =
    row.id === 'development_prb1'
      ? refs.happyGuyPrb1AnchorWd
      : row.id === 'development_prb2'
        ? refs.happyGuyPrb2AnchorWd
        : refs.happyGuyPrb3AnchorWd;
  const submitAnchor =
    row.id === 'development_prb1'
      ? refs.happyGuyPrb1SubmitStart!
      : row.id === 'development_prb2'
        ? refs.happyGuyPrb2SubmitStart!
        : refs.happyGuyPrb3SubmitStart!;
  const submitEnd =
    row.id === 'development_prb1'
      ? refs.happyGuyPrb1SubmitEnd!
      : row.id === 'development_prb2'
        ? refs.happyGuyPrb2SubmitEnd!
        : refs.happyGuyPrb3SubmitEnd!;
  const reviewPhaseId =
    row.id === 'development_prb1' ? 'prb1_review' : row.id === 'development_prb2' ? 'prb2_review' : 'prb3_review';
  if (!roundWd) {
    return { ok: false, error: 'PRB development gap missing HappyGuy submit anchor (internal error).' };
  }
  const idealReviewCal = addCalendarDaysUTC(submitAnchor, 7);
  const reviewResolved = resolveHappyGuyPrbReviewStart(
    idealReviewCal,
    roundWd,
    holidays,
    linearAllowNonWorkingFor(reviewPhaseId, allowMap),
  );
  let gapStart = nextWorkingDay(addCalendarDaysUTC(submitEnd, 1), holidays);
  const gapEnd = previousWorkingDayOnOrBefore(addCalendarDaysUTC(reviewResolved.iso, -1), holidays);
  if (parseIsoDateUTC(gapStart).getTime() > parseIsoDateUTC(gapEnd).getTime()) {
    gapStart = gapEnd;
  }
  const start = gapStart;
  const end = addWorkingDaysUTC(start, effective - 1, holidays);
  steps.push(linearStepPayload(row.label, start, end, noteOut, false));
  return { placed: true, nextCursorCal: addCalendarDaysUTC(end, 1) };
}

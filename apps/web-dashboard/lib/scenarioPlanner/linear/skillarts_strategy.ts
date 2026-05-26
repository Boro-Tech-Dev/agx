/**
 * SkillArts tiered PRB cadence (Thursday submit anchor, page-tier working days submit→review).
 */

import type { HalTimelineStep } from '../../halScenario';
import { addCalendarDaysUTC, parseIsoDateUTC } from '../dateCalendar';
import {
  firstWorkingThursdayOnOrAfter,
  resolvePrbAnchorDay,
} from '../prbWeekdayAnchors';
import type { ScenarioTactic } from '../tactics';
import { usesSkillArtsTieredPrbCadence } from '../timingProfiles';
import {
  addWorkingDaysUTC,
  inclusiveWorkingDaySpan,
  nextWorkingDay,
  previousWorkingDayOnOrBefore,
  type HolidaySet,
} from '../workingDays';
import type { ScenarioStepDef } from './types';
import { linearAllowNonWorkingFor, linearClampDays, linearPrbStepAllowNonWorking, linearStepPayload } from './scenario_linear_shared';

const SA_PRB_IDS = new Set([
  'submit_prb1',
  'prb1_review',
  'submit_prb2',
  'prb2_review',
  'submit_prb3',
  'prb3_review',
]);

export type SkillArtsPrbRefs = {
  skillArtsPrb1SubmitStart: string | null;
  skillArtsPrb1SubmitEnd: string | null;
  skillArtsPrb2SubmitStart: string | null;
  skillArtsPrb2SubmitEnd: string | null;
  skillArtsPrb3SubmitStart: string | null;
  skillArtsPrb3SubmitEnd: string | null;
};

export function skillArtsApplyPinnedPrefixPrbState(
  timingProfile: ScenarioTactic,
  allow: boolean,
  row: ScenarioStepDef,
  pin: HalTimelineStep,
  refs: SkillArtsPrbRefs,
): void {
  if (!usesSkillArtsTieredPrbCadence(timingProfile) || allow || !SA_PRB_IDS.has(row.id)) return;
  if (row.id === 'submit_prb1') {
    refs.skillArtsPrb1SubmitStart = pin.start_date;
    refs.skillArtsPrb1SubmitEnd = pin.end_date;
  } else if (row.id === 'submit_prb2') {
    refs.skillArtsPrb2SubmitStart = pin.start_date;
    refs.skillArtsPrb2SubmitEnd = pin.end_date;
  } else if (row.id === 'submit_prb3') {
    refs.skillArtsPrb3SubmitStart = pin.start_date;
    refs.skillArtsPrb3SubmitEnd = pin.end_date;
  }
}

export function skillArtsAdjustEffectiveForDevelopmentDevGap(
  timingProfile: ScenarioTactic,
  allow: boolean,
  row: ScenarioStepDef,
  holidays: HolidaySet,
  allowMap: Readonly<Record<string, boolean>> | undefined,
  modSum: number,
  effective: number,
  skillArtsTierSpan: number,
  refs: SkillArtsPrbRefs,
): number | { ok: false; error: string } {
  const devPrbRow =
    row.id === 'development_prb1' || row.id === 'development_prb2' || row.id === 'development_prb3';
  const useSkillArtsTieredDevGap =
    usesSkillArtsTieredPrbCadence(timingProfile) && !allow && devPrbRow;
  if (!useSkillArtsTieredDevGap) return effective;

  let submitAnchor: string | null = null;
  let submitEnd: string | null = null;
  let reviewPhaseId: 'prb1_review' | 'prb2_review' | 'prb3_review';
  let errEarly: string | null = null;
  if (row.id === 'development_prb1') {
    submitAnchor = refs.skillArtsPrb1SubmitStart;
    submitEnd = refs.skillArtsPrb1SubmitEnd;
    reviewPhaseId = 'prb1_review';
    errEarly = 'PRB1 development scheduled before PRB1 submit (internal error).';
  } else if (row.id === 'development_prb2') {
    submitAnchor = refs.skillArtsPrb2SubmitStart;
    submitEnd = refs.skillArtsPrb2SubmitEnd;
    reviewPhaseId = 'prb2_review';
    errEarly = 'PRB2 development scheduled before PRB2 submit (internal error).';
  } else {
    submitAnchor = refs.skillArtsPrb3SubmitStart;
    submitEnd = refs.skillArtsPrb3SubmitEnd;
    reviewPhaseId = 'prb3_review';
    errEarly = 'PRB3 development scheduled before PRB3 submit (internal error).';
  }
  if (!submitAnchor || !submitEnd) {
    return { ok: false, error: errEarly! };
  }
  const idealReview = addWorkingDaysUTC(submitAnchor, skillArtsTierSpan - 1, holidays);
  const reviewAllow = linearAllowNonWorkingFor(reviewPhaseId, allowMap);
  const reviewResolved = resolvePrbAnchorDay(idealReview, holidays, reviewAllow);
  let gapStart = nextWorkingDay(addCalendarDaysUTC(submitEnd, 1), holidays);
  const gapEnd = previousWorkingDayOnOrBefore(addCalendarDaysUTC(reviewResolved.iso, -1), holidays);
  if (parseIsoDateUTC(gapStart).getTime() > parseIsoDateUTC(gapEnd).getTime()) {
    gapStart = gapEnd;
  }
  const rawSpan = Math.max(1, inclusiveWorkingDaySpan(gapStart, gapEnd, holidays));
  const bumped = linearClampDays(rawSpan + modSum, row);
  return Math.min(bumped, rawSpan);
}

export function skillArtsTryPlaceTieredPrbRow(
  timingProfile: ScenarioTactic,
  allow: boolean,
  row: ScenarioStepDef,
  cursorCal: string,
  holidays: HolidaySet,
  allowMap: Readonly<Record<string, boolean>> | undefined,
  effective: number,
  noteOut: string,
  skillArtsTierSpan: number,
  refs: SkillArtsPrbRefs,
  steps: HalTimelineStep[],
): { placed: true; nextCursorCal: string } | { placed: false } | { ok: false; error: string } {
  const useSkillArtsTieredCadence =
    usesSkillArtsTieredPrbCadence(timingProfile) &&
    !allow &&
    SA_PRB_IDS.has(row.id);
  if (!useSkillArtsTieredCadence) return { placed: false };

  const phaseAllow = linearAllowNonWorkingFor(row.id, allowMap);

  if (row.id === 'submit_prb1') {
    const minStart = nextWorkingDay(cursorCal, holidays);
    const merged = minStart;
    const thuRaw = firstWorkingThursdayOnOrAfter(merged, holidays);
    const resolved = resolvePrbAnchorDay(thuRaw, holidays, phaseAllow);
    const start = resolved.iso;
    const end = addWorkingDaysUTC(start, effective - 1, holidays);
    refs.skillArtsPrb1SubmitStart = start;
    refs.skillArtsPrb1SubmitEnd = end;
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
    if (!refs.skillArtsPrb1SubmitStart) {
      return { ok: false, error: 'PRB1 review scheduled before PRB1 submit (internal error).' };
    }
    const idealReview = addWorkingDaysUTC(refs.skillArtsPrb1SubmitStart, skillArtsTierSpan - 1, holidays);
    const resolved = resolvePrbAnchorDay(idealReview, holidays, phaseAllow);
    const start = resolved.iso;
    const end = addWorkingDaysUTC(start, effective - 1, holidays);
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
    const minStart = nextWorkingDay(cursorCal, holidays);
    const merged = minStart;
    const thuRaw = firstWorkingThursdayOnOrAfter(merged, holidays);
    const resolved = resolvePrbAnchorDay(thuRaw, holidays, phaseAllow);
    const start = resolved.iso;
    const end = addWorkingDaysUTC(start, effective - 1, holidays);
    refs.skillArtsPrb2SubmitStart = start;
    refs.skillArtsPrb2SubmitEnd = end;
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
    if (!refs.skillArtsPrb2SubmitStart) {
      return { ok: false, error: 'PRB2 review scheduled before PRB2 submit (internal error).' };
    }
    const idealReview = addWorkingDaysUTC(refs.skillArtsPrb2SubmitStart, skillArtsTierSpan - 1, holidays);
    const resolved = resolvePrbAnchorDay(idealReview, holidays, phaseAllow);
    const start = resolved.iso;
    const end = addWorkingDaysUTC(start, effective - 1, holidays);
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
    const minStart = nextWorkingDay(cursorCal, holidays);
    const merged = minStart;
    const thuRaw = firstWorkingThursdayOnOrAfter(merged, holidays);
    const resolved = resolvePrbAnchorDay(thuRaw, holidays, phaseAllow);
    const start = resolved.iso;
    const end = addWorkingDaysUTC(start, effective - 1, holidays);
    refs.skillArtsPrb3SubmitStart = start;
    refs.skillArtsPrb3SubmitEnd = end;
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
    if (!refs.skillArtsPrb3SubmitStart) {
      return { ok: false, error: 'PRB3 review scheduled before PRB3 submit (internal error).' };
    }
    const idealReview = addWorkingDaysUTC(refs.skillArtsPrb3SubmitStart, skillArtsTierSpan - 1, holidays);
    const resolved = resolvePrbAnchorDay(idealReview, holidays, phaseAllow);
    const start = resolved.iso;
    const end = addWorkingDaysUTC(start, effective - 1, holidays);
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

export function skillArtsTryPlaceTieredDevelopmentDevGapRow(
  timingProfile: ScenarioTactic,
  allow: boolean,
  row: ScenarioStepDef,
  holidays: HolidaySet,
  allowMap: Readonly<Record<string, boolean>> | undefined,
  effective: number,
  noteOut: string,
  skillArtsTierSpan: number,
  refs: SkillArtsPrbRefs,
  steps: HalTimelineStep[],
): { placed: true; nextCursorCal: string } | { placed: false } {
  const devPrbRow =
    row.id === 'development_prb1' || row.id === 'development_prb2' || row.id === 'development_prb3';
  const useSkillArtsTieredDevGap =
    usesSkillArtsTieredPrbCadence(timingProfile) && !allow && devPrbRow;
  if (!useSkillArtsTieredDevGap) return { placed: false };

  const submitAnchor =
    row.id === 'development_prb1'
      ? refs.skillArtsPrb1SubmitStart!
      : row.id === 'development_prb2'
        ? refs.skillArtsPrb2SubmitStart!
        : refs.skillArtsPrb3SubmitStart!;
  const submitEnd =
    row.id === 'development_prb1'
      ? refs.skillArtsPrb1SubmitEnd!
      : row.id === 'development_prb2'
        ? refs.skillArtsPrb2SubmitEnd!
        : refs.skillArtsPrb3SubmitEnd!;
  const reviewPhaseId =
    row.id === 'development_prb1' ? 'prb1_review' : row.id === 'development_prb2' ? 'prb2_review' : 'prb3_review';
  const idealReview = addWorkingDaysUTC(submitAnchor, skillArtsTierSpan - 1, holidays);
  const reviewResolved = resolvePrbAnchorDay(
    idealReview,
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
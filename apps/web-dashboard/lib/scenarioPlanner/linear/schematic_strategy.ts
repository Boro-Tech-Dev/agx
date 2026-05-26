/**
 * Schematic / generic HCP MLR PRB cadence: Monday submit + second working Wednesday review (`prb_cadence: email_ml_r` in config).
 */

import type { HalTimelineStep } from '../../halScenario';
import { addCalendarDaysUTC, parseIsoDateUTC } from '../dateCalendar';
import {
  firstWorkingMondayOnOrAfter,
  resolvePrbAnchorDay,
  secondWorkingWednesdayAfterMondaySubmit,
} from '../prbWeekdayAnchors';
import type { ScenarioTactic } from '../tactics';
import { usesSchematicMlrPrbCadence } from '../timingProfiles';
import {
  addWorkingDaysUTC,
  inclusiveWorkingDaySpan,
  nextWorkingDay,
  previousWorkingDayOnOrBefore,
  type HolidaySet,
} from '../workingDays';
import type { ScenarioStepDef } from './types';
import { linearAllowNonWorkingFor, linearClampDays, linearPrbStepAllowNonWorking, linearStepPayload } from './scenario_linear_shared';

const MLR_PRB_IDS = new Set([
  'submit_prb1',
  'prb1_review',
  'submit_prb2',
  'prb2_review',
  'submit_prb3',
  'prb3_review',
]);

export type SchematicMlrPrbRefs = {
  emailPrb1SubmitMonday: string | null;
  emailPrb1SubmitEnd: string | null;
  emailPrb2SubmitMonday: string | null;
  emailPrb2SubmitEnd: string | null;
  emailPrb3SubmitMonday: string | null;
  emailPrb3SubmitEnd: string | null;
};

export function schematicMlrApplyPinnedPrefixPrbState(
  timingProfile: ScenarioTactic,
  allow: boolean,
  row: ScenarioStepDef,
  pin: HalTimelineStep,
  refs: SchematicMlrPrbRefs,
): void {
  if (!usesSchematicMlrPrbCadence(timingProfile) || allow || !MLR_PRB_IDS.has(row.id)) return;
  if (row.id === 'submit_prb1') {
    refs.emailPrb1SubmitMonday = pin.start_date;
    refs.emailPrb1SubmitEnd = pin.end_date;
  } else if (row.id === 'submit_prb2') {
    refs.emailPrb2SubmitMonday = pin.start_date;
    refs.emailPrb2SubmitEnd = pin.end_date;
  } else if (row.id === 'submit_prb3') {
    refs.emailPrb3SubmitMonday = pin.start_date;
    refs.emailPrb3SubmitEnd = pin.end_date;
  }
}

export function schematicMlrAdjustEffectiveForDevelopmentDevGap(
  timingProfile: ScenarioTactic,
  allow: boolean,
  row: ScenarioStepDef,
  holidays: HolidaySet,
  allowMap: Readonly<Record<string, boolean>> | undefined,
  modSum: number,
  effective: number,
  refs: SchematicMlrPrbRefs,
): number | { ok: false; error: string } {
  const devPrbRow =
    row.id === 'development_prb1' || row.id === 'development_prb2' || row.id === 'development_prb3';
  const useEmailPrbDevGap = usesSchematicMlrPrbCadence(timingProfile) && !allow && devPrbRow;
  if (!useEmailPrbDevGap) return effective;

  let submitMonday: string | null = null;
  let submitEnd: string | null = null;
  let reviewPhaseId: 'prb1_review' | 'prb2_review' | 'prb3_review';
  let errEarly: string | null = null;
  if (row.id === 'development_prb1') {
    submitMonday = refs.emailPrb1SubmitMonday;
    submitEnd = refs.emailPrb1SubmitEnd;
    reviewPhaseId = 'prb1_review';
    errEarly = 'PRB1 development scheduled before PRB1 submit (internal error).';
  } else if (row.id === 'development_prb2') {
    submitMonday = refs.emailPrb2SubmitMonday;
    submitEnd = refs.emailPrb2SubmitEnd;
    reviewPhaseId = 'prb2_review';
    errEarly = 'PRB2 development scheduled before PRB2 submit (internal error).';
  } else {
    submitMonday = refs.emailPrb3SubmitMonday;
    submitEnd = refs.emailPrb3SubmitEnd;
    reviewPhaseId = 'prb3_review';
    errEarly = 'PRB3 development scheduled before PRB3 submit (internal error).';
  }
  if (!submitMonday || !submitEnd) {
    return { ok: false, error: errEarly! };
  }
  const idealWed = secondWorkingWednesdayAfterMondaySubmit(submitMonday, holidays);
  const reviewAllow = linearAllowNonWorkingFor(reviewPhaseId, allowMap);
  const reviewResolved = resolvePrbAnchorDay(idealWed, holidays, reviewAllow);
  let gapStart = nextWorkingDay(addCalendarDaysUTC(submitEnd, 1), holidays);
  const gapEnd = previousWorkingDayOnOrBefore(addCalendarDaysUTC(reviewResolved.iso, -1), holidays);
  if (parseIsoDateUTC(gapStart).getTime() > parseIsoDateUTC(gapEnd).getTime()) {
    gapStart = gapEnd;
  }
  const rawSpan = Math.max(1, inclusiveWorkingDaySpan(gapStart, gapEnd, holidays));
  const bumped = linearClampDays(rawSpan + modSum, row);
  return Math.min(bumped, rawSpan);
}

export function schematicMlrTryPlacePrbRow(
  timingProfile: ScenarioTactic,
  allow: boolean,
  row: ScenarioStepDef,
  cursorCal: string,
  holidays: HolidaySet,
  allowMap: Readonly<Record<string, boolean>> | undefined,
  effective: number,
  noteOut: string,
  refs: SchematicMlrPrbRefs,
  steps: HalTimelineStep[],
): { placed: true; nextCursorCal: string } | { placed: false } | { ok: false; error: string } {
  const useEmailPrbCadence =
    usesSchematicMlrPrbCadence(timingProfile) &&
    !allow &&
    MLR_PRB_IDS.has(row.id);
  if (!useEmailPrbCadence) return { placed: false };

  const phaseAllow = linearAllowNonWorkingFor(row.id, allowMap);

  if (row.id === 'submit_prb1') {
    const minStart = nextWorkingDay(cursorCal, holidays);
    const merged = minStart;
    const monRaw = firstWorkingMondayOnOrAfter(merged, holidays);
    const resolved = resolvePrbAnchorDay(monRaw, holidays, phaseAllow);
    const start = resolved.iso;
    const end = addWorkingDaysUTC(start, effective - 1, holidays);
    refs.emailPrb1SubmitMonday = start;
    refs.emailPrb1SubmitEnd = end;
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
    if (!refs.emailPrb1SubmitMonday) {
      return { ok: false, error: 'PRB1 review scheduled before PRB1 submit (internal error).' };
    }
    const idealWed = secondWorkingWednesdayAfterMondaySubmit(refs.emailPrb1SubmitMonday, holidays);
    const resolved = resolvePrbAnchorDay(idealWed, holidays, phaseAllow);
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
    const monRaw = firstWorkingMondayOnOrAfter(merged, holidays);
    const resolved = resolvePrbAnchorDay(monRaw, holidays, phaseAllow);
    const start = resolved.iso;
    const end = addWorkingDaysUTC(start, effective - 1, holidays);
    refs.emailPrb2SubmitMonday = start;
    refs.emailPrb2SubmitEnd = end;
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
    if (!refs.emailPrb2SubmitMonday) {
      return { ok: false, error: 'PRB2 review scheduled before PRB2 submit (internal error).' };
    }
    const idealWed = secondWorkingWednesdayAfterMondaySubmit(refs.emailPrb2SubmitMonday, holidays);
    const resolved = resolvePrbAnchorDay(idealWed, holidays, phaseAllow);
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
    const monRaw = firstWorkingMondayOnOrAfter(merged, holidays);
    const resolved = resolvePrbAnchorDay(monRaw, holidays, phaseAllow);
    const start = resolved.iso;
    const end = addWorkingDaysUTC(start, effective - 1, holidays);
    refs.emailPrb3SubmitMonday = start;
    refs.emailPrb3SubmitEnd = end;
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
    if (!refs.emailPrb3SubmitMonday) {
      return { ok: false, error: 'PRB3 review scheduled before PRB3 submit (internal error).' };
    }
    const idealWed = secondWorkingWednesdayAfterMondaySubmit(refs.emailPrb3SubmitMonday, holidays);
    const resolved = resolvePrbAnchorDay(idealWed, holidays, phaseAllow);
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

export function schematicMlrTryPlaceDevelopmentDevGapRow(
  timingProfile: ScenarioTactic,
  allow: boolean,
  row: ScenarioStepDef,
  holidays: HolidaySet,
  allowMap: Readonly<Record<string, boolean>> | undefined,
  effective: number,
  noteOut: string,
  refs: SchematicMlrPrbRefs,
  steps: HalTimelineStep[],
): { placed: true; nextCursorCal: string } | { placed: false } {
  const devPrbRow =
    row.id === 'development_prb1' || row.id === 'development_prb2' || row.id === 'development_prb3';
  const useEmailPrbDevGap = usesSchematicMlrPrbCadence(timingProfile) && !allow && devPrbRow;
  if (!useEmailPrbDevGap) return { placed: false };

  const submitMonday =
    row.id === 'development_prb1'
      ? refs.emailPrb1SubmitMonday!
      : row.id === 'development_prb2'
        ? refs.emailPrb2SubmitMonday!
        : refs.emailPrb3SubmitMonday!;
  const submitEnd =
    row.id === 'development_prb1'
      ? refs.emailPrb1SubmitEnd!
      : row.id === 'development_prb2'
        ? refs.emailPrb2SubmitEnd!
        : refs.emailPrb3SubmitEnd!;
  const reviewPhaseId =
    row.id === 'development_prb1' ? 'prb1_review' : row.id === 'development_prb2' ? 'prb2_review' : 'prb3_review';
  const idealWed = secondWorkingWednesdayAfterMondaySubmit(submitMonday, holidays);
  const reviewResolved = resolvePrbAnchorDay(
    idealWed,
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

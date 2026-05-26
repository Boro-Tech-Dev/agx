import type { HalTimelineStep } from '../halScenario';
import opdpDef from '../../../../config/scenario_planner/steps_opdp_happyguy.json';
import { addCalendarDaysUTC } from './dateCalendar';
import { addWorkingDaysUTC, nextWorkingDay, type HolidaySet } from './workingDays';

type OpdpStepRow = {
  id: string;
  label: string;
  baseline_days: number;
  note: string;
};

const EMPTY_HOLIDAYS: HolidaySet = new Set();

function stepPayload(
  label: string,
  start: string,
  end: string,
  note: string,
): HalTimelineStep {
  return { task: label, start_date: start, end_date: end, note };
}

/** Parallel OPDP binder track (22 business days); anchored to first working day at or after `anchorStartIso`. */
export function computeOpdpBinderSteps(params: {
  anchorStartIso: string;
  holidays?: HolidaySet;
}): HalTimelineStep[] {
  const holidays = params.holidays ?? EMPTY_HOLIDAYS;
  const rows = (opdpDef as { steps: OpdpStepRow[] }).steps;
  let cursor = nextWorkingDay(params.anchorStartIso, holidays);
  const out: HalTimelineStep[] = [];
  for (const row of rows) {
    const bd = Math.max(1, row.baseline_days);
    const start = cursor;
    const end = addWorkingDaysUTC(start, bd - 1, holidays);
    out.push(stepPayload(row.label, start, end, row.note));
    cursor = nextWorkingDay(addCalendarDaysUTC(end, 1), holidays);
  }
  return out;
}

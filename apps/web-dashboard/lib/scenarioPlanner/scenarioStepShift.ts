import { addCalendarDaysUTC, calendarDaysOffset } from './dateCalendar';
import type { HalTimelineStep } from '../halScenario';

/** Shift both bounds by the same calendar-day delta (preserves inclusive span). */
export function shiftStepCalendarDays(step: HalTimelineStep, deltaDays: number): HalTimelineStep {
  if (deltaDays === 0) return { ...step };
  return {
    ...step,
    start_date: addCalendarDaysUTC(step.start_date, deltaDays),
    end_date: addCalendarDaysUTC(step.end_date, deltaDays),
  };
}

/** Move step so its start_date becomes `targetStartIso` (YYYY-MM-DD); preserves span. */
export function shiftStepToStartDate(step: HalTimelineStep, targetStartIso: string): HalTimelineStep {
  const delta = calendarDaysOffset(step.start_date, targetStartIso);
  return shiftStepCalendarDays(step, delta);
}

/** Shift this step and every step with index > fromIndex by the same delta. */
export function shiftStepAndFollowing(
  steps: HalTimelineStep[],
  fromIndex: number,
  deltaDays: number,
): HalTimelineStep[] {
  if (deltaDays === 0) return steps;
  return steps.map((s, i) => (i >= fromIndex ? shiftStepCalendarDays(s, deltaDays) : s));
}

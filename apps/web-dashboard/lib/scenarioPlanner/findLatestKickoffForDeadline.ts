import type { HalTimelineStep } from '../halScenario';
import { addCalendarDaysUTC, parseIsoDateUTC } from './dateCalendar';
import { computeScenarioSteps, type ComputeScenarioParams } from './computeScenarioSteps';
import type { LinearStepBreakdown } from './linear/types';
import { PHASE_CATALOG } from './phaseCatalog';

/** Search kickoffs from `deadline - SEARCH_WINDOW_DAYS` through `deadline` (inclusive). */
export const KICKOFF_DEADLINE_SEARCH_WINDOW_DAYS = 800;

export type FindLatestKickoffParams = Omit<ComputeScenarioParams, 'anchorStartIso'> & {
  deadlineIso: string;
  /** Phase whose step `end_date` must be on or before `deadlineIso`. */
  anchorPhaseId: string;
  /**
   * How far before `deadlineIso` to search for kickoffs (default {@link KICKOFF_DEADLINE_SEARCH_WINDOW_DAYS}).
   */
  searchWindowDays?: number;
};

function validateIso(iso: string, label: string): string | null {
  try {
    parseIsoDateUTC(iso);
    return null;
  } catch {
    return `${label} must be a valid YYYY-MM-DD date`;
  }
}

const MILESTONE_NOT_IN_SCHEDULE =
  'This milestone is not in the schedule for the selected complexity (PRB round count). Pick another milestone or a higher complexity.';

function milestoneEndForPhase(
  steps: HalTimelineStep[],
  breakdown: LinearStepBreakdown[],
  anchorPhaseId: string,
): { ok: true; end: string } | { ok: false; error: string } {
  const i = breakdown.findIndex((b) => b.phase_id === anchorPhaseId);
  if (i < 0) return { ok: false, error: MILESTONE_NOT_IN_SCHEDULE };
  const s = steps[i];
  if (!s) return { ok: false, error: MILESTONE_NOT_IN_SCHEDULE };
  return { ok: true, end: s.end_date };
}

function forwardParams(p: FindLatestKickoffParams, anchorStartIso: string): ComputeScenarioParams {
  return {
    tactic: p.tactic,
    timingProfile: p.timingProfile,
    anchorStartIso,
    complexity: p.complexity,
    clientReviewExtraCalendarDays: p.clientReviewExtraCalendarDays,
    holidays: p.holidays,
    phaseAllowNonWorkingDays: p.phaseAllowNonWorkingDays,
    activeModifierIds: p.activeModifierIds,
    pageCount: p.pageCount,
    catalogTacticKey: p.catalogTacticKey,
  };
}

/**
 * Latest kickoff (within the search window) such that the chosen phase's end is on or before the deadline.
 * Reuses {@link computeScenarioSteps}; binary search is valid because the linear planner is monotone in kickoff.
 */
export function findLatestKickoffForDeadline(
  p: FindLatestKickoffParams,
):
  | { ok: true; kickoffIso: string; steps: HalTimelineStep[]; breakdown: LinearStepBreakdown[] }
  | { ok: false; error: string } {
  const deadlineErr = validateIso(p.deadlineIso, 'Deadline');
  if (deadlineErr) return { ok: false, error: deadlineErr };

  if (!PHASE_CATALOG.some((r) => r.phase_id === p.anchorPhaseId)) {
    return { ok: false, error: 'Unknown milestone phase.' };
  }

  const windowDays = Math.min(
    3650,
    Math.max(1, p.searchWindowDays ?? KICKOFF_DEADLINE_SEARCH_WINDOW_DAYS),
  );
  const earliestKickoff = addCalendarDaysUTC(p.deadlineIso, -windowDays);
  const first = computeScenarioSteps(forwardParams(p, earliestKickoff));
  if (first.ok === false) return { ok: false, error: first.error };

  const endEarliestR = milestoneEndForPhase(first.steps, first.breakdown, p.anchorPhaseId);
  if (endEarliestR.ok === false) return { ok: false, error: endEarliestR.error };
  const endEarliest = endEarliestR.end;
  if (endEarliest > p.deadlineIso) {
    return {
      ok: false,
      error:
        'This deadline is too aggressive for the selected tactic and options, even with the earliest kickoff in the search window. Try a later deadline, a lighter tactic, fewer client-review extra days, or widen the kickoff search window.',
    };
  }

  let lo = 0;
  let hi = windowDays;
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    const kickoff = addCalendarDaysUTC(earliestKickoff, mid);
    const r = computeScenarioSteps(forwardParams(p, kickoff));
    if (r.ok === false) return { ok: false, error: r.error };
    const meR = milestoneEndForPhase(r.steps, r.breakdown, p.anchorPhaseId);
    if (meR.ok === false) return { ok: false, error: meR.error };
    const me = meR.end;
    if (me <= p.deadlineIso) lo = mid;
    else hi = mid - 1;
  }

  const kickoffIso = addCalendarDaysUTC(earliestKickoff, lo);
  const finalR = computeScenarioSteps(forwardParams(p, kickoffIso));
  if (finalR.ok === false) return { ok: false, error: finalR.error };
  return { ok: true, kickoffIso, steps: finalR.steps, breakdown: finalR.breakdown };
}

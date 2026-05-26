/**
 * Shared linear planner utilities (working days, step shape, modifiers, scaling).
 * Brand-specific PRB placement lives in schematic_strategy, happyguy_strategy, skillarts_strategy.
 */

import type { HalTimelineStep } from '../../halScenario';
import { parseIsoDateUTC } from '../dateCalendar';
import type { ScenarioComplexity } from '../complexity';
import { complexitySpanMultiplier } from '../complexity';
import type { ScenarioTactic } from '../tactics';
import { isPrbPhaseId } from '../phaseCatalog';
import { timingProfileMultForPhase } from '../timingProfiles';
import { isWorkingDay, type HolidaySet } from '../workingDays';
import { mergeModifierPhaseNotes, REGISTERED_MODIFIER_BUNDLES } from './modifierBundles';
import type { ScenarioStepDef } from './types';

export const LINEAR_EMPTY_HOLIDAYS: HolidaySet = new Set();

export function linearValidateIso(iso: string, label: string): string | null {
  try {
    parseIsoDateUTC(iso);
    return null;
  } catch {
    return `${label} must be a valid YYYY-MM-DD date`;
  }
}

export function linearAllowNonWorkingFor(
  phaseId: string,
  phaseAllowNonWorkingDays: Readonly<Record<string, boolean>> | undefined,
): boolean {
  return phaseAllowNonWorkingDays?.[phaseId] === true;
}

export function linearStepPayload(
  label: string,
  start: string,
  end: string,
  note: string,
  allowNonWorking: boolean,
): HalTimelineStep {
  const s: HalTimelineStep = { task: label, start_date: start, end_date: end, note };
  if (allowNonWorking) s.allow_non_working_days = true;
  return s;
}

export function linearClampDays(n: number, row: ScenarioStepDef): number {
  const lo = row.min_days ?? 1;
  const hi = row.max_days ?? Number.MAX_SAFE_INTEGER;
  return Math.max(lo, Math.min(hi, n));
}

export function linearScaledBaseline(
  row: ScenarioStepDef,
  timingProfile: ScenarioTactic,
  complexity: ScenarioComplexity,
): number {
  const b = row.baseline_days;
  if (isPrbPhaseId(row.id)) return b;
  const tacticMult = timingProfileMultForPhase(timingProfile, row.id);
  const complexityMult = complexitySpanMultiplier(complexity);
  return Math.max(1, Math.round(b * tacticMult * complexityMult));
}

export function linearMergeModifierDeltas(
  stepId: string,
  activeModifierIds: readonly string[],
): { sum: number; byId: Record<string, number> } {
  const byId: Record<string, number> = {};
  let sum = 0;
  for (const mid of activeModifierIds) {
    const bundle = REGISTERED_MODIFIER_BUNDLES[mid];
    if (!bundle) continue;
    const d = bundle.deltas[stepId];
    if (d === undefined || d === 0) continue;
    byId[mid] = d;
    sum += d;
  }
  return { sum, byId };
}

export function linearPrbStepAllowNonWorking(
  phaseAllows: boolean,
  iso: string,
  holidays: HolidaySet,
  needsFlagFromResolver: boolean,
): boolean {
  if (!phaseAllows) return false;
  if (needsFlagFromResolver) return true;
  return !isWorkingDay(iso, holidays);
}

export { mergeModifierPhaseNotes, REGISTERED_MODIFIER_BUNDLES };

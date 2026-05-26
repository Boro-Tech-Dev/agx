import {
  TIMING_PROFILE_IDS,
  resolveTimingProfileId,
  timingProfileLabel,
  type TimingProfileDef,
} from './timingProfiles';

/** Scheduling profile id from {@link config/scenario_planner/timing_profiles.json} (legacy name retained). */
export type ScenarioTactic = string;

export const SCENARIO_TACTICS = TIMING_PROFILE_IDS;

export function scenarioTacticLabel(t: ScenarioTactic): string {
  return timingProfileLabel(t);
}

export function isScenarioTacticString(v: unknown): v is ScenarioTactic {
  if (typeof v !== 'string') return false;
  const id = resolveTimingProfileId(v.trim());
  return (TIMING_PROFILE_IDS as readonly string[]).includes(id);
}

/** @internal */
export type { TimingProfileDef };

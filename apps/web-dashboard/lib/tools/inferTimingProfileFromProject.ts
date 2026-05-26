/**
 * Resolves timing profile from API-enriched project/brand rows.
 * Returns null when unknown — callers must not substitute generic_tactic silently.
 */

import {
  isKnownTimingProfile,
  resolveTimingProfileId,
  type ProjectHierarchyKeys,
} from '../scenarioPlanner/timingProfiles';
import type { ScenarioTactic } from '../scenarioPlanner/tactics';

export type { ProjectHierarchyKeys } from '../scenarioPlanner/timingProfiles';
export {
  inferClientFamilyForPlanner,
  timingProfileIdsForScenarioPlanner,
} from '../scenarioPlanner/timingProfiles';
export type { PlannerClientFamily } from '../scenarioPlanner/timingProfiles';

export type TimingProfileResolvableRow = ProjectHierarchyKeys & {
  resolved_timing_profile?: string | null;
  timing_profile_id?: string | null;
  brand_timing_profile_id?: string | null;
};

/**
 * Returns a known timing profile id from API `resolved_timing_profile`, or null.
 */
export function inferTimingProfileFromProject(
  row: TimingProfileResolvableRow | null | undefined,
): ScenarioTactic | null {
  if (!row) return null;
  const raw = row.resolved_timing_profile ?? row.timing_profile_id ?? null;
  if (raw == null || !String(raw).trim()) return null;
  const id = resolveTimingProfileId(String(raw).trim());
  return isKnownTimingProfile(id) ? (id as ScenarioTactic) : null;
}

/** @deprecated Session overrides only; DB is source of truth. Kept for tests migrating off localStorage. */
export const TIMING_PROFILE_STORAGE_PREFIX = 'dd.tools.timingProfile';

export function readStoredTimingProfileForProject(_projectKey: string): ScenarioTactic | null {
  return null;
}

export function writeStoredTimingProfileForProject(_projectKey: string, _profileId: ScenarioTactic): void {
  /* no-op: cadence persisted on brand/project via API */
}

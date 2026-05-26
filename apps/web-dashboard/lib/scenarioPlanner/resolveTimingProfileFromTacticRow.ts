/**
 * Resolves which timing profile (client PRB cadence) applies to a tactic library row.
 * Order: DB metadata → repo tactic_library catalog by key → project workspace/client inference.
 * Never substitutes another client's cadence when all three are missing (returns null).
 */

import tacticCatalog from '../../config/tactic_library/catalog.json';
import { timingProfileFromLibraryMetadata } from '../omnichannelPlanner/planModel';
import {
  inferTimingProfileFromProject,
  type ProjectHierarchyKeys,
} from '../tools/inferTimingProfileFromProject';
import type { ScenarioTactic } from './tactics';
import { isKnownTimingProfile, resolveTimingProfileId } from './timingProfiles';

type CatalogEntry = { key?: string; timing_profile?: string };

const CATALOG_TIMING_BY_KEY: ReadonlyMap<string, string> = (() => {
  const m = new Map<string, string>();
  const tactics = (tacticCatalog as { tactics?: CatalogEntry[] }).tactics ?? [];
  for (const t of tactics) {
    const k = typeof t.key === 'string' ? t.key.trim() : '';
    const tp = typeof t.timing_profile === 'string' ? t.timing_profile.trim() : '';
    if (k && tp) m.set(k, tp);
  }
  return m;
})();

/** Timing profile id from `config/tactic_library/catalog.json` tactic key, if present and known. */
export function timingProfileFromCatalogTacticKey(tacticKey: string): ScenarioTactic | null {
  const raw = CATALOG_TIMING_BY_KEY.get(tacticKey.trim());
  if (!raw) return null;
  const id = resolveTimingProfileId(raw);
  return isKnownTimingProfile(id) ? id : null;
}

export function resolveTimingProfileFromTacticLibraryRow(
  libRow: Record<string, unknown> | null | undefined,
  project: ProjectHierarchyKeys | null | undefined,
): ScenarioTactic | null {
  if (!libRow) return inferTimingProfileFromProject(project ?? null);

  const fromMeta = timingProfileFromLibraryMetadata(libRow.metadata);
  if (fromMeta) {
    const id = resolveTimingProfileId(fromMeta);
    if (isKnownTimingProfile(id)) return id as ScenarioTactic;
  }

  const key = typeof libRow.key === 'string' ? libRow.key.trim() : '';
  if (key) {
    const fromCat = timingProfileFromCatalogTacticKey(key);
    if (fromCat) return fromCat;
  }

  return inferTimingProfileFromProject(project ?? null);
}

/** Merge DB `tactic_metadata` with legacy top-level `scenario_tactic` when present. */
function projectTacticMetadataForTiming(pt: Record<string, unknown>): unknown {
  const tm = pt.tactic_metadata;
  const base =
    tm && typeof tm === 'object' && !Array.isArray(tm)
      ? { ...(tm as Record<string, unknown>) }
      : {};
  const topSt = pt.scenario_tactic;
  if (typeof topSt === 'string' && topSt.trim()) {
    base.scenario_tactic = topSt.trim();
  }
  return Object.keys(base).length ? base : null;
}

/** Row shape from `GET /api/projects/{key}/tactics` (project tactic attachment). */
export function resolveTimingProfileFromProjectTacticRow(
  pt: Record<string, unknown>,
  project: ProjectHierarchyKeys | null | undefined,
): ScenarioTactic | null {
  const fromMeta = timingProfileFromLibraryMetadata(projectTacticMetadataForTiming(pt));
  if (fromMeta) {
    const id = resolveTimingProfileId(fromMeta);
    if (isKnownTimingProfile(id)) return id as ScenarioTactic;
  }

  const key = typeof pt.tactic_key === 'string' ? pt.tactic_key.trim() : '';
  if (key) {
    const fromCat = timingProfileFromCatalogTacticKey(key);
    if (fromCat) return fromCat;
  }

  return inferTimingProfileFromProject(project ?? null);
}

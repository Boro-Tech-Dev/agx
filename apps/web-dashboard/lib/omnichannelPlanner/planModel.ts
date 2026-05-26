import {
  isScenarioTacticString,
  type ScenarioTactic,
} from '../scenarioPlanner/tactics';
import { resolveTimingProfileId } from '../scenarioPlanner/timingProfiles';
import { OMNICHANNEL_PLAN_VERSION, type OmnichannelPlan, type OmnichannelPlanRow } from './types';

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** Read optional timing profile from tactics library `metadata` JSONB (preferred over legacy `scenario_tactic`). */
export function timingProfileFromLibraryMetadata(meta: unknown): ScenarioTactic | null {
  if (!meta || typeof meta !== 'object') return null;
  const m = meta as { timing_profile?: unknown; scenario_tactic?: unknown };
  const tp = m.timing_profile;
  if (isScenarioTacticString(tp)) return resolveTimingProfileId(String(tp).trim()) as ScenarioTactic;
  const st = m.scenario_tactic;
  return isScenarioTacticString(st) ? (resolveTimingProfileId(String(st).trim()) as ScenarioTactic) : null;
}

/** @deprecated Use {@link timingProfileFromLibraryMetadata}. */
export function scenarioTacticFromLibraryMetadata(meta: unknown): ScenarioTactic | null {
  return timingProfileFromLibraryMetadata(meta);
}

export function createEmptyPlan(projectKey: string): OmnichannelPlan {
  return { version: OMNICHANNEL_PLAN_VERSION, project_key: projectKey, rows: [] };
}

export function normalizePlanOrders(rows: OmnichannelPlanRow[]): OmnichannelPlanRow[] {
  const sorted = [...rows].sort((a, b) => a.order - b.order);
  return sorted.map((r, i) => ({ ...r, order: i }));
}

export function moveRow(rows: OmnichannelPlanRow[], rowId: string, dir: -1 | 1): OmnichannelPlanRow[] {
  const ordered = normalizePlanOrders(rows);
  const idx = ordered.findIndex((r) => r.id === rowId);
  if (idx < 0) return ordered;
  const j = idx + dir;
  if (j < 0 || j >= ordered.length) return ordered;
  const next = [...ordered];
  [next[idx], next[j]] = [next[j]!, next[idx]!];
  return next.map((r, i) => ({ ...r, order: i }));
}

export type PlanValidationResult = { ok: true; plan: OmnichannelPlan } | { ok: false; errors: string[] };

export function parseUnknownPlan(raw: unknown, expectedProjectKey: string): PlanValidationResult {
  const errors: string[] = [];
  if (!raw || typeof raw !== 'object') {
    return { ok: false, errors: ['Plan must be a JSON object'] };
  }
  const o = raw as Record<string, unknown>;
  if (o.version !== OMNICHANNEL_PLAN_VERSION) {
    errors.push(`version must be ${OMNICHANNEL_PLAN_VERSION}`);
  }
  if (typeof o.project_key !== 'string' || !o.project_key.trim()) {
    errors.push('project_key must be a non-empty string');
  } else if (o.project_key !== expectedProjectKey) {
    errors.push(`project_key must match current project (${expectedProjectKey})`);
  }
  if (!Array.isArray(o.rows)) {
    errors.push('rows must be an array');
    return { ok: false, errors };
  }

  const rows: OmnichannelPlanRow[] = [];
  for (let i = 0; i < o.rows.length; i++) {
    const row = o.rows[i];
    if (!row || typeof row !== 'object') {
      errors.push(`rows[${i}]: must be an object`);
      continue;
    }
    const r = row as Record<string, unknown>;
    if (typeof r.id !== 'string' || !r.id.trim()) {
      errors.push(`rows[${i}]: id required`);
    }
    if (typeof r.order !== 'number' || !Number.isFinite(r.order)) {
      errors.push(`rows[${i}]: order must be a number`);
    }
    if (typeof r.tactic_library_id !== 'string' || !UUID_RE.test(r.tactic_library_id)) {
      errors.push(`rows[${i}]: tactic_library_id must be a UUID`);
    }
    const tpRaw = r.timing_profile;
    const stRaw = r.scenario_tactic;
    const timingRaw = tpRaw ?? stRaw;
    if (timingRaw != null && timingRaw !== '' && !isScenarioTacticString(String(timingRaw).trim())) {
      errors.push(`rows[${i}]: invalid timing_profile / scenario_tactic`);
      continue;
    }
    rows.push({
      id: String(r.id),
      order: Number(r.order),
      tactic_library_id: String(r.tactic_library_id),
      tactic_key: typeof r.tactic_key === 'string' ? r.tactic_key : undefined,
      label_snapshot: typeof r.label_snapshot === 'string' ? r.label_snapshot : undefined,
      timing_profile:
        tpRaw != null && tpRaw !== '' && typeof tpRaw === 'string'
          ? (resolveTimingProfileId(tpRaw.trim()) as ScenarioTactic)
          : undefined,
      scenario_tactic:
        stRaw == null || stRaw === ''
          ? null
          : typeof stRaw === 'string'
            ? (resolveTimingProfileId(stRaw.trim()) as ScenarioTactic)
            : null,
      notes: typeof r.notes === 'string' ? r.notes : undefined,
      metadata: r.metadata && typeof r.metadata === 'object' ? (r.metadata as Record<string, unknown>) : undefined,
    });
  }

  if (errors.length) return { ok: false, errors };

  const plan: OmnichannelPlan = {
    version: OMNICHANNEL_PLAN_VERSION,
    project_key: String(o.project_key),
    rows: normalizePlanOrders(rows),
  };
  return { ok: true, plan };
}

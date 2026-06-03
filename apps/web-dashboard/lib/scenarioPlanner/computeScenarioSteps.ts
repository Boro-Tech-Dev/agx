import type { HalTimelineStep } from '../halScenario';
import type { ScenarioComplexity } from './complexity';
import type { ScenarioTactic } from './tactics';
import type { HolidaySet } from './workingDays';
import {
  computeLinearScenarioSteps,
  type ComputeLinearScenarioParams,
} from './linear/computeLinearScenarioSteps';
import type { LinearStepBreakdown } from './linear/types';
import { isKnownTimingProfile, resolveTimingProfileId } from './timingProfiles';

/** Kept for typing external callers; ignored by the linear engine. */
export type PrbAnchorPolicy = 'legacy' | 'mon_wed';

export type PrbBrandConfig = {
  mode: 'from_shifted_baseline' | 'explicit_submits';
  prb1SubmitIso?: string;
  prb2SubmitIso?: string;
  /** When mode is explicit_submits and omitted, PRB3 follows shifted baseline. */
  prb3SubmitIso?: string;
};

export type ComputeScenarioParams = {
  anchorStartIso: string;
  /** Preferred id from `config/scenario_planner/timing_profiles.json`. */
  timingProfile?: ScenarioTactic;
  /** @deprecated Alias for {@link timingProfile} (API/worker backward compat). */
  tactic?: ScenarioTactic;
  complexity?: ScenarioComplexity;
  clientReviewExtraCalendarDays?: number;
  holidays?: HolidaySet;
  phaseAllowNonWorkingDays?: Readonly<Record<string, boolean>>;
  /** Unused hook (HCP MLR PRB cadence is fixed inside the linear planner). */
  prbAnchorPolicy?: PrbAnchorPolicy;
  /** Unused hook (planner uses shifted-baseline PRB Mondays). */
  prbBrand?: PrbBrandConfig;
  /** Stackable config modifiers (`config/scenario_planner/tactics/<id>.json`). */
  activeModifierIds?: readonly string[];
  /** Page count for SkillArts tiered PRB profile (`skillarts_generic`). */
  pageCount?: number;
  /** Tactic library catalog key; selects variant spines for shared timing profiles (e.g. AASLD wifi splash). */
  catalogTacticKey?: string;
  /** Suffix recompute: pin `0..freezeAfterStepIndex` from {@link pinnedPrefixSteps}, then place the rest. */
  freezeAfterStepIndex?: number;
  pinnedPrefixSteps?: readonly HalTimelineStep[];
};

export type ComputeScenarioResult =
  | {
      ok: true;
      steps: HalTimelineStep[];
      breakdown: LinearStepBreakdown[];
      opdp_binder_steps?: HalTimelineStep[];
    }
  | { ok: false; error: string };

function resolveTimingProfileInput(p: ComputeScenarioParams): string | null {
  const raw = (p.timingProfile ?? p.tactic ?? 'generic_tactic').trim();
  const id = resolveTimingProfileId(raw);
  return isKnownTimingProfile(id) ? id : null;
}

export function computeScenarioSteps(p: ComputeScenarioParams): ComputeScenarioResult {
  const tp = resolveTimingProfileInput(p);
  if (tp == null) {
    const raw = p.timingProfile ?? p.tactic ?? '';
    return { ok: false, error: `Unknown timing profile: ${raw || '(empty)'}` };
  }
  const linearParams: ComputeLinearScenarioParams = {
    anchorStartIso: p.anchorStartIso,
    timingProfile: tp,
    complexity: p.complexity,
    clientReviewExtraCalendarDays: p.clientReviewExtraCalendarDays,
    holidays: p.holidays,
    phaseAllowNonWorkingDays: p.phaseAllowNonWorkingDays,
    activeModifierIds: p.activeModifierIds,
    pageCount: p.pageCount,
    freezeAfterStepIndex: p.freezeAfterStepIndex,
    pinnedPrefixSteps: p.pinnedPrefixSteps,
    catalogTacticKey: p.catalogTacticKey,
  };
  const r = computeLinearScenarioSteps(linearParams);
  if (!r.ok) return r;
  if (r.opdp_binder_steps?.length) {
    return {
      ok: true,
      steps: r.steps,
      breakdown: r.breakdown,
      opdp_binder_steps: r.opdp_binder_steps,
    };
  }
  return { ok: true, steps: r.steps, breakdown: r.breakdown };
}

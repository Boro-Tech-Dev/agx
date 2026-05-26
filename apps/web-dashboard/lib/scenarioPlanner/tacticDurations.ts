import { getTimingProfile, timingProfileMultForPhase } from './timingProfiles';

/** @deprecated Use {@link timingProfileMultForPhase} with a timing profile id from config. */
export function tacticMultForPhase(timingProfileId: string, phaseId: string): number {
  return timingProfileMultForPhase(timingProfileId, phaseId);
}

/** Build a Record suitable for callers that still expect tactic-keyed maps (tests, tooling). */
export function nonPrbMultiplierMapForProfile(timingProfileId: string): Record<string, number> {
  const p = getTimingProfile(timingProfileId);
  return p ? { ...p.non_prb_multipliers } : {};
}

/** Phases treated as “client review” for optional extra calendar days. */
export const CLIENT_REVIEW_SCENARIO_PHASE_IDS: ReadonlySet<string> = new Set([
  'client_review_1_manuscript',
  'client_review_2_layout',
  'client_review_3_submission_prep',
  'share_client_approval_prb1',
  'client_share_prb1_revisions',
  'share_client_approval_prb2',
  'share_client_approval_prb3',
  'client_approval_final_submit',
]);

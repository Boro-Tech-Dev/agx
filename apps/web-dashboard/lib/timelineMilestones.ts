/**
 * Timeline items mapped from the editorial phase catalog → milestone groups for UI (calendar + table).
 */

export type TimelineMilestoneKind =
  | 'kickoff_vendor'
  | 'client_review'
  | 'internal_review'
  | 'prb_submission'
  | 'development_days'
  | 'prb_review'
  | 'prb_prep';

const CLIENT_REVIEW_PHASE_IDS = new Set<string>([
  'client_review_1_manuscript',
  'client_review_2_layout',
  'client_review_3_submission_prep',
  'share_client_approval_prb1',
  'client_share_prb1_revisions',
  'share_client_approval_prb2',
  'share_client_approval_prb3',
  'client_approval_final_submit',
]);

const PRB_SUBMISSION_PHASE_IDS = new Set<string>(['submit_prb1', 'submit_prb2', 'submit_prb3']);

/** Calendar days between PRB submit Monday and the anchored PRB review (HCP MLR / generic tactic profile). */
const DEVELOPMENT_PHASE_IDS = new Set<string>([
  'development_prb1',
  'development_prb2',
  'development_prb3',
]);

const PRB_REVIEW_PHASE_IDS = new Set<string>(['prb1_review', 'prb2_review', 'prb3_review']);

const PRB_PREP_PHASE_IDS = new Set<string>(['prb_prep']);

/** Manuscript/layout internal reviews (and legacy `internal_review` id). */
function isInternalReviewPhaseId(phaseId: string): boolean {
  return phaseId === 'internal_review' || phaseId.startsWith('internal_review_');
}

const KICKOFF_VENDOR_PHASE_IDS = new Set<string>(['kickoff', 'release_assets_vendors']);

export function timelineMilestoneKind(phaseId: string | undefined | null): TimelineMilestoneKind | null {
  if (!phaseId || typeof phaseId !== 'string') return null;
  if (KICKOFF_VENDOR_PHASE_IDS.has(phaseId)) return 'kickoff_vendor';
  if (CLIENT_REVIEW_PHASE_IDS.has(phaseId)) return 'client_review';
  if (isInternalReviewPhaseId(phaseId)) return 'internal_review';
  if (PRB_SUBMISSION_PHASE_IDS.has(phaseId)) return 'prb_submission';
  if (DEVELOPMENT_PHASE_IDS.has(phaseId)) return 'development_days';
  if (PRB_REVIEW_PHASE_IDS.has(phaseId)) return 'prb_review';
  if (PRB_PREP_PHASE_IDS.has(phaseId)) return 'prb_prep';
  return null;
}

/**
 * Phases shown when the gantt/timeline "milestones only" filter is on (reviews + PRB).
 * Kickoff / vendor release stay full-color in the default view but stay out of this sparse filter.
 */
export function isSparseTimelineMilestonePhase(phaseId: string | undefined | null): boolean {
  const k = timelineMilestoneKind(phaseId);
  if (!k) return false;
  return k !== 'kickoff_vendor';
}

/** Tailwind classes: border, background tint, accent text (calendar + chips). */
export const timelineMilestonePalette: Record<
  TimelineMilestoneKind,
  { border: string; bg: string; dot: string; row: string }
> = {
  kickoff_vendor: {
    border: 'border-fuchsia-500/50',
    bg: 'bg-fuchsia-500/15',
    dot: 'bg-fuchsia-400',
    row: 'border-l-2 border-l-fuchsia-500/70',
  },
  client_review: {
    border: 'border-amber-500/50',
    bg: 'bg-amber-500/15',
    dot: 'bg-amber-400',
    row: 'border-l-2 border-l-amber-500/70',
  },
  internal_review: {
    border: 'border-rose-500/50',
    bg: 'bg-rose-500/15',
    dot: 'bg-rose-400',
    row: 'border-l-2 border-l-rose-500/70',
  },
  prb_submission: {
    border: 'border-violet-500/50',
    bg: 'bg-violet-500/15',
    dot: 'bg-violet-400',
    row: 'border-l-2 border-l-violet-500/70',
  },
  development_days: {
    border: 'border-lime-500/50',
    bg: 'bg-lime-500/15',
    dot: 'bg-lime-400',
    row: 'border-l-2 border-l-lime-500/70',
  },
  prb_review: {
    border: 'border-blue-500/50',
    bg: 'bg-blue-500/15',
    dot: 'bg-blue-400',
    row: 'border-l-2 border-l-blue-500/70',
  },
  prb_prep: {
    border: 'border-sky-500/50',
    bg: 'bg-sky-500/15',
    dot: 'bg-sky-400',
    row: 'border-l-2 border-l-sky-500/70',
  },
};

export const timelineMilestoneLegend: { kind: TimelineMilestoneKind; label: string }[] = [
  { kind: 'kickoff_vendor', label: 'Kickoff & release to vendors' },
  { kind: 'client_review', label: 'Client reviews' },
  { kind: 'internal_review', label: 'Internal reviews' },
  { kind: 'prb_submission', label: 'PRB submissions' },
  { kind: 'development_days', label: 'Development days' },
  { kind: 'prb_review', label: 'PRB reviews' },
  { kind: 'prb_prep', label: 'PRB prep' },
];

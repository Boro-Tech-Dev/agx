/**
 * Canonical editorial phases — must stay aligned with
 * apps/ingestion-worker/ingestion/timeline_phase_catalog.py PHASE_ROWS.
 */

export type PhaseCatalogRow = {
  phase_id: string;
  label: string;
  order: number;
};

/** Ordered phases — duplicate human labels use unique phase_id. */
export const PHASE_CATALOG: PhaseCatalogRow[] = [
  { phase_id: 'kickoff', label: 'Kickoff', order: 1 },
  { phase_id: 'manuscript_development', label: 'Manuscript development', order: 2 },
  {
    phase_id: 'internal_review_manuscript',
    label: 'Internal Review - Manuscript',
    order: 3,
  },
  {
    phase_id: 'revisions_post_internal_manuscript',
    label: 'Manuscript Revisions',
    order: 4,
  },
  {
    phase_id: 'client_review_1_manuscript',
    label: 'Client Review 1 - Manuscript',
    order: 5,
  },
  {
    phase_id: 'manuscript_revisions_start_layout',
    label: 'Make manuscript revisions and start layout',
    order: 6,
  },
  {
    phase_id: 'internal_review_layout',
    label: 'Internal Review - Layout',
    order: 7,
  },
  {
    phase_id: 'revisions_post_internal_layout',
    label: 'Layout Revisions',
    order: 8,
  },
  {
    phase_id: 'client_review_2_layout',
    label: 'Client Review 2 - Layout',
    order: 9,
  },
  {
    phase_id: 'revisions_post_cr2_layout',
    label: 'Layout Revisions',
    order: 10,
  },
  {
    phase_id: 'client_review_3_submission_prep',
    label: 'Client Review 3 - Submission prep',
    order: 11,
  },
  {
    phase_id: 'complete_initial_edit_start_fact_check',
    label: 'Complete initial edit and start fact check',
    order: 12,
  },
  { phase_id: 'complete_fact_check', label: 'Complete fact check', order: 13 },
  { phase_id: 'route_to_clean', label: 'Route to clean', order: 14 },
  {
    phase_id: 'share_client_approval_prb1',
    label: 'Share with client for Approval to PRB1',
    order: 15,
  },
  { phase_id: 'submit_prb1', label: 'Submit for PRB1', order: 16 },
  { phase_id: 'development_prb1', label: 'Development', order: 17 },
  { phase_id: 'prb1_review', label: 'PRB1 Review', order: 18 },
  { phase_id: 'prb1_updates', label: 'PRB1 updates', order: 19 },
  {
    phase_id: 'client_share_prb1_revisions',
    label: 'Client share to review PRB1 revisions',
    order: 20,
  },
  { phase_id: 'revisions_post_prb1_client', label: 'Revisions', order: 21 },
  {
    phase_id: 'share_client_approval_prb2',
    label: 'Share with client for approval to submit to PRB2',
    order: 22,
  },
  { phase_id: 'submit_prb2', label: 'Submit to PRB2', order: 23 },
  { phase_id: 'development_prb2', label: 'Development', order: 24 },
  { phase_id: 'prb2_review', label: 'PRB2 Review', order: 25 },
  {
    phase_id: 'revisions_post_prb2',
    label: 'Revisions based on PRB2 review',
    order: 26,
  },
  {
    phase_id: 'share_client_approval_prb3',
    label: 'Share with client for approval to submit to PRB3',
    order: 27,
  },
  { phase_id: 'submit_prb3', label: 'Submit to PRB3', order: 28 },
  { phase_id: 'development_prb3', label: 'Development', order: 29 },
  { phase_id: 'prb3_review', label: 'PRB3 Review', order: 30 },
  {
    phase_id: 'revisions_post_prb3',
    label: 'Revisions based on PRB3 review',
    order: 31,
  },
  {
    phase_id: 'client_approval_final_submit',
    label: 'Client review and approval to submit for Final Approval',
    order: 32,
  },
  { phase_id: 'submit_final_approval', label: 'Submit for Final Approval', order: 33 },
  { phase_id: 'receive_final_approval', label: 'Receive Final Approval', order: 34 },
  { phase_id: 'upload_final_package', label: 'Upload for Final Package', order: 35 },
  { phase_id: 'final_package_approved', label: 'Final Package Approved', order: 36 },
  { phase_id: 'prep_assets_release', label: 'Prep Assets for release', order: 37 },
  { phase_id: 'release_assets_vendors', label: 'Release Assets to vendors', order: 38 },
];

const PRB_IDS = [
  'submit_prb1',
  'prb1_review',
  'submit_prb2',
  'prb2_review',
  'submit_prb3',
  'prb3_review',
] as const;

export const PRB_PHASE_IDS: ReadonlySet<string> = new Set(PRB_IDS);

export function isPrbPhaseId(phaseId: string): boolean {
  return PRB_PHASE_IDS.has(phaseId);
}

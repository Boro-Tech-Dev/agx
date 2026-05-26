/**
 * Reference schedule for HCP MLR / generic-tactic scenario tests (one row per PHASE_CATALOG phase, same order).
 * Dates align with the canonical March–June 2026 timeline used in tests.
 */

import { PHASE_CATALOG } from './phaseCatalog';

export type EmailBaselineRow = {
  phase_id: string;
  start_date: string;
  end_date: string;
  note: string;
};

export const EMAIL_BASELINE_KICKOFF_ISO = '2026-03-02';

export const EMAIL_BASELINE: EmailBaselineRow[] = [
  {
    phase_id: 'kickoff',
    start_date: '2026-03-02',
    end_date: '2026-03-02',
    note:
      'Project kickoff for email asset; confirm scope, inputs, owners, review path, and PRB calendar.',
  },
  {
    phase_id: 'manuscript_development',
    start_date: '2026-03-03',
    end_date: '2026-03-13',
    note: 'Develop manuscript copy and reference approach for email asset.',
  },
  {
    phase_id: 'internal_review_manuscript',
    start_date: '2026-03-16',
    end_date: '2026-03-17',
    note: 'Internal brand/medical/strategy review of manuscript draft.',
  },
  {
    phase_id: 'revisions_post_internal_manuscript',
    start_date: '2026-03-18',
    end_date: '2026-03-18',
    note: 'Revise manuscript based on internal manuscript review feedback.',
  },
  {
    phase_id: 'client_review_1_manuscript',
    start_date: '2026-03-19',
    end_date: '2026-03-20',
    note: 'Client review of manuscript draft.',
  },
  {
    phase_id: 'manuscript_revisions_start_layout',
    start_date: '2026-03-23',
    end_date: '2026-03-23',
    note: 'Revise after client manuscript review and begin layout handoff.',
  },
  {
    phase_id: 'internal_review_layout',
    start_date: '2026-03-24',
    end_date: '2026-03-25',
    note: 'Internal review of layout-ready materials.',
  },
  {
    phase_id: 'revisions_post_internal_layout',
    start_date: '2026-03-26',
    end_date: '2026-03-26',
    note: 'Revise based on internal layout review feedback.',
  },
  {
    phase_id: 'client_review_2_layout',
    start_date: '2026-03-27',
    end_date: '2026-03-30',
    note: 'Client review of layout.',
  },
  {
    phase_id: 'revisions_post_cr2_layout',
    start_date: '2026-03-31',
    end_date: '2026-03-31',
    note: 'Revise layout based on Client Review 2 feedback.',
  },
  {
    phase_id: 'client_review_3_submission_prep',
    start_date: '2026-04-01',
    end_date: '2026-04-01',
    note: 'Client review focused on submission readiness.',
  },
  {
    phase_id: 'complete_initial_edit_start_fact_check',
    start_date: '2026-04-02',
    end_date: '2026-04-03',
    note: 'Complete initial editorial pass and begin fact check/reference verification.',
  },
  {
    phase_id: 'complete_fact_check',
    start_date: '2026-04-06',
    end_date: '2026-04-07',
    note: 'Complete fact check and resolve reference/source questions.',
  },
  {
    phase_id: 'route_to_clean',
    start_date: '2026-04-08',
    end_date: '2026-04-09',
    note: 'Route edited/fact-checked version to clean copy/layout prep.',
  },
  {
    phase_id: 'share_client_approval_prb1',
    start_date: '2026-04-10',
    end_date: '2026-04-10',
    note: 'Send clean version/layout for client approval to submit to PRB1.',
  },
  {
    phase_id: 'submit_prb1',
    start_date: '2026-04-13',
    end_date: '2026-04-13',
    note: 'Monday PRB1 submission; submit layouts for PRB1 review.',
  },
  {
    phase_id: 'development_prb1',
    start_date: '2026-04-14',
    end_date: '2026-04-21',
    note: 'Development between Monday PRB1 submission and the PRB1 review meeting.',
  },
  {
    phase_id: 'prb1_review',
    start_date: '2026-04-22',
    end_date: '2026-04-22',
    note: 'PRB1 meeting occurs Wednesday of the following week after Monday submission.',
  },
  {
    phase_id: 'prb1_updates',
    start_date: '2026-04-23',
    end_date: '2026-04-27',
    note:
      'Address PRB1 feedback. Production begins in parallel with PRB1 and continues toward coded HTML/mechanicalized assets for PRB2.',
  },
  {
    phase_id: 'client_share_prb1_revisions',
    start_date: '2026-04-28',
    end_date: '2026-04-29',
    note: 'Share PRB1 revisions with client for review.',
  },
  {
    phase_id: 'revisions_post_prb1_client',
    start_date: '2026-04-30',
    end_date: '2026-05-01',
    note: 'Revise based on client feedback on PRB1 revisions.',
  },
  {
    phase_id: 'share_client_approval_prb2',
    start_date: '2026-05-04',
    end_date: '2026-05-04',
    note:
      'Secure client approval for PRB2 submission; PRB2 requires coded HTML assets or mechanicalized files.',
  },
  {
    phase_id: 'submit_prb2',
    start_date: '2026-05-11',
    end_date: '2026-05-11',
    note: 'Monday PRB2 submission; submit coded HTML assets or mechanicalized files.',
  },
  {
    phase_id: 'development_prb2',
    start_date: '2026-05-12',
    end_date: '2026-05-19',
    note: 'Development between Monday PRB2 submission and the PRB2 review meeting.',
  },
  {
    phase_id: 'prb2_review',
    start_date: '2026-05-20',
    end_date: '2026-05-20',
    note: 'PRB2 meeting occurs Wednesday of the following week after Monday submission.',
  },
  {
    phase_id: 'revisions_post_prb2',
    start_date: '2026-05-21',
    end_date: '2026-05-25',
    note: 'Address PRB2 comments in coded/mechanicalized assets.',
  },
  {
    phase_id: 'share_client_approval_prb3',
    start_date: '2026-05-26',
    end_date: '2026-05-26',
    note: 'Secure client approval for PRB3 submission.',
  },
  {
    phase_id: 'submit_prb3',
    start_date: '2026-06-01',
    end_date: '2026-06-01',
    note: 'Monday PRB3 submission.',
  },
  {
    phase_id: 'development_prb3',
    start_date: '2026-06-02',
    end_date: '2026-06-09',
    note: 'Development between Monday PRB3 submission and the PRB3 review meeting.',
  },
  {
    phase_id: 'prb3_review',
    start_date: '2026-06-10',
    end_date: '2026-06-10',
    note: 'PRB3 meeting occurs Wednesday of the following week after Monday submission.',
  },
  {
    phase_id: 'revisions_post_prb3',
    start_date: '2026-06-11',
    end_date: '2026-06-15',
    note: 'Address PRB3 comments in assets.',
  },
  {
    phase_id: 'client_approval_final_submit',
    start_date: '2026-06-16',
    end_date: '2026-06-17',
    note: 'Client reviews latest PRB updates and approves submission for Final Approval.',
  },
  {
    phase_id: 'submit_final_approval',
    start_date: '2026-06-18',
    end_date: '2026-06-18',
    note: 'Submit final updated asset for Final Approval.',
  },
  {
    phase_id: 'receive_final_approval',
    start_date: '2026-06-19',
    end_date: '2026-06-19',
    note: 'Receive final approval confirmation.',
  },
  {
    phase_id: 'upload_final_package',
    start_date: '2026-06-22',
    end_date: '2026-06-22',
    note: 'Upload approved asset and supporting materials for Final Package.',
  },
  {
    phase_id: 'final_package_approved',
    start_date: '2026-06-23',
    end_date: '2026-06-23',
    note: 'Final package approval received.',
  },
  {
    phase_id: 'prep_assets_release',
    start_date: '2026-06-24',
    end_date: '2026-06-25',
    note: 'Prepare final files, QA handoff materials, trafficking details, and vendor-ready package.',
  },
  {
    phase_id: 'release_assets_vendors',
    start_date: '2026-06-26',
    end_date: '2026-06-26',
    note: 'Release final approved assets to vendors.',
  },
];

function assertBaselineMatchesCatalog(): void {
  if (EMAIL_BASELINE.length !== PHASE_CATALOG.length) {
    throw new Error(`EMAIL_BASELINE length ${EMAIL_BASELINE.length} !== PHASE_CATALOG ${PHASE_CATALOG.length}`);
  }
  for (let i = 0; i < EMAIL_BASELINE.length; i++) {
    if (EMAIL_BASELINE[i]!.phase_id !== PHASE_CATALOG[i]!.phase_id) {
      throw new Error(
        `EMAIL_BASELINE phase_id mismatch at ${i}: ${EMAIL_BASELINE[i]!.phase_id} vs ${PHASE_CATALOG[i]!.phase_id}`,
      );
    }
  }
}

assertBaselineMatchesCatalog();

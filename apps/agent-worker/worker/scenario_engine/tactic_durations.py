"""Client-review phase ids + per-phase multipliers via timing_profiles.json."""

from __future__ import annotations

from worker.scenario_engine.timing_profiles import timing_profile_mult_for_phase


CLIENT_REVIEW_SCENARIO_PHASE_IDS: frozenset[str] = frozenset(
    {
        'client_review_1_manuscript',
        'client_review_2_layout',
        'client_review_3_submission_prep',
        'share_client_approval_prb1',
        'client_share_prb1_revisions',
        'share_client_approval_prb2',
        'share_client_approval_prb3',
        'client_approval_final_submit',
    },
)


def tactic_mult_for_phase(timing_profile_id: str, phase_id: str) -> float:
    return timing_profile_mult_for_phase(timing_profile_id, phase_id)

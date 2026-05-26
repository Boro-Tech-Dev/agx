"""Parity with complexity.ts."""

from __future__ import annotations

from typing import Literal

ScenarioComplexity = Literal['basic', 'medium', 'complex']

PrbRounds = Literal[1, 2, 3]

PRB2_BLOCK_STEP_IDS: frozenset[str] = frozenset(
    {
        'share_client_approval_prb2',
        'submit_prb2',
        'development_prb2',
        'prb2_review',
        'revisions_post_prb2',
    }
)

PRB3_BLOCK_STEP_IDS: frozenset[str] = frozenset(
    {
        'share_client_approval_prb3',
        'submit_prb3',
        'development_prb3',
        'prb3_review',
        'revisions_post_prb3',
    }
)


def prb_rounds_for_complexity(c: ScenarioComplexity) -> PrbRounds:
    if c == 'basic':
        return 1
    if c == 'medium':
        return 2
    return 3


def filter_scenario_steps_for_prb_rounds(
    steps: list[dict], rounds: PrbRounds
) -> list[dict]:
    if rounds == 3:
        return list(steps)
    omit = PRB2_BLOCK_STEP_IDS | PRB3_BLOCK_STEP_IDS if rounds == 1 else PRB3_BLOCK_STEP_IDS
    return [r for r in steps if str(r.get('id')) not in omit]


def complexity_span_multiplier(c: ScenarioComplexity) -> float:
    if c == 'basic':
        return 0.85
    if c == 'medium':
        return 1.0
    if c == 'complex':
        return 1.25
    raise TypeError(c)


_BASIC_SCALED_DAYS_OVERRIDE: dict[str, int] = {
    'manuscript_development': 2,
    'complete_initial_edit_start_fact_check': 1,
    'complete_fact_check': 1,
    'route_to_clean': 1,
}


def basic_scaled_days_override(phase_id: str) -> int | None:
    """Basic complexity: fixed scaled days before modifiers (parity with complexity.ts)."""
    return _BASIC_SCALED_DAYS_OVERRIDE.get(phase_id)

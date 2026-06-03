"""Parity with computeScenarioSteps.ts — linear planner from config/scenario_planner."""

from __future__ import annotations

import re
from typing import Any, Literal, Required, TypedDict

from worker.scenario_engine.date_calendar import parse_iso_date_utc

from worker.scenario_engine.complexity import ScenarioComplexity
from worker.scenario_engine.linear_scenario import (
    HalTimelineStep,
    LinearStepBreakdown,
    compute_linear_scenario_steps,
)
from worker.scenario_engine.timing_profiles import is_known_timing_profile, resolve_timing_profile_id

__all__ = [
    'compute_scenario_steps',
    'ComputeScenarioParams',
    'ComputeScenarioResult',
    'HalTimelineStep',
    'LinearStepBreakdown',
]


class PrbBrandConfig(TypedDict, total=False):
    mode: Literal['from_shifted_baseline', 'explicit_submits']
    prb1SubmitIso: str
    prb2SubmitIso: str


PrbAnchorPolicy = Literal['legacy', 'mon_wed']


class ComputeScenarioParams(TypedDict, total=False):
    anchorStartIso: Required[str]
    timingProfile: str
    tactic: str
    complexity: ScenarioComplexity
    clientReviewExtraCalendarDays: int
    holidays: frozenset[str]
    phaseAllowNonWorkingDays: dict[str, bool]
    prbAnchorPolicy: PrbAnchorPolicy
    prbBrand: PrbBrandConfig
    activeModifierIds: list[str]
    pageCount: int
    freezeAfterStepIndex: int
    pinnedPrefixSteps: list[Any]
    catalogTacticKey: str


class ComputeOk(TypedDict, total=False):
    ok: Literal[True]
    steps: list[HalTimelineStep]
    breakdown: list[LinearStepBreakdown]
    opdp_binder_steps: list[HalTimelineStep]


class ComputeErr(TypedDict):
    ok: Literal[False]
    error: str


ComputeScenarioResult = ComputeOk | ComputeErr


_ISO = re.compile(r'^\d{4}-\d{2}-\d{2}$')


def _coerce_pinned_prefix_steps(raw: object) -> tuple[list[HalTimelineStep] | None, str | None]:
    if not isinstance(raw, list):
        return None, 'pinnedPrefixSteps must be a JSON array'
    out: list[HalTimelineStep] = []
    for i, row in enumerate(raw):
        if not isinstance(row, dict):
            return None, f'pinnedPrefixSteps[{i}] must be an object'
        task = row.get('task')
        sd = row.get('start_date')
        ed = row.get('end_date')
        note = row.get('note')
        if not isinstance(task, str) or not task.strip():
            return None, f'pinnedPrefixSteps[{i}]: task is required'
        if not isinstance(sd, str) or not _ISO.match(sd.strip()):
            return None, f'pinnedPrefixSteps[{i}]: start_date must be YYYY-MM-DD'
        if not isinstance(ed, str) or not _ISO.match(ed.strip()):
            return None, f'pinnedPrefixSteps[{i}]: end_date must be YYYY-MM-DD'
        if parse_iso_date_utc(ed.strip()) < parse_iso_date_utc(sd.strip()):
            return None, f'pinnedPrefixSteps[{i}]: end_date must be on or after start_date'
        step: HalTimelineStep = {
            'task': task.strip(),
            'start_date': sd.strip(),
            'end_date': ed.strip(),
            'note': str(note).strip() if note is not None else '',
        }
        anw = row.get('allow_non_working_days') or row.get('allowNonWorkingDays')
        if anw is True or anw == 1 or (isinstance(anw, str) and anw.strip().lower() in ('true', 'yes', '1')):
            step['allow_non_working_days'] = True
        out.append(step)
    return out, None


def _resolve_timing_profile_input(p: ComputeScenarioParams) -> str | None:
    raw = p.get('timingProfile') or p.get('tactic') or 'generic_tactic'
    if not isinstance(raw, str):
        return None
    rid = resolve_timing_profile_id(raw.strip())
    return rid if is_known_timing_profile(rid) else None


def compute_scenario_steps(p: ComputeScenarioParams) -> ComputeScenarioResult:
    tp = _resolve_timing_profile_input(p)
    if tp is None:
        raw = p.get('timingProfile') or p.get('tactic') or ''
        label = raw if isinstance(raw, str) and raw.strip() else '(empty)'
        return {'ok': False, 'error': f'Unknown timing profile: {label}'}

    raw_mids = p.get('activeModifierIds')
    if raw_mids is not None:
        if not isinstance(raw_mids, list):
            return {'ok': False, 'error': 'activeModifierIds must be a list of strings if present'}
        mid_list = [str(x) for x in raw_mids if x is not None]
    else:
        mid_list = []

    raw_pc = p.get('pageCount')
    page_count: int | None = None
    if raw_pc is not None:
        try:
            page_count = int(raw_pc)
        except (TypeError, ValueError):
            page_count = None

    fz_raw = p.get('freezeAfterStepIndex')
    ps_raw = p.get('pinnedPrefixSteps')
    fz_out: int | None = None
    pins_out: list[HalTimelineStep] | None = None
    if fz_raw is not None or ps_raw is not None:
        if fz_raw is None or ps_raw is None:
            return {'ok': False, 'error': 'freezeAfterStepIndex and pinnedPrefixSteps must be provided together.'}
        if isinstance(fz_raw, bool) or not isinstance(fz_raw, int):
            return {'ok': False, 'error': 'freezeAfterStepIndex must be a JSON integer.'}
        fz_parsed = fz_raw
        pins_parsed, perr = _coerce_pinned_prefix_steps(ps_raw)
        if perr or pins_parsed is None:
            return {'ok': False, 'error': perr or 'Invalid pinnedPrefixSteps'}
        fz_out = fz_parsed
        pins_out = pins_parsed

    catalog_tactic_key: str | None = None
    raw_ctk = p.get('catalogTacticKey')
    if raw_ctk is not None:
        if not isinstance(raw_ctk, str) or not raw_ctk.strip():
            return {'ok': False, 'error': 'catalogTacticKey must be a non-empty string if present'}
        catalog_tactic_key = raw_ctk.strip()

    ok, steps, breakdown, err, opdp_binder = compute_linear_scenario_steps(
        anchor_start_iso=p['anchorStartIso'],
        timing_profile=tp,
        complexity=p.get('complexity') or 'medium',
        client_review_extra=int(p.get('clientReviewExtraCalendarDays') or 0),
        holidays=p.get('holidays'),
        phase_allow_non_working_days=p.get('phaseAllowNonWorkingDays'),
        active_modifier_ids=mid_list,
        page_count=page_count,
        freeze_after_step_index=fz_out,
        pinned_prefix_steps=pins_out,
        catalog_tactic_key=catalog_tactic_key,
    )
    if not ok or steps is None or breakdown is None:
        return {'ok': False, 'error': err or 'Planner error'}
    out: ComputeOk = {'ok': True, 'steps': steps, 'breakdown': breakdown}
    if opdp_binder:
        out['opdp_binder_steps'] = opdp_binder
    return out

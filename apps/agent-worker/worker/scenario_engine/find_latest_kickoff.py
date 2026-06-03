"""Parity with findLatestKickoffForDeadline.ts."""

from __future__ import annotations

from typing import Literal, Required, TypedDict, cast

from worker.scenario_engine.compute_scenario_steps import (
    ComputeScenarioParams,
    HalTimelineStep,
    compute_scenario_steps,
)
from worker.scenario_engine.linear_scenario import LinearStepBreakdown
from worker.scenario_engine.date_calendar import add_calendar_days_utc, parse_iso_date_utc
from worker.scenario_engine.phase_catalog import PHASE_CATALOG


KICKOFF_DEADLINE_SEARCH_WINDOW_DAYS = 800


class FindLatestKickoffParams(TypedDict, total=False):
    tactic: str
    timingProfile: str
    deadlineIso: Required[str]
    anchorPhaseId: Required[str]
    complexity: ComputeScenarioParams['complexity']
    clientReviewExtraCalendarDays: int
    holidays: ComputeScenarioParams['holidays']
    phaseAllowNonWorkingDays: ComputeScenarioParams['phaseAllowNonWorkingDays']
    prbAnchorPolicy: ComputeScenarioParams['prbAnchorPolicy']
    prbBrand: ComputeScenarioParams['prbBrand']
    activeModifierIds: list[str]
    pageCount: int
    searchWindowDays: int
    catalogTacticKey: str


class FindLatestOk(TypedDict):
    ok: Literal[True]
    kickoffIso: str
    steps: list[HalTimelineStep]
    breakdown: list[LinearStepBreakdown]


class FindLatestErr(TypedDict):
    ok: Literal[False]
    error: str


FindLatestKickoffResult = FindLatestOk | FindLatestErr


def _validate_iso(iso: str, label: str) -> str | None:
    try:
        parse_iso_date_utc(iso)
        return None
    except ValueError:
        return f'{label} must be a valid YYYY-MM-DD date'


MILESTONE_NOT_IN_SCHEDULE = (
    'This milestone is not in the schedule for the selected complexity (PRB round count). '
    'Pick another milestone or a higher complexity.'
)


def _milestone_end_for_phase(
    steps: list[HalTimelineStep], breakdown: list[LinearStepBreakdown], anchor_phase_id: str
) -> str | None:
    for i, b in enumerate(breakdown):
        if b.get('phase_id') == anchor_phase_id:
            if i < len(steps):
                return str(steps[i]['end_date'])
            return None
    return None


def _forward_params(p: FindLatestKickoffParams, anchor_start_iso: str) -> ComputeScenarioParams:
    out: ComputeScenarioParams = {
        'anchorStartIso': anchor_start_iso,
    }
    if 'timingProfile' in p:
        out['timingProfile'] = p['timingProfile']
    if 'tactic' in p:
        out['tactic'] = p['tactic']
    if 'complexity' in p:
        out['complexity'] = p['complexity']
    if 'clientReviewExtraCalendarDays' in p:
        out['clientReviewExtraCalendarDays'] = p['clientReviewExtraCalendarDays']
    if 'holidays' in p:
        out['holidays'] = p['holidays']
    if 'phaseAllowNonWorkingDays' in p:
        out['phaseAllowNonWorkingDays'] = p['phaseAllowNonWorkingDays']
    if 'activeModifierIds' in p:
        out['activeModifierIds'] = p['activeModifierIds']
    if 'pageCount' in p:
        out['pageCount'] = p['pageCount']
    if 'catalogTacticKey' in p:
        out['catalogTacticKey'] = p['catalogTacticKey']
    return out


def find_latest_kickoff_for_deadline(p: FindLatestKickoffParams) -> FindLatestKickoffResult:
    deadline_err = _validate_iso(p['deadlineIso'], 'Deadline')
    if deadline_err:
        return {'ok': False, 'error': deadline_err}

    if not any(r['phase_id'] == p['anchorPhaseId'] for r in PHASE_CATALOG):
        return {'ok': False, 'error': 'Unknown milestone phase.'}

    window_days = min(3650, max(1, int(p.get('searchWindowDays') or KICKOFF_DEADLINE_SEARCH_WINDOW_DAYS)))
    earliest_kickoff = add_calendar_days_utc(p['deadlineIso'], -window_days)
    first = compute_scenario_steps(_forward_params(p, earliest_kickoff))
    if first['ok'] is False:
        return cast(FindLatestKickoffResult, first)

    end_earliest = _milestone_end_for_phase(first['steps'], first['breakdown'], p['anchorPhaseId'])
    if end_earliest is None:
        return {'ok': False, 'error': MILESTONE_NOT_IN_SCHEDULE}
    if end_earliest > p['deadlineIso']:
        return {
            'ok': False,
            'error': (
                'This deadline is too aggressive for the selected tactic and options, even with the '
                'earliest kickoff in the search window. Try a later deadline, a lighter tactic, fewer '
                'client-review extra days, or widen the kickoff search window.'
            ),
        }

    lo = 0
    hi = window_days
    while lo < hi:
        mid = (lo + hi + 1) // 2
        kickoff = add_calendar_days_utc(earliest_kickoff, mid)
        r = compute_scenario_steps(_forward_params(p, kickoff))
        if r['ok'] is False:
            return cast(FindLatestKickoffResult, r)
        me = _milestone_end_for_phase(r['steps'], r['breakdown'], p['anchorPhaseId'])
        if me is None:
            return {'ok': False, 'error': MILESTONE_NOT_IN_SCHEDULE}
        if me <= p['deadlineIso']:
            lo = mid
        else:
            hi = mid - 1

    kickoff_iso = add_calendar_days_utc(earliest_kickoff, lo)
    final_r = compute_scenario_steps(_forward_params(p, kickoff_iso))
    if final_r['ok'] is False:
        return cast(FindLatestKickoffResult, final_r)
    return {
        'ok': True,
        'kickoffIso': kickoff_iso,
        'steps': final_r['steps'],
        'breakdown': final_r['breakdown'],
    }

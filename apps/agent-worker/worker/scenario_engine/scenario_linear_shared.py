"""Shared linear planner helpers (parity with scenario_linear_shared.ts)."""

from __future__ import annotations

from typing import Any, Mapping

from worker.scenario_engine.complexity import ScenarioComplexity, complexity_span_multiplier
from worker.scenario_engine.date_calendar import parse_iso_date_utc
from worker.scenario_engine.phase_catalog import is_prb_phase_id
from worker.scenario_engine.tactic_durations import tactic_mult_for_phase
from worker.scenario_engine.working_days import HolidaySet, is_working_day

LINEAR_EMPTY_HOLIDAYS: HolidaySet = frozenset()


def linear_validate_iso(iso: str, label: str) -> str | None:
    try:
        parse_iso_date_utc(iso)
        return None
    except ValueError:
        return f'{label} must be a valid YYYY-MM-DD date'


def linear_allow_non_working_for(
    phase_id: str,
    phase_allow_non_working_days: Mapping[str, bool] | None,
) -> bool:
    return bool(phase_allow_non_working_days and phase_allow_non_working_days.get(phase_id))


def linear_step_payload(
    label: str,
    start: str,
    end: str,
    note: str,
    allow_non_working: bool,
) -> dict[str, Any]:
    s: dict[str, Any] = {
        'task': label,
        'start_date': start,
        'end_date': end,
        'note': note,
    }
    if allow_non_working:
        s['allow_non_working_days'] = True
    return s


def linear_clamp_days(n: int, row: Mapping[str, Any]) -> int:
    lo = int(row['min_days']) if row.get('min_days') is not None else 1
    hi = int(row['max_days']) if row.get('max_days') is not None else 2**53
    return max(lo, min(hi, n))


def linear_scaled_baseline(
    row: Mapping[str, Any],
    timing_profile: str,
    complexity: ScenarioComplexity,
) -> int:
    b = int(row['baseline_days'])
    rid = str(row['id'])
    if is_prb_phase_id(rid):
        return b
    tactic_mult = tactic_mult_for_phase(timing_profile, rid)
    complexity_mult = complexity_span_multiplier(complexity)
    return max(1, round(b * tactic_mult * complexity_mult))


def linear_merge_modifier_deltas(
    step_id: str,
    active_modifier_ids: list[str],
    bundles: dict[str, dict],
) -> tuple[int, dict[str, int]]:
    by_id: dict[str, int] = {}
    total = 0
    for mid in active_modifier_ids:
        bundle = bundles.get(mid)
        if not bundle:
            continue
        deltas = bundle.get('deltas') or {}
        if step_id not in deltas:
            continue
        d = int(deltas[step_id])
        if d == 0:
            continue
        by_id[mid] = d
        total += d
    return total, by_id


def linear_merge_modifier_phase_notes(
    step_id: str,
    base_note: str,
    active_modifier_ids: list[str],
    bundles: dict[str, dict],
) -> str:
    n = base_note
    for mid in active_modifier_ids:
        bundle = bundles.get(mid)
        if not bundle:
            continue
        pnotes = bundle.get('phase_notes') or {}
        add = pnotes.get(step_id)
        if isinstance(add, str) and add.strip():
            n = f'{n}\n\n{add}' if n else add
    return n


def linear_prb_step_allow_non_working(
    phase_allows: bool,
    iso: str,
    holidays: HolidaySet,
    needs_flag_from_resolver: bool,
) -> bool:
    if not phase_allows:
        return False
    if needs_flag_from_resolver:
        return True
    return not is_working_day(iso, holidays)

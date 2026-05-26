"""Parallel OPDP binder track — parity with opdpBinderCompute.ts."""

from __future__ import annotations

import json
from pathlib import Path
from typing import TypedDict

from worker.scenario_engine.date_calendar import add_calendar_days_utc
from worker.scenario_engine.working_days import HolidaySet, add_working_days_utc, next_working_day


class _OpdpRow(TypedDict):
    id: str
    label: str
    baseline_days: int
    note: str


def _scenario_cfg_dir() -> Path:
    here = Path(__file__).resolve()
    if len(here.parents) > 4:
        repo_candidate = here.parents[4] / 'config' / 'scenario_planner'
        if (repo_candidate / 'steps_opdp_happyguy.json').is_file():
            return repo_candidate
    bundled = here.parents[2] / 'config' / 'scenario_planner'
    if (bundled / 'steps_opdp_happyguy.json').is_file():
        return bundled
    raise FileNotFoundError('steps_opdp_happyguy.json missing under config/scenario_planner')


def compute_opdp_binder_steps(
    *,
    anchor_start_iso: str,
    holidays: HolidaySet | None = None,
) -> list[dict[str, str]]:
    hol: HolidaySet = holidays if holidays is not None else frozenset()
    p = _scenario_cfg_dir() / 'steps_opdp_happyguy.json'
    raw = json.loads(p.read_text(encoding='utf-8'))
    rows: list[_OpdpRow] = raw['steps']
    cursor = next_working_day(anchor_start_iso, hol)
    out: list[dict[str, str]] = []
    for row in rows:
        bd = max(1, int(row['baseline_days']))
        start = cursor
        end = add_working_days_utc(start, bd - 1, hol)
        out.append(
            {
                'task': row['label'],
                'start_date': start,
                'end_date': end,
                'note': row['note'],
            }
        )
        cursor = next_working_day(add_calendar_days_utc(end, 1), hol)
    return out

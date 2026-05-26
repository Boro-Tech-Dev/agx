"""Weekends + holiday set. Parity with workingDays.ts."""

from __future__ import annotations

from worker.scenario_engine.date_calendar import add_calendar_days_utc, parse_iso_date_utc

HolidaySet = frozenset[str] | set[str]


def is_weekend_iso(iso: str) -> bool:
    d = parse_iso_date_utc(iso)
    return d.weekday() >= 5  # Sat=5, Sun=6


def is_working_day(iso: str, holidays: HolidaySet) -> bool:
    if is_weekend_iso(iso):
        return False
    return iso not in holidays


def next_working_day(iso: str, holidays: HolidaySet) -> str:
    cur = iso
    while not is_working_day(cur, holidays):
        cur = add_calendar_days_utc(cur, 1)
    return cur


def previous_working_day_on_or_before(iso: str, holidays: HolidaySet) -> str:
    cur = iso
    guard = 0
    max_guard = 4000
    while not is_working_day(cur, holidays):
        cur = add_calendar_days_utc(cur, -1)
        guard += 1
        if guard > max_guard:
            raise RuntimeError('previousWorkingDayOnOrBefore: no working day found within search window')
    return cur


def add_working_days_utc(start_iso: str, delta: int, holidays: HolidaySet) -> str:
    if delta < 0:
        raise ValueError('addWorkingDaysUTC: delta must be non-negative')
    cur = start_iso
    left = delta
    while left > 0:
        cur = add_calendar_days_utc(cur, 1)
        if is_working_day(cur, holidays):
            left -= 1
    return cur


def inclusive_working_day_span(start_iso: str, end_iso: str, holidays: HolidaySet) -> int:
    s = parse_iso_date_utc(start_iso)
    e = parse_iso_date_utc(end_iso)
    if e < s:
        return 0
    cur = start_iso
    n = 0
    while True:
        if is_working_day(cur, holidays):
            n += 1
        if cur == end_iso:
            break
        cur = add_calendar_days_utc(cur, 1)
    return n

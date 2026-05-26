"""ISO YYYY-MM-DD calendar math (UTC-style, no DST). Parity with dateCalendar.ts."""

from __future__ import annotations

import re
from datetime import date, timedelta

_ISO = re.compile(r'^(\d{4})-(\d{2})-(\d{2})$')


def parse_iso_date_utc(iso: str) -> date:
    m = _ISO.match(iso.strip())
    if not m:
        raise ValueError(f'Invalid ISO date: {iso}')
    y, mo, d = int(m.group(1)), int(m.group(2)), int(m.group(3))
    return date(y, mo, d)


def format_iso_date_utc(d: date) -> str:
    return d.isoformat()


def add_calendar_days_utc(iso: str, delta_days: int) -> str:
    d = parse_iso_date_utc(iso)
    return format_iso_date_utc(d + timedelta(days=delta_days))


def inclusive_calendar_day_span(start_iso: str, end_iso: str) -> int:
    s = parse_iso_date_utc(start_iso)
    e = parse_iso_date_utc(end_iso)
    if e < s:
        return 0
    return (e - s).days + 1


def calendar_days_offset(from_iso: str, to_iso: str) -> int:
    a = parse_iso_date_utc(from_iso)
    b = parse_iso_date_utc(to_iso)
    return (b - a).days

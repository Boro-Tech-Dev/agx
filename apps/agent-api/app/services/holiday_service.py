"""US (and future) holiday rows for calendar / working-day UI."""

from __future__ import annotations

from datetime import date

from ..db import fetch

MAX_RANGE_DAYS = 800


def list_in_range(country_code: str, from_date: date, to_date: date) -> dict:
    if to_date < from_date:
        raise ValueError('to must be on or after from')
    if (to_date - from_date).days > MAX_RANGE_DAYS:
        raise ValueError(f'Date range must be at most {MAX_RANGE_DAYS} days')
    cc = (country_code or 'US').strip().upper() or 'US'
    rows = fetch(
        """
        SELECT to_char(date, 'YYYY-MM-DD') AS date, name
        FROM holidays
        WHERE country_code = %s AND date >= %s AND date <= %s
        ORDER BY date
        """,
        (cc, from_date, to_date),
    )
    return {'holidays': [{'date': r['date'], 'name': r['name']} for r in rows]}

"""Validate PM run input.scenario (timeline CSV or steps; align with worker/scenario_planning.py)."""

from __future__ import annotations

import csv
import io
import re
from datetime import date

from pydantic import BaseModel, Field, ValidationInfo, field_validator, model_validator

_ISO_DATE = re.compile(r'^\d{4}-\d{2}-\d{2}$')


def _strip_bom(s: str) -> str:
    if s.startswith('\ufeff'):
        return s[1:]
    return s


def _normalize_header_key(h: str) -> str:
    return ' '.join(h.strip().lower().split())


def _parse_iso_date_val(v: str, ctx: str) -> str:
    t = (v or '').strip()
    if not _ISO_DATE.match(t):
        raise ValueError(f'{ctx} must be YYYY-MM-DD')
    try:
        date.fromisoformat(t)
    except ValueError as e:
        raise ValueError(f'{ctx} must be a valid calendar date') from e
    return t


def _validate_csv_timeline(text: str) -> None:
    """Raise ValueError if CSV is missing required columns or has no valid data rows."""
    raw = _strip_bom(text.strip())
    if not raw:
        raise ValueError('csv_text is empty')
    reader = csv.DictReader(io.StringIO(raw))
    if not reader.fieldnames:
        raise ValueError('CSV has no header row')
    mapping: dict[str, str] = {}
    for fn in reader.fieldnames:
        if fn is None:
            continue
        n = _normalize_header_key(fn)
        if n == 'task':
            mapping['task'] = fn
        elif n == 'start date':
            mapping['start'] = fn
        elif n == 'end date':
            mapping['end'] = fn
        elif n == 'note':
            mapping['note'] = fn
        elif n in ('allow non working days', 'allow_non_working_days'):
            mapping['allow_non_working'] = fn
    if 'task' not in mapping or 'start' not in mapping or 'end' not in mapping:
        raise ValueError('CSV must include columns: Task, Start Date, End Date (optional: Note)')
    tk, sk, ek = mapping['task'], mapping['start'], mapping['end']
    nk = mapping.get('note')
    ak = mapping.get('allow_non_working')
    count = 0
    row_num = 2
    for row in reader:
        task = (row.get(tk) or '').strip()
        sd_raw = (row.get(sk) or '').strip()
        ed_raw = (row.get(ek) or '').strip()
        note_raw = (row.get(nk) or '').strip() if nk else ''
        allow_raw = (row.get(ak) or '').strip().lower() if ak else ''
        if not task and not sd_raw and not ed_raw and not note_raw and not allow_raw:
            row_num += 1
            continue
        if not task:
            raise ValueError(f'CSV row {row_num}: Task is required')
        sd = _parse_iso_date_val(sd_raw, f'CSV row {row_num} Start Date')
        ed = _parse_iso_date_val(ed_raw, f'CSV row {row_num} End Date')
        if date.fromisoformat(ed) < date.fromisoformat(sd):
            raise ValueError(f'CSV row {row_num}: End Date must be on or after Start Date')
        if allow_raw and allow_raw not in ('true', '1', 'yes', 'false', '0', 'no', ''):
            raise ValueError(f'CSV row {row_num}: Allow non working days must be true/false if present')
        count += 1
        row_num += 1
    if count == 0:
        raise ValueError('CSV has no data rows')


class TimelineStep(BaseModel):
    task: str = Field(..., min_length=1, max_length=2000)
    start_date: str
    end_date: str
    note: str | None = Field(default=None, max_length=8000)
    allow_non_working_days: bool | None = None

    @field_validator('task')
    @classmethod
    def strip_task(cls, v: str) -> str:
        s = (v or '').strip()
        if not s:
            raise ValueError('task is required')
        return s

    @field_validator('start_date', 'end_date')
    @classmethod
    def iso_dates(cls, v: str, info: ValidationInfo) -> str:
        label = str(info.field_name or 'date')
        return _parse_iso_date_val(v, label)

    @model_validator(mode='after')
    def end_after_start(self) -> TimelineStep:
        if date.fromisoformat(self.end_date) < date.fromisoformat(self.start_date):
            raise ValueError('end_date must be on or after start_date')
        return self

    model_config = {'extra': 'ignore'}


class HalTimelineScenarioInput(BaseModel):
    """Delivery timeline: native CSV body and/or explicit steps (steps win if both set)."""

    csv_text: str | None = Field(default=None, max_length=2_000_000)
    steps: list[TimelineStep] | None = None

    @model_validator(mode='after')
    def require_source(self) -> HalTimelineScenarioInput:
        has_steps = bool(self.steps)
        csv_ok = isinstance(self.csv_text, str) and bool(self.csv_text.strip())
        if has_steps:
            return self
        if csv_ok:
            _validate_csv_timeline(self.csv_text or '')
            return self
        raise ValueError('Provide non-empty csv_text or a non-empty steps array')

    model_config = {'extra': 'ignore'}

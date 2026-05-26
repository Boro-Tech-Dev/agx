"""Extract dated rows from CSV or plain text for timeline processing."""

from __future__ import annotations

import csv
import io
import re
from datetime import date, datetime
from pathlib import Path

_DATE_HEADER_HINTS = frozenset(
    {
        'date',
        'due',
        'due date',
        'start',
        'end',
        'finish',
        'target',
        'deadline',
        'day',
    },
)
_TASK_HEADER_HINTS = frozenset(
    {
        'task',
        'milestone',
        'phase',
        'name',
        'title',
        'description',
        'activity',
        'gate',
        'step',
        'item',
        'label',
        'field',
    },
)

# Standard layout: Task, Start Date, End Date, Note — see parse_raw_timeline docstring.
_LABEL_COLUMN_PREFS: tuple[str, ...] = (
    'task',
    'phase',
    'step',
    'field',
)
_PHASE_STRONG = frozenset({'phase', 'step', 'field'})
_START_HEADER_PREFS: tuple[str, ...] = (
    'start date',
    'start_date',
    'starts',
    'start',
    'begin date',
    'begin',
)
_END_HEADER_PREFS: tuple[str, ...] = (
    'end date',
    'end_date',
    'due date',
    'due_date',
    'finish date',
    'finish',
    'target',
    'deadline',
    'due',
    'end',
)
_NOTE_HEADER_PREFS: tuple[str, ...] = ('note', 'notes', 'comment', 'comments', 'remarks')

_ISO = re.compile(r'\b(\d{4}-\d{1,2}-\d{1,2})\b')
_US = re.compile(r'\b(\d{1,2}/\d{1,2}/\d{2,4})\b')


def _try_parse_date(s: str) -> date | None:
    s = (s or '').strip()
    if not s:
        return None
    for fmt in (
        '%Y-%m-%d',
        '%m/%d/%Y',
        '%d/%m/%Y',
        '%Y/%m/%d',
        '%m-%d-%Y',
        '%B %d, %Y',
        '%b %d, %Y',
    ):
        try:
            return datetime.strptime(s, fmt).date()
        except ValueError:
            continue
    m = _ISO.search(s)
    if m:
        try:
            return datetime.strptime(m.group(1), '%Y-%m-%d').date()
        except ValueError:
            pass
    m = _US.search(s)
    if m:
        for fmt in ('%m/%d/%Y', '%m/%d/%y'):
            try:
                return datetime.strptime(m.group(1), fmt).date()
            except ValueError:
                continue
    return None


def _norm_header(h: str) -> str:
    s = (h or '').strip().lstrip('\ufeff')
    return re.sub(r'\s+', ' ', s.lower())


def _pick_delimiter(sample: str) -> str:
    try:
        dialect = csv.Sniffer().sniff(sample[:4096], delimiters=',\t;|')
        return dialect.delimiter
    except csv.Error:
        return ','


def parse_raw_timeline(text: str, original_filename: str | None) -> list[dict]:
    """
    **Standard timeline CSV** (preferred for uploads): one header row, then one row per step.

    Columns (case-insensitive; spaces normalized), in any order::

        Task, Start Date, End Date, Note

    - **Task**: phase / step label (maps to the editorial phase catalog).
    - **Start Date** / **End Date**: calendar dates (ISO or common US forms). ``date_iso`` on each
      row is the **end** date when present, else the start date (typical due / milestone on end).
    - **Note**: optional per-row note; stored as ``timeline_note``.

    Legacy layouts (two-column date + task, or plain lines) are still accepted when the standard
    headers are not present.

    Returns rows: ``row_index``, ``date_iso``, ``raw_label`` (from Task), optional ``start_date_iso``,
    ``end_date_iso``, ``timeline_note``, and ``source_row``.
    """
    name = (original_filename or '').lower()
    path = Path(name)
    if path.suffix == '.csv' or (',' in (text or '')[:800] and '\n' in (text or '')[:800]):
        rows = _parse_csv(text or '')
        if rows:
            return rows
    return _parse_plain_lines(text or '')


def _find_header_col(header: list[str], prefs: tuple[str, ...]) -> int:
    for p in prefs:
        for i, h in enumerate(header):
            if h == p:
                return i
    return -1


def _standard_timeline_csv_indices(header: list[str]) -> tuple[int, int, int, int] | None:
    """
    Standard timeline sheet: label column (Task) + Start Date + End Date + optional Note.

    Returns (label_i, start_i, end_i, note_i) with note_i -1 if no Note column.
    """
    label_i = -1
    for pref in _LABEL_COLUMN_PREFS:
        for i, h in enumerate(header):
            if h == pref:
                label_i = i
                break
        if label_i >= 0:
            break
    if label_i < 0:
        for i, h in enumerate(header):
            if h in _TASK_HEADER_HINTS and h not in _PHASE_STRONG:
                label_i = i
                break
    start_i = _find_header_col(header, _START_HEADER_PREFS)
    end_i = _find_header_col(header, _END_HEADER_PREFS)
    if label_i < 0 or start_i < 0 or end_i < 0 or start_i == end_i:
        return None
    note_i = _find_header_col(header, _NOTE_HEADER_PREFS)
    return (label_i, start_i, end_i, note_i)


def _is_standard_timeline_header(header: list[str]) -> bool:
    """True when headers use the canonical column names Task + Start Date + End Date (Note optional)."""
    hset = frozenset(header)
    return 'task' in hset and 'start date' in hset and 'end date' in hset


def _parse_standard_timeline_rows(
    rows_list: list[list[str]],
    cols: tuple[int, int, int, int],
    *,
    data_start: int,
) -> list[dict]:
    label_i, start_i, end_i, note_i = cols
    out: list[dict] = []
    ri = 0
    for line_idx, cells in enumerate(rows_list[data_start:], start=data_start):
        if not cells or all(not (c or '').strip() for c in cells):
            continue
        def cell(i: int) -> str:
            return cells[i].strip() if i < len(cells) else ''

        task_label = cell(label_i)
        start_raw = cell(start_i)
        end_raw = cell(end_i)
        note = cell(note_i) if note_i >= 0 else ''
        if not task_label and not start_raw and not end_raw and not note:
            continue
        start_d = _try_parse_date(start_raw)
        end_d = _try_parse_date(end_raw)
        date_iso = None
        if end_d:
            date_iso = end_d.isoformat()
        elif start_d:
            date_iso = start_d.isoformat()
        label = task_label or start_raw or end_raw or note
        if not label:
            continue
        row_dict: dict = {
            'row_index': ri,
            'date_iso': date_iso,
            'raw_label': label[:500],
            'source_row': {
                'csv_line': line_idx,
                'cells': cells[:24],
                'format': 'timeline_csv_standard',
            },
        }
        if start_d:
            row_dict['start_date_iso'] = start_d.isoformat()
        if end_d:
            row_dict['end_date_iso'] = end_d.isoformat()
        if note:
            row_dict['timeline_note'] = note[:4000]
        out.append(row_dict)
        ri += 1
    return out


def _parse_csv(text: str) -> list[dict]:
    if not text.strip():
        return []
    delim = _pick_delimiter(text)
    reader = csv.reader(io.StringIO(text))
    rows_list = list(reader)
    if not rows_list:
        return []
    header = [_norm_header(c) for c in rows_list[0]]
    std_cols = _standard_timeline_csv_indices(header)
    if std_cols is not None and (
        _is_standard_timeline_header(header) or _row_maybe_header(rows_list[0])
    ):
        structured = _parse_standard_timeline_rows(rows_list, std_cols, data_start=1)
        if structured:
            return structured
    start = 0
    date_idx = -1
    task_idx = -1
    # header detection: any cell looks like a known header word
    if header and any(h for h in header if h in _DATE_HEADER_HINTS or any(x in h for x in _DATE_HEADER_HINTS)):
        start = 1
        for i, h in enumerate(header):
            if h in _DATE_HEADER_HINTS or any(x in h for x in _DATE_HEADER_HINTS):
                date_idx = i
                break
        for i, h in enumerate(header):
            if h in _TASK_HEADER_HINTS or any(x in h for x in _TASK_HEADER_HINTS):
                task_idx = i
                break
        if date_idx >= 0 and task_idx < 0:
            for i, _h in enumerate(header):
                if i != date_idx:
                    task_idx = i
                    break
    if date_idx < 0 or task_idx < 0:
        # positional fallback: first col date-ish or second col text
        widths = [len(r) for r in rows_list[:12]]
        maxw = max(widths) if widths else 0
        if maxw >= 2:
            date_idx, task_idx = 0, 1
        elif maxw == 1:
            date_idx, task_idx = 0, 0
        else:
            return []
        start = 1 if start == 0 and _row_maybe_header(rows_list[0]) else 0

    out: list[dict] = []
    ri = 0
    for line_idx, cells in enumerate(rows_list[start:], start=start):
        if not cells or all(not (c or '').strip() for c in cells):
            continue
        date_cell = cells[date_idx] if date_idx < len(cells) else ''
        task_cell = cells[task_idx] if task_idx < len(cells) else ''
        if date_idx == task_idx:
            task_cell = ' '.join(cells[i] for i in range(len(cells)) if i != date_idx).strip() or date_cell
        d = _try_parse_date(date_cell)
        label = (task_cell or '').strip() or (date_cell or '').strip()
        if not label and not d:
            continue
        out.append(
            {
                'row_index': ri,
                'date_iso': d.isoformat() if d else None,
                'raw_label': label[:500],
                'source_row': {'csv_line': line_idx, 'cells': cells[:20]},
            }
        )
        ri += 1
    return out


def _row_maybe_header(cells: list[str]) -> bool:
    joined = ' '.join(_norm_header(c) for c in cells)
    return any(h in joined for h in _DATE_HEADER_HINTS) or any(h in joined for h in _TASK_HEADER_HINTS)


def _parse_plain_lines(text: str) -> list[dict]:
    out: list[dict] = []
    ri = 0
    for line in text.splitlines():
        line = line.strip()
        if not line or line.startswith('#'):
            continue
        d = _try_parse_date(line)
        label = line
        if d:
            label = line.replace(d.isoformat(), '').strip(' -—\t:')
        if not label:
            label = line
        if not d and not _looks_like_task_line(label):
            continue
        out.append({'row_index': ri, 'date_iso': d.isoformat() if d else None, 'raw_label': label[:500]})
        ri += 1
    return out


def _looks_like_task_line(s: str) -> bool:
    if len(s) < 4:
        return False
    return bool(re.search(r'[A-Za-z]{3,}', s))

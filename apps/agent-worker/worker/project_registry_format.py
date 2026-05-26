"""DB-free formatting for project registry snapshot (importable in tests without psycopg)."""

from __future__ import annotations

import json
import uuid
from typing import Any

REGISTRY_AGENTS = frozenset({'pm', 'synergy', 'clinic', 'kitt', 'bubs'})
TIMELINE_ROW_LIMIT = 120
OTHER_OPEN_ROW_LIMIT = 40
BODY_TRUNC = 400
MAX_REGISTRY_CHARS = 16000
TRUNC_FOOTER = '\n\n...[registry truncated]...\n'


def normalize_focus_id_for_retrieval(raw: Any) -> str | None:
    if raw is None:
        return None
    s = str(raw).strip()
    if not s:
        return None
    try:
        return str(uuid.UUID(s))
    except ValueError:
        return None


def _parse_body(body: Any) -> dict[str, Any]:
    if body is None:
        return {}
    if isinstance(body, dict):
        return body
    s = str(body).strip()
    if not s:
        return {}
    try:
        out = json.loads(s)
        return out if isinstance(out, dict) else {'raw': s[:BODY_TRUNC]}
    except json.JSONDecodeError:
        return {'raw': s[:BODY_TRUNC]}


def _trunc(s: str, n: int) -> str:
    t = (s or '').strip()
    if len(t) <= n:
        return t
    return t[: n - 3] + '...'


def format_registry_markdown(
    project: dict[str, Any] | None,
    timeline_rows: list[dict[str, Any]],
    other_open: list[dict[str, Any]],
    focus_row: dict[str, Any] | None,
) -> str:
    lines: list[str] = ['## Project_registry_facts']
    lines.append(
        'The following is app-supplied project and timeline state from the database. '
        'Use it to ground tasks, risks, dates, and open questions; do not contradict explicit facts here.'
    )

    if project:
        lines.append('### Project')
        lines.append(f'- **key**: {_trunc(str(project.get("key") or ""), 200)}')
        lines.append(f'- **name**: {_trunc(str(project.get("name") or ""), 500)}')
        desc = project.get('description')
        if desc:
            lines.append(f'- **description**: {_trunc(str(desc), 1200)}')
        lines.append(f'- **project_type**: {_trunc(str(project.get("project_type") or ""), 120)}')
        lines.append(f'- **pm_kind**: {_trunc(str(project.get("pm_kind") or ""), 40)}')
        meta = project.get('metadata')
        if meta is not None and meta != {}:
            if not isinstance(meta, dict):
                meta = {'value': meta}
            try:
                meta_s = json.dumps(meta, default=str, indent=2)
            except TypeError:
                meta_s = str(meta)
            lines.append(f'- **metadata** (JSON):\n```json\n{_trunc(meta_s, 2000)}\n```')

    if focus_row:
        lines.append('### Focus_project_item')
        lines.append(f'- **id**: {focus_row.get("id")}')
        lines.append(f'- **item_type**: {_trunc(str(focus_row.get("item_type") or ""), 80)}')
        lines.append(f'- **title**: {_trunc(str(focus_row.get("title") or ""), 500)}')
        bod = _parse_body(focus_row.get('body'))
        if bod:
            try:
                bod_s = json.dumps(bod, default=str, indent=2)
            except TypeError:
                bod_s = str(bod)
            lines.append(f'- **body** (JSON or text):\n```\n{_trunc(bod_s, 1500)}\n```')
        elif focus_row.get('body'):
            lines.append(f'- **body**: {_trunc(str(focus_row.get("body")), 1500)}')

    if timeline_rows:
        lines.append('### Key_dates_from_uploads')
        lines.append('| Phase / title | Dates | Note |')
        lines.append('| --- | --- | --- |')
        for r in timeline_rows:
            title = _trunc(str(r.get('title') or ''), 200)
            meta = r.get('metadata') if isinstance(r.get('metadata'), dict) else {}
            if not isinstance(meta, dict):
                meta = {}
            bod = _parse_body(r.get('body'))
            start = bod.get('start_date_iso') or meta.get('start_date_iso') or ''
            end = bod.get('end_date_iso') or meta.get('end_date_iso') or ''
            due = r.get('due_date')
            if hasattr(due, 'isoformat'):
                due_s = due.isoformat()
            else:
                due_s = str(due) if due else ''
            date_parts = [x for x in (start, end, due_s) if x]
            dates_cell = ' → '.join(date_parts) if date_parts else '—'
            note = bod.get('timeline_note') or bod.get('raw_label') or ''
            note = _trunc(str(note), BODY_TRUNC)
            lines.append(f'| {title} | {dates_cell} | {note} |')

    if other_open:
        lines.append('### Current_project_items')
        for r in other_open:
            typ = str(r.get('item_type') or '')
            tit = _trunc(str(r.get('title') or ''), 240)
            bod = _parse_body(r.get('body'))
            extra = ''
            if bod:
                frag = bod.get('question') or bod.get('summary') or bod.get('description') or bod.get('risk')
                if isinstance(frag, dict):
                    frag = json.dumps(frag, default=str)[:BODY_TRUNC]
                if frag:
                    extra = f' — {_trunc(str(frag), BODY_TRUNC)}'
            lines.append(f'- **{typ}** (id {r.get("id")}): {tit}{extra}')

    text = '\n'.join(lines)
    if len(text) > MAX_REGISTRY_CHARS:
        text = text[: MAX_REGISTRY_CHARS - len(TRUNC_FOOTER)] + TRUNC_FOOTER
    return text

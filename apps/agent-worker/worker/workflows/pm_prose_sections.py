"""Extract PM list fields from markdown-style model prose (grammar / schema fallback)."""

from __future__ import annotations

import re
from typing import Any

from worker.workflows.pm_structured_cleanup import pm_lists_effectively_empty
from worker.workflows.schemas import (
    PM_MAX_ANOMALIES,
    PM_MAX_COSTS,
    PM_MAX_DECISIONS,
    PM_MAX_RISKS,
    PM_MAX_STRING_LIST,
    PM_MAX_TASKS,
)

_HEADING_LINE = re.compile(r'^(#{1,3}\s+(.+?)\s*|\*\*(.+?)\*\*)\s*$')
_BULLET_LINE = re.compile(r'^\s*[\*\-+]\s+(.+)$')
_SKIP_TASK = re.compile(r'^tasks?\[\s*\]\s*$', re.I)
_NO_RISK = re.compile(r'^no\s+risks?\b', re.I)
_MIN_PROSE_LEN = 80


def _heading_label(line: str) -> str | None:
    m = _HEADING_LINE.match(line.strip())
    if not m:
        return None
    inner = (m.group(2) or m.group(3) or '').strip()
    return inner.lower() if inner else None


def _canonical_section(label: str) -> str | None:
    if not label:
        return None
    key = label.strip().lower().rstrip(':')
    aliases = {
        'task': 'tasks',
        'action items': 'tasks',
        'concrete next steps': 'tasks',
        'risks': 'risks',
        'risk': 'risks',
        'costs': 'costs',
        'cost': 'costs',
        'anomalies': 'anomalies',
        'anomaly': 'anomalies',
        'recommended next actions': 'recommended_next_actions',
        'next actions': 'recommended_next_actions',
        'decisions': 'decisions',
        'decision': 'decisions',
        'open questions': 'open_questions',
        'questions': 'open_questions',
        'reflections': 'reflections',
        'summary': 'summary',
    }
    if key in aliases:
        return aliases[key]
    if key in aliases.values():
        return key
    return None


def _section_bodies(text: str) -> dict[str, str]:
    """Split ``text`` on markdown headings into canonical section -> body (remaining lines)."""
    lines = text.splitlines()
    chunks: dict[str, list[str]] = {}
    current_key: str | None = None
    buf: list[str] = []

    def flush() -> None:
        nonlocal buf, current_key
        if current_key is None:
            buf = []
            return
        if buf:
            chunks.setdefault(current_key, []).extend(buf)
        buf = []

    for line in lines:
        lbl = _heading_label(line)
        canon = _canonical_section(lbl) if lbl else None
        if canon:
            flush()
            current_key = canon
        elif current_key is not None:
            buf.append(line)
    flush()
    return {k: '\n'.join(v).strip() for k, v in chunks.items()}


def _bullets_from_body(body: str) -> list[str]:
    out: list[str] = []
    for line in body.splitlines():
        m = _BULLET_LINE.match(line)
        if not m:
            continue
        t = m.group(1).strip()
        if not t or _SKIP_TASK.match(t):
            continue
        out.append(t)
    return out


def _task_item(text: str) -> dict[str, Any]:
    title = text.split('\n')[0].strip()
    if len(title) > 500:
        title = title[:497] + '...'
    desc = text.strip()
    if len(desc) > 4000:
        desc = desc[:4000]
    return {
        'title': title,
        'description': desc,
        'priority': 'medium',
        'status': 'not_started',
        'owner': None,
        'due_date': None,
        'dependencies': [],
        'acceptance_criteria': [],
    }


def _risk_item(text: str) -> dict[str, Any]:
    if _NO_RISK.match(text.strip()):
        return {}
    stmt = text.split('\n')[0].strip()
    if len(stmt) > 800:
        stmt = stmt[:797] + '...'
    return {
        'risk': stmt or text[:500],
        'impact': 'medium',
        'likelihood': 'medium',
        'mitigation': text[:800] if len(text) > len(stmt) else '',
    }


def _cost_item(text: str) -> dict[str, Any]:
    title = text.split('\n')[0].strip()
    if len(title) > 220:
        title = title[:217] + '...'
    return {'title': title or 'Cost line', 'cost': text[:2000], 'description': text[:2000]}


def _anomaly_item(text: str) -> dict[str, Any]:
    title = text.split('\n')[0].strip()
    if len(title) > 220:
        title = title[:217] + '...'
    return {'title': title or 'Anomaly', 'note': text[:2000], 'description': text[:2000]}


def _decision_item(text: str) -> dict[str, Any]:
    title = text.split('\n')[0].strip()
    if len(title) > 220:
        title = title[:217] + '...'
    return {'title': title or 'Decision', 'description': text[:2000]}


def merge_prose_sections_into_pm_if_lists_empty(out: dict) -> bool:
    """
    If tasks/risks/costs/anomalies are still empty, parse ``out['summary']`` as markdown
    with **Section** / ## headings and bullet lines. Mutates ``out``. Returns True if any list changed.
    """
    if not isinstance(out, dict):
        return False
    if not pm_lists_effectively_empty(out):
        return False
    text = out.get('summary')
    if not isinstance(text, str) or len(text.strip()) < _MIN_PROSE_LEN:
        return False
    bodies = _section_bodies(text)
    if not bodies:
        return False

    changed = False

    def extend_list(key: str, new_items: list[Any], cap: int) -> None:
        nonlocal changed
        xs = out.get(key)
        if not isinstance(xs, list):
            xs = []
            out[key] = xs
        for item in new_items:
            if len(xs) >= cap:
                break
            if isinstance(item, dict) and not any(item.values()) and key == 'risks':
                continue
            if isinstance(item, dict) and key == 'risks' and not item.get('risk'):
                continue
            xs.append(item)
            changed = True

    raw_tasks = bodies.get('tasks') or ''
    task_lines = _bullets_from_body(raw_tasks)
    task_objs = [_task_item(t) for t in task_lines[: PM_MAX_TASKS * 2]][:PM_MAX_TASKS]
    if task_objs:
        extend_list('tasks', task_objs, PM_MAX_TASKS)

    raw_risks = bodies.get('risks') or ''
    risk_lines = _bullets_from_body(raw_risks)
    risk_objs = []
    for t in risk_lines:
        o = _risk_item(t)
        if o:
            risk_objs.append(o)
    risk_objs = risk_objs[:PM_MAX_RISKS]
    if risk_objs:
        extend_list('risks', risk_objs, PM_MAX_RISKS)

    raw_costs = bodies.get('costs') or ''
    cost_lines = _bullets_from_body(raw_costs)
    cost_objs = [_cost_item(t) for t in cost_lines[:PM_MAX_COSTS]]
    if cost_objs:
        extend_list('costs', cost_objs, PM_MAX_COSTS)

    raw_anom = bodies.get('anomalies') or ''
    anom_lines = _bullets_from_body(raw_anom)
    anom_objs = [_anomaly_item(t) for t in anom_lines[:PM_MAX_ANOMALIES]]
    if anom_objs:
        extend_list('anomalies', anom_objs, PM_MAX_ANOMALIES)

    raw_rec = bodies.get('recommended_next_actions') or ''
    rec_lines = _bullets_from_body(raw_rec)
    if rec_lines:
        cur = out.get('recommended_next_actions')
        if not isinstance(cur, list):
            cur = []
            out['recommended_next_actions'] = cur
        for s in rec_lines:
            if len(cur) >= PM_MAX_STRING_LIST:
                break
            cur.append(s[:2000])
            changed = True

    raw_oq = bodies.get('open_questions') or ''
    oq_lines = _bullets_from_body(raw_oq)
    if oq_lines:
        cur = out.get('open_questions')
        if not isinstance(cur, list):
            cur = []
            out['open_questions'] = cur
        for s in oq_lines:
            if s.lower().startswith('none'):
                continue
            if len(cur) >= PM_MAX_STRING_LIST:
                break
            cur.append(s[:2000])
            changed = True

    raw_dec = bodies.get('decisions') or ''
    dec_lines = _bullets_from_body(raw_dec)
    dec_objs = [_decision_item(t) for t in dec_lines[:PM_MAX_DECISIONS]]
    if dec_objs:
        extend_list('decisions', dec_objs, PM_MAX_DECISIONS)

    raw_refl = bodies.get('reflections') or ''
    refl_lines = _bullets_from_body(raw_refl)
    if refl_lines:
        cur = out.setdefault('reflections', [])
        if not isinstance(cur, list):
            cur = []
            out['reflections'] = cur
        for s in refl_lines:
            if len(cur) >= PM_MAX_STRING_LIST:
                break
            cur.append(s[:2000])
            changed = True

    return changed

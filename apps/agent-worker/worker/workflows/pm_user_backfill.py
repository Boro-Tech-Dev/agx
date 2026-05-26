"""Deterministic PM structured output when the model leaves lists empty.

Parses common Update / Cost / Impact labeled lines from the raw user request.
No database imports — safe to unit test without Postgres.
"""

from __future__ import annotations

import re

from .pm_structured_cleanup import pm_lists_effectively_empty

_LABEL_LINE = re.compile(r'(?mi)^(Update|Cost|Impact)\s*:\s*(.+)$')


def _strip_cost_duration_suffix(fragment: str) -> str:
    s = fragment.strip()
    lower = s.lower()
    for marker in (' for ', ' @ '):
        i = lower.find(marker)
        if i != -1 and i > 3:
            s = s[:i].strip()
            lower = s.lower()
    return s


def _cost_line_to_items(cost_text: str) -> list[dict]:
    raw = cost_text.strip()
    head = _strip_cost_duration_suffix(raw)
    parts = re.split(r'\s+and\s+', head, flags=re.IGNORECASE)
    items: list[dict] = []
    for p in parts:
        p = re.sub(r'^\d+\s+', '', p.strip())
        if not p:
            continue
        title = p[0].upper() + p[1:] if len(p) > 1 else p.upper()
        items.append({'title': title, 'description': raw, 'note': raw})
    return items if items else [{'title': 'Resourcing cost', 'description': raw, 'note': raw}]


def backfill_pm_lists_from_user_text(out: dict, user_text: str) -> bool:
    """
    If the model returned empty lists but the user used Update/Cost/Impact labels,
    populate tasks, costs, risks, and anomalies deterministically.
    Returns True when out was modified.
    """
    if not isinstance(out, dict):
        return False
    ut = (user_text or '').strip()
    if not ut:
        return False
    tasks = list(out.get('tasks') or [])
    risks = list(out.get('risks') or [])
    costs = list(out.get('costs') or [])
    anomalies = list(out.get('anomalies') or [])
    if not pm_lists_effectively_empty(out):
        return False
    matches = list(_LABEL_LINE.finditer(ut))
    if not matches:
        return False
    by_label: dict[str, str] = {}
    for m in matches:
        by_label[m.group(1).lower()] = m.group(2).strip()
    changed = False
    upd = by_label.get('update')
    if upd:
        tasks.append(
            {
                'title': 'Scope / delivery update',
                'description': upd,
                'priority': 'high',
                'status': 'not_started',
            }
        )
        changed = True
        low = upd.lower()
        if any(x in low for x in ('more ', 'additional', 'extra ', 'new ', 'requested', 'another ')):
            anomalies.append(
                {
                    'title': 'Scope change noted in update',
                    'note': upd,
                    'description': upd,
                }
            )
            changed = True
    cost = by_label.get('cost')
    if cost:
        costs.extend(_cost_line_to_items(cost))
        changed = True
    impact = by_label.get('impact')
    if impact:
        risks.append(
            {
                'risk': 'Schedule, approval, or delivery impact',
                'impact': 'medium',
                'likelihood': 'medium',
                'mitigation': impact[:800],
            }
        )
        changed = True
    if not changed:
        return False
    out['tasks'] = tasks
    out['risks'] = risks
    out['costs'] = costs
    out['anomalies'] = anomalies
    rec = out.get('recommended_next_actions')
    if not isinstance(rec, list) or len(rec) == 0:
        out['recommended_next_actions'] = [
            'Confirm impacted dates and resourcing with the team',
            'Record the change for client and internal stakeholders',
        ]
    return True

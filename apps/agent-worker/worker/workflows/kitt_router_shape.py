"""KITT-only normalization before shared PM sanitization (no DB / heavy imports)."""

from __future__ import annotations

import json

from .pm_structured_cleanup import item_has_substance
from .schemas import (
    KITT_MAX_ANOMALIES,
    KITT_MAX_COSTS,
    KITT_MAX_RISKS,
    KITT_MAX_STRING_LIST,
    KITT_MAX_SUMMARY_LENGTH,
    KITT_MAX_TASKS,
)

_KITT_POP_EXTRA_KEYS = frozenset(
    {
        'project_registry_facts',
        'registry',
        'project_registry',
    }
)
_OBJECT_LIST_KEYS = ('tasks', 'risks', 'costs', 'anomalies')


def _strip_leading_json_fence(s: str) -> str:
    t = s.strip()
    if not t.startswith('```'):
        return t
    first_nl = t.find('\n')
    if first_nl == -1:
        return t
    body = t[first_nl + 1 :]
    if '```' in body:
        body = body.rsplit('```', 1)[0]
    return body.strip()


def _try_parse_embedded_json_object(summary: str) -> dict | None:
    """If summary is a fenced or raw JSON object, return the parsed dict."""
    if not isinstance(summary, str) or not summary.strip():
        return None
    t = summary.strip()
    if t.startswith('```'):
        body = _strip_leading_json_fence(t)
    elif t.startswith('{'):
        body = t
    else:
        return None
    try:
        obj = json.loads(body)
    except json.JSONDecodeError:
        return None
    return obj if isinstance(obj, dict) else None


def _list_needs_merge_from_inner(list_key: str, outer: list | None) -> bool:
    if not isinstance(outer, list) or not outer:
        return True
    if list_key in ('tasks', 'risks', 'costs', 'anomalies'):
        if all(isinstance(x, str) for x in outer):
            return True
        return not any(item_has_substance(list_key, x) for x in outer)
    if list_key == 'recommended_next_actions':
        return not any(isinstance(x, str) and x.strip() for x in outer)
    return False


def kitt_coerce_router_shape(out: dict) -> bool:
    """Normalize small-model quirks before shared PM sanitization (mutates ``out``).

    Gemma-class models often emit ``tasks``/``risks`` as string arrays or put the full JSON
    object inside ``summary``; ``sanitize_pm_placeholder_rows`` would drop string rows.
    """
    if not isinstance(out, dict):
        return False
    changed = False
    for k in _KITT_POP_EXTRA_KEYS:
        if k in out:
            del out[k]
            changed = True

    embedded = _try_parse_embedded_json_object(out.get('summary') or '')
    if embedded:
        es = embedded.get('summary')
        if isinstance(es, str) and es.strip():
            out['summary'] = es.strip()[:KITT_MAX_SUMMARY_LENGTH]
            changed = True
        for key in ('tasks', 'risks', 'costs', 'anomalies', 'recommended_next_actions'):
            inner = embedded.get(key)
            if not isinstance(inner, list) or not inner:
                continue
            outer = out.get(key)
            if key == 'recommended_next_actions':
                if _list_needs_merge_from_inner(key, outer if isinstance(outer, list) else None):
                    out[key] = list(inner)
                    changed = True
            elif _list_needs_merge_from_inner(key, outer if isinstance(outer, list) else None):
                out[key] = list(inner)
                changed = True

    def _coerce_tasks(xs: list) -> tuple[list, bool]:
        ch = False
        acc: list = []
        for it in xs:
            if isinstance(it, str) and it.strip():
                acc.append(
                    {
                        'title': it.strip()[:320],
                        'description': None,
                        'priority': 'medium',
                        'status': 'not_started',
                        'owner': None,
                        'due_date': None,
                        'dependencies': [],
                        'acceptance_criteria': [],
                    }
                )
                ch = True
            elif isinstance(it, dict):
                acc.append(it)
            else:
                s = str(it).strip() if it is not None else ''
                if s:
                    acc.append(
                        {
                            'title': s[:320],
                            'description': None,
                            'priority': 'medium',
                            'status': 'not_started',
                            'owner': None,
                            'due_date': None,
                            'dependencies': [],
                            'acceptance_criteria': [],
                        }
                    )
                ch = True
        return acc, ch

    def _coerce_risks(xs: list) -> tuple[list, bool]:
        ch = False
        acc = []
        for it in xs:
            if isinstance(it, str) and it.strip():
                acc.append(
                    {
                        'risk': it.strip()[:800],
                        'impact': 'medium',
                        'likelihood': 'medium',
                        'mitigation': '',
                    }
                )
                ch = True
            elif isinstance(it, dict):
                acc.append(it)
            else:
                s = str(it).strip() if it is not None else ''
                if s:
                    acc.append(
                        {
                            'risk': s[:800],
                            'impact': 'medium',
                            'likelihood': 'medium',
                            'mitigation': '',
                        }
                    )
                ch = True
        return acc, ch

    def _coerce_costs(xs: list) -> tuple[list, bool]:
        ch = False
        acc = []
        for it in xs:
            if isinstance(it, str) and it.strip():
                t = it.strip()[:320]
                acc.append({'title': t, 'cost': '', 'description': '', 'note': '', 'amount': ''})
                ch = True
            elif isinstance(it, dict):
                acc.append(it)
            else:
                s = str(it).strip() if it is not None else ''
                if s:
                    acc.append({'title': s[:320], 'cost': '', 'description': '', 'note': '', 'amount': ''})
                ch = True
        return acc, ch

    def _coerce_anomalies(xs: list) -> tuple[list, bool]:
        ch = False
        acc = []
        for it in xs:
            if isinstance(it, str) and it.strip():
                t = it.strip()[:320]
                acc.append({'title': t, 'anomaly': '', 'note': '', 'description': ''})
                ch = True
            elif isinstance(it, dict):
                acc.append(it)
            else:
                s = str(it).strip() if it is not None else ''
                if s:
                    acc.append({'title': s[:320], 'anomaly': '', 'note': '', 'description': ''})
                ch = True
        return acc, ch

    def _coerce_rna(xs: list) -> tuple[list, bool]:
        ch = False
        acc = []
        for it in xs:
            if isinstance(it, str):
                if it.strip():
                    acc.append(it.strip()[:400])
                else:
                    ch = True
            elif isinstance(it, dict):
                title = (it.get('title') or it.get('action') or '').strip()
                if title:
                    acc.append(title[:400])
                    ch = True
                else:
                    ch = True
            else:
                s = str(it).strip()
                if s:
                    acc.append(s[:400])
                    ch = True
        return acc, ch

    for lk in _OBJECT_LIST_KEYS:
        xs = out.get(lk)
        if not isinstance(xs, list):
            continue
        if lk == 'tasks':
            new_xs, c = _coerce_tasks(xs)
        elif lk == 'risks':
            new_xs, c = _coerce_risks(xs)
        elif lk == 'costs':
            new_xs, c = _coerce_costs(xs)
        else:
            new_xs, c = _coerce_anomalies(xs)
        caps = {
            'tasks': KITT_MAX_TASKS,
            'risks': KITT_MAX_RISKS,
            'costs': KITT_MAX_COSTS,
            'anomalies': KITT_MAX_ANOMALIES,
        }
        cap = caps[lk]
        if len(new_xs) > cap:
            new_xs = new_xs[:cap]
            c = True
        if c or new_xs != xs:
            out[lk] = new_xs
            changed = True

    rna = out.get('recommended_next_actions')
    if isinstance(rna, list):
        new_rna, c = _coerce_rna(rna)
        if len(new_rna) > KITT_MAX_STRING_LIST:
            new_rna = new_rna[: KITT_MAX_STRING_LIST]
            c = True
        if c or new_rna != rna:
            out['recommended_next_actions'] = new_rna
            changed = True

    sm = out.get('summary')
    if isinstance(sm, str) and sm.strip().startswith('```'):
        again = _try_parse_embedded_json_object(sm)
        if again and isinstance(again.get('summary'), str) and again['summary'].strip():
            out['summary'] = again['summary'].strip()[:KITT_MAX_SUMMARY_LENGTH]
            changed = True
        else:
            out['summary'] = 'Triage from intake; see tasks and risks below.'[:KITT_MAX_SUMMARY_LENGTH]
            changed = True

    return changed

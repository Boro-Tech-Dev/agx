"""Strip vacuous PM structured rows and helpers for backfill / warnings.

Keeps logic free of worker.db / common to avoid import cycles.
"""

from __future__ import annotations

import re
from typing import Any

from worker.workflows.schemas import (
    PM_MAX_ACCEPTANCE_CRITERIA,
    PM_MAX_ANOMALIES,
    PM_MAX_COSTS,
    PM_MAX_DECISIONS,
    PM_MAX_RISKS,
    PM_MAX_STRING_LIST,
    PM_MAX_SUMMARY_LENGTH,
    PM_MAX_TASKS,
    PM_MAX_TASK_DEPS,
)

_WS_RE = re.compile(r'\s+')
# Em dash, en dash, or spaced hyphen — split duplicate "A — A" model glitches
_EM_DASH_SPLIT = re.compile(r'\s*(?:—|–)\s*|\s+-\s+')

_PM_LIST_KEYS = ('tasks', 'risks', 'costs', 'anomalies', 'decisions')

_PM_NORMALIZE_LIST_KEYS = (
    'assumptions',
    'open_questions',
    'decisions',
    'tasks',
    'risks',
    'costs',
    'anomalies',
    'recommended_next_actions',
    'reflections',
)
_PM_NORMALIZE_STR_KEYS = ('summary', 'project_context')


def normalize_pm_router_payload(parsed: dict, raw_content: str) -> None:
    """
    Ensure PM-shaped dict has expected top-level keys and a non-empty summary when the router
    returned raw ``content`` but an empty or vacuous JSON object (e.g. grammar fallback).
    Mutates ``parsed`` in place.
    """
    if not isinstance(parsed, dict):
        return
    for k in _PM_NORMALIZE_STR_KEYS:
        v = parsed.get(k)
        if v is None:
            parsed[k] = ''
        elif not isinstance(v, str):
            parsed[k] = str(v)[:PM_MAX_SUMMARY_LENGTH]
    for k in _PM_NORMALIZE_LIST_KEYS:
        if not isinstance(parsed.get(k), list):
            parsed[k] = []
    summ = parsed.get('summary', '')
    raw = (raw_content or '').strip()
    if isinstance(summ, str) and not summ.strip() and raw:
        parsed['summary'] = raw[:PM_MAX_SUMMARY_LENGTH]
    elif isinstance(parsed.get('summary'), str) and len(parsed['summary']) > PM_MAX_SUMMARY_LENGTH:
        parsed['summary'] = parsed['summary'][:PM_MAX_SUMMARY_LENGTH]

# Keys that indicate a row has user-visible substance (aligned with persist/UI expectations).
_SUBSTANCE_KEYS: dict[str, tuple[str, ...]] = {
    'tasks': ('title', 'task', 'description'),
    'risks': ('risk', 'title', 'description', 'mitigation'),
    'costs': ('title', 'cost', 'description', 'note'),
    'anomalies': ('title', 'anomaly', 'note', 'description'),
    'decisions': ('title', 'decision', 'description', 'name'),
}


def _nonempty_str(v: Any) -> bool:
    return isinstance(v, str) and bool(v.strip())


def item_has_substance(list_key: str, item: Any) -> bool:
    if not isinstance(item, dict):
        return False
    for k in _SUBSTANCE_KEYS.get(list_key, ('title', 'description')):
        v = item.get(k)
        if _nonempty_str(v):
            return True
    return False


def pm_lists_effectively_empty(out: dict) -> bool:
    """True when tasks, risks, costs, and anomalies contain no substantive rows."""
    if not isinstance(out, dict):
        return True
    for key in ('tasks', 'risks', 'costs', 'anomalies'):
        xs = out.get(key)
        if not isinstance(xs, list):
            continue
        for item in xs:
            if item_has_substance(key, item):
                return False
    return True


def sanitize_pm_placeholder_rows(out: dict) -> bool:
    """
    Remove list entries that are vacuous objects (e.g. {}), preserving order.
    Returns True if any list was modified.
    """
    if not isinstance(out, dict):
        return False
    changed = False
    for key in _PM_LIST_KEYS:
        xs = out.get(key)
        if not isinstance(xs, list):
            continue
        kept = [item for item in xs if item_has_substance(key, item)]
        if len(kept) != len(xs):
            out[key] = kept
            changed = True
    return changed


_PARSE_WARNING_MSG = (
    'Tasks and risks lists are empty while the summary is long—other panels may still be complete. '
    'Use Raw JSON only if you expected explicit task/risk rows.'
)


def _nonempty_pm_string_list(xs: Any) -> bool:
    if not isinstance(xs, list):
        return False
    return any(isinstance(x, str) and bool(x.strip()) for x in xs)


def pm_has_structured_signal_beyond_tasks_risks(parsed: dict) -> bool:
    """True when empty tasks/risks alone is not a reliable failure signal (content lives elsewhere)."""
    if not isinstance(parsed, dict):
        return False
    for key in ('decisions', 'costs', 'anomalies'):
        xs = parsed.get(key)
        if not isinstance(xs, list):
            continue
        for item in xs:
            if item_has_substance(key, item):
                return True
    for sk in ('recommended_next_actions', 'open_questions', 'assumptions', 'reflections'):
        if _nonempty_pm_string_list(parsed.get(sk)):
            return True
    return False


def collapse_duplicate_em_dash_phrase(s: str) -> str:
    """
    If a string is two halves separated by an em/en dash or spaced hyphen, and the halves
    are the same (normalized), return a single copy. Repeats until stable.
    """
    if not isinstance(s, str):
        return s
    cur = s
    prev: str | None = None
    while prev != cur:
        prev = cur
        parts = _EM_DASH_SPLIT.split(cur, 1)
        if len(parts) != 2:
            break
        a, b = parts[0].strip(), parts[1].strip()
        if a and normalize_pm_dedupe_label(a) == normalize_pm_dedupe_label(b):
            cur = a
    return cur


def sanitize_pm_duplicate_em_dash_phrases(out: dict) -> dict[str, Any]:
    """
    Collapse duplicated "sentence — same sentence" patterns in common PM string fields.
    Mutates ``out`` in place.
    """
    if not isinstance(out, dict):
        return {'changed': False, 'updated': 0}

    n = 0

    def touch(val: str) -> str:
        nonlocal n
        new_v = collapse_duplicate_em_dash_phrase(val)
        if new_v != val:
            n += 1
        return new_v

    for sk in ('summary', 'project_context'):
        v = out.get(sk)
        if isinstance(v, str) and v:
            new_v = touch(v)
            if new_v != v:
                out[sk] = new_v

    for list_key in ('assumptions', 'open_questions', 'recommended_next_actions', 'reflections'):
        xs = out.get(list_key)
        if not isinstance(xs, list):
            continue
        new_list: list[Any] = []
        for item in xs:
            if isinstance(item, str) and item:
                new_list.append(touch(item))
            else:
                new_list.append(item)
        if new_list != xs:
            out[list_key] = new_list

    for list_key, str_fields in (
        ('tasks', ('title', 'description', 'task', 'owner', 'due_date', 'status', 'priority')),
        ('risks', ('risk', 'title', 'description', 'impact', 'likelihood', 'mitigation')),
        ('costs', ('title', 'cost', 'description', 'note', 'amount')),
        ('anomalies', ('title', 'anomaly', 'note', 'description')),
        ('decisions', ('title', 'decision', 'description', 'name', 'status')),
    ):
        xs = out.get(list_key)
        if not isinstance(xs, list):
            continue
        for item in xs:
            if not isinstance(item, dict):
                continue
            for fk in str_fields:
                fv = item.get(fk)
                if isinstance(fv, str) and fv:
                    nv = touch(fv)
                    if nv != fv:
                        item[fk] = nv

    return {'changed': n > 0, 'updated': n}


def promote_non_question_open_questions_to_tasks(out: dict) -> dict[str, Any]:
    """
    When tasks[] has no substantive rows, move open_questions entries that look like
    imperative work (no ``?``) into tasks as titles. Reduces misclassification by small models.
    Mutates ``out`` in place.
    """
    if not isinstance(out, dict):
        return {'changed': False, 'promoted': 0}
    tasks = out.get('tasks')
    if not isinstance(tasks, list):
        tasks = []
        out['tasks'] = tasks
    if any(item_has_substance('tasks', t) for t in tasks):
        return {'changed': False, 'promoted': 0}
    oq = out.get('open_questions')
    if not isinstance(oq, list) or not oq:
        return {'changed': False, 'promoted': 0}

    kept_oq: list[Any] = []
    promoted = 0
    for item in oq:
        if not isinstance(item, str):
            kept_oq.append(item)
            continue
        s = item.strip()
        if not s:
            continue
        if '?' in s:
            kept_oq.append(item)
            continue
        if len(tasks) >= PM_MAX_TASKS:
            kept_oq.append(item)
            continue
        tasks.append({'title': s[:500]})
        promoted += 1

    if promoted:
        out['open_questions'] = kept_oq
    return {'changed': promoted > 0, 'promoted': promoted}


def normalize_pm_dedupe_label(s: str) -> str:
    """Match workspace `normalizeProjectItemDedupeLabel`: trim, lower, collapse whitespace."""
    if not isinstance(s, str):
        return ''
    return _WS_RE.sub(' ', s.strip()).lower()


def _object_dedupe_key(list_key: str, item: Any) -> str:
    """Primary headline for duplicate detection (aligned with persist/UI title extraction)."""
    if not isinstance(item, dict):
        return ''
    if list_key == 'tasks':
        for k in ('title', 'task', 'description'):
            v = item.get(k)
            if isinstance(v, str) and v.strip():
                return normalize_pm_dedupe_label(v.split('\n')[0][:500])
    elif list_key == 'risks':
        for k in ('risk', 'title', 'description'):
            v = item.get(k)
            if isinstance(v, str) and v.strip():
                return normalize_pm_dedupe_label(v.split('\n')[0][:500])
    elif list_key == 'costs':
        for k in ('title', 'cost', 'description', 'note'):
            v = item.get(k)
            if isinstance(v, str) and v.strip():
                return normalize_pm_dedupe_label(v.split('\n')[0][:500])
    elif list_key == 'anomalies':
        for k in ('title', 'anomaly', 'note', 'description'):
            v = item.get(k)
            if isinstance(v, str) and v.strip():
                return normalize_pm_dedupe_label(v.split('\n')[0][:500])
    elif list_key == 'decisions':
        for k in ('title', 'decision', 'description', 'name'):
            v = item.get(k)
            if isinstance(v, str) and v.strip():
                return normalize_pm_dedupe_label(v.split('\n')[0][:500])
    return ''


def clamp_pm_structured_to_schema_caps(out: dict) -> dict[str, Any]:
    """
    After unstructured router fallback, enforce the same numeric bounds as JSON Schema (first N kept).
    Mutates ``out`` in place. Returns stats for ``workflow.pm.clamp`` events.
    """
    if not isinstance(out, dict):
        return {'changed': False, 'clamped': {}, 'clamped_total': 0}

    clamped_detail: dict[str, int] = {}
    total = 0

    for key in ('summary', 'project_context'):
        v = out.get(key)
        if isinstance(v, str) and len(v) > PM_MAX_SUMMARY_LENGTH:
            dropped_chars = len(v) - PM_MAX_SUMMARY_LENGTH
            out[key] = v[:PM_MAX_SUMMARY_LENGTH]
            clamped_detail[key] = dropped_chars
            total += dropped_chars

    string_keys = ('assumptions', 'open_questions', 'recommended_next_actions', 'reflections')
    for sk in string_keys:
        xs = out.get(sk)
        if isinstance(xs, list) and len(xs) > PM_MAX_STRING_LIST:
            dropped = len(xs) - PM_MAX_STRING_LIST
            del xs[PM_MAX_STRING_LIST:]
            clamped_detail[sk] = dropped
            total += dropped

    object_limits = (
        ('tasks', PM_MAX_TASKS),
        ('risks', PM_MAX_RISKS),
        ('costs', PM_MAX_COSTS),
        ('anomalies', PM_MAX_ANOMALIES),
        ('decisions', PM_MAX_DECISIONS),
    )
    for ok, lim in object_limits:
        xs = out.get(ok)
        if isinstance(xs, list) and len(xs) > lim:
            dropped = len(xs) - lim
            del xs[lim:]
            clamped_detail[ok] = dropped
            total += dropped

    tasks = out.get('tasks')
    if isinstance(tasks, list):
        deps_trimmed = 0
        ac_trimmed = 0
        for item in tasks:
            if not isinstance(item, dict):
                continue
            deps = item.get('dependencies')
            if isinstance(deps, list) and len(deps) > PM_MAX_TASK_DEPS:
                deps_trimmed += len(deps) - PM_MAX_TASK_DEPS
                item['dependencies'] = deps[:PM_MAX_TASK_DEPS]
            ac = item.get('acceptance_criteria')
            if isinstance(ac, list) and len(ac) > PM_MAX_ACCEPTANCE_CRITERIA:
                ac_trimmed += len(ac) - PM_MAX_ACCEPTANCE_CRITERIA
                item['acceptance_criteria'] = ac[:PM_MAX_ACCEPTANCE_CRITERIA]
        if deps_trimmed:
            clamped_detail['task_dependencies_dropped'] = deps_trimmed
            total += deps_trimmed
        if ac_trimmed:
            clamped_detail['task_acceptance_criteria_dropped'] = ac_trimmed
            total += ac_trimmed

    changed = total > 0 or bool(clamped_detail)
    return {'changed': changed, 'clamped': clamped_detail, 'clamped_total': total}


def dedupe_pm_structured_lists(out: dict) -> dict[str, Any]:
    """
    Collapse duplicate entries within PM-shaped structured output (first occurrence wins).
    Matches workspace dedupe by normalized headline for object lists and normalized text for string lists.
    Returns stats suitable for run_events JSON (no DB).
    """
    if not isinstance(out, dict):
        return {'changed': False, 'removed': {}, 'removed_total': 0}

    removed: dict[str, int] = {}
    removed_total = 0

    string_keys = ('assumptions', 'open_questions', 'recommended_next_actions', 'reflections')
    for sk in string_keys:
        xs = out.get(sk)
        if not isinstance(xs, list) or not xs:
            continue
        seen: set[str] = set()
        kept: list[Any] = []
        n_drop = 0
        for item in xs:
            if not isinstance(item, str):
                kept.append(item)
                continue
            key = normalize_pm_dedupe_label(item)
            if key in seen:
                n_drop += 1
                continue
            seen.add(key)
            kept.append(item)
        if n_drop:
            out[sk] = kept
            removed[sk] = n_drop
            removed_total += n_drop

    object_keys = ('tasks', 'risks', 'costs', 'anomalies', 'decisions')
    for ok in object_keys:
        xs = out.get(ok)
        if not isinstance(xs, list) or not xs:
            continue
        seen: set[str] = set()
        kept: list[Any] = []
        n_drop = 0
        for item in xs:
            if isinstance(item, str):
                key = normalize_pm_dedupe_label(item)
            elif isinstance(item, dict):
                key = _object_dedupe_key(ok, item)
            else:
                key = ''
            if not key:
                kept.append(item)
                continue
            if key in seen:
                n_drop += 1
                continue
            seen.add(key)
            kept.append(item)
        if n_drop:
            out[ok] = kept
            removed[ok] = n_drop
            removed_total += n_drop

    return {'changed': removed_total > 0, 'removed': removed, 'removed_total': removed_total}


_MIN_TASK_DESC_HEADLINE_LEN = 8


def _collect_pm_task_headline_keys(tasks: list[Any]) -> set[str]:
    """Normalized first-line keys from task title (and distinct description headline when substantive)."""
    keys: set[str] = set()
    for item in tasks:
        if not isinstance(item, dict):
            continue
        title_key = ''
        for field in ('title', 'task'):
            v = item.get(field)
            if isinstance(v, str) and v.strip():
                title_key = normalize_pm_dedupe_label(v.split('\n')[0][:500])
                if title_key:
                    keys.add(title_key)
                break
        desc = item.get('description')
        if isinstance(desc, str) and desc.strip():
            dk = normalize_pm_dedupe_label(desc.split('\n')[0][:500])
            if dk and dk != title_key and len(dk) >= _MIN_TASK_DESC_HEADLINE_LEN:
                keys.add(dk)
    return keys


def _prune_string_list_matching_task_keys(out: dict, list_key: str, task_keys: set[str]) -> int:
    xs = out.get(list_key)
    if not isinstance(xs, list) or not xs or not task_keys:
        return 0
    kept: list[Any] = []
    n_drop = 0
    for item in xs:
        if not isinstance(item, str):
            kept.append(item)
            continue
        head = item.split('\n')[0][:500]
        nk = normalize_pm_dedupe_label(head)
        if nk and nk in task_keys:
            n_drop += 1
            continue
        kept.append(item)
    if n_drop:
        out[list_key] = kept
    return n_drop


def prune_pm_cross_list_duplicates(out: dict) -> dict[str, Any]:
    """
    Drop recommended_next_actions entries whose normalized first line exactly matches a task title
    (or a substantive task description headline). Does not alter open_questions (avoid dropping
    legitimate questions). Conservative: no substring matching. Mutates ``out`` in place.
    Call after ``dedupe_pm_structured_lists`` (and after any task promotion).
    """
    if not isinstance(out, dict):
        return {'changed': False, 'removed': {}, 'removed_total': 0}
    tasks = out.get('tasks')
    if not isinstance(tasks, list) or not tasks:
        return {'changed': False, 'removed': {}, 'removed_total': 0}
    task_keys = _collect_pm_task_headline_keys(tasks)
    if not task_keys:
        return {'changed': False, 'removed': {}, 'removed_total': 0}

    removed: dict[str, int] = {}
    removed_total = 0
    n = _prune_string_list_matching_task_keys(out, 'recommended_next_actions', task_keys)
    if n:
        removed['recommended_next_actions'] = n
        removed_total += n
    return {'changed': removed_total > 0, 'removed': removed, 'removed_total': removed_total}


def attach_parse_warning_if_substantive_summary_empty_core_lists(parsed: dict) -> None:
    if not isinstance(parsed, dict):
        return
    summary = (parsed.get('summary') or '').strip()
    if len(summary) < 80:
        return
    tasks = parsed.get('tasks') if isinstance(parsed.get('tasks'), list) else []
    risks = parsed.get('risks') if isinstance(parsed.get('risks'), list) else []
    if len(tasks) > 0 or len(risks) > 0:
        return
    if pm_has_structured_signal_beyond_tasks_risks(parsed):
        return
    parsed['parse_warning'] = _PARSE_WARNING_MSG

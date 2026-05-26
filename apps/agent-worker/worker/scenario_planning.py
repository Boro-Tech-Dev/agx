"""Delivery scenario: CSV-native timeline (calendar dates per step). Keep parsing rules aligned with apps/web-dashboard/lib/halScenario.ts.

Parametric schedule math (dashboard parity) lives in ``worker.scenario_engine`` and ``run_scenario_engine_compute`` / ``run_scenario_engine_find_latest_kickoff``.
"""

from __future__ import annotations

import csv
import io
import re
from datetime import date
from typing import Any

_ISO_DATE = re.compile(r'^\d{4}-\d{2}-\d{2}$')


def _strip_bom(s: str) -> str:
    if s.startswith('\ufeff'):
        return s[1:]
    return s


def _normalize_header_key(h: str) -> str:
    return ' '.join(h.strip().lower().split())


def _parse_iso_date(s: str, ctx: str) -> tuple[str | None, str | None]:
    t = s.strip()
    if not _ISO_DATE.match(t):
        return None, f'{ctx} must be YYYY-MM-DD'
    try:
        date.fromisoformat(t)
    except ValueError:
        return None, f'{ctx} is not a valid calendar date'
    return t, None


def parse_steps_from_csv_text(text: str) -> tuple[list[dict[str, Any]] | None, str | None]:
    raw = _strip_bom((text or '').strip())
    if not raw:
        return None, 'csv_text is empty'
    f = io.StringIO(raw)
    reader = csv.DictReader(f)
    if not reader.fieldnames:
        return None, 'CSV has no header row'
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
        return None, 'CSV must include columns: Task, Start Date, End Date (optional: Note)'
    tk, sk, ek = mapping['task'], mapping['start'], mapping['end']
    nk = mapping.get('note')
    ak = mapping.get('allow_non_working')
    out: list[dict[str, Any]] = []
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
            return None, f'CSV row {row_num}: Task is required'
        sd, e1 = _parse_iso_date(sd_raw, f'CSV row {row_num} Start Date')
        if e1:
            return None, e1
        ed, e2 = _parse_iso_date(ed_raw, f'CSV row {row_num} End Date')
        if e2:
            return None, e2
        assert sd is not None and ed is not None
        if date.fromisoformat(ed) < date.fromisoformat(sd):
            return None, f'CSV row {row_num}: End Date must be on or after Start Date'
        rec: dict[str, Any] = {'task': task, 'start_date': sd, 'end_date': ed, 'note': note_raw}
        if allow_raw in ('true', '1', 'yes'):
            rec['allow_non_working_days'] = True
        elif allow_raw in ('false', '0', 'no'):
            rec['allow_non_working_days'] = False
        elif allow_raw:
            return None, f'CSV row {row_num}: Allow non working days must be true/false if present'
        out.append(rec)
        row_num += 1
    if not out:
        return None, 'CSV has no data rows'
    return out, None


def parse_steps_from_json_list(raw_steps: Any) -> tuple[list[dict[str, Any]] | None, str | None]:
    if not isinstance(raw_steps, list):
        return None, 'steps must be a JSON array'
    if len(raw_steps) == 0:
        return None, 'steps array is empty'
    out: list[dict[str, Any]] = []
    for i, item in enumerate(raw_steps):
        if not isinstance(item, dict):
            return None, f'steps[{i}] must be an object'
        task = item.get('task')
        if not isinstance(task, str) or not task.strip():
            return None, f'steps[{i}].task is required'
        sd_raw = item.get('start_date')
        ed_raw = item.get('end_date')
        if not isinstance(sd_raw, str) or not isinstance(ed_raw, str):
            return None, f'steps[{i}].start_date and end_date must be strings (YYYY-MM-DD)'
        sd, e1 = _parse_iso_date(sd_raw, f'steps[{i}].start_date')
        if e1:
            return None, e1
        ed, e2 = _parse_iso_date(ed_raw, f'steps[{i}].end_date')
        if e2:
            return None, e2
        assert sd is not None and ed is not None
        if date.fromisoformat(ed) < date.fromisoformat(sd):
            return None, f'steps[{i}]: end_date must be on or after start_date'
        note_val = item.get('note')
        note_s = ''
        if note_val is not None:
            if not isinstance(note_val, str):
                return None, f'steps[{i}].note must be a string if present'
            note_s = note_val.strip()
        rec: dict[str, Any] = {'task': task.strip(), 'start_date': sd, 'end_date': ed, 'note': note_s}
        anw = item.get('allow_non_working_days')
        if anw is not None:
            if isinstance(anw, bool):
                rec['allow_non_working_days'] = anw
            else:
                return None, f'steps[{i}].allow_non_working_days must be a boolean if present'
        out.append(rec)
    return out, None


def parse_timeline_scenario(raw: dict[str, Any]) -> tuple[list[dict[str, Any]] | None, str | None]:
    """
    If both `steps` (non-empty list) and `csv_text` are present, `steps` wins.
    """
    steps_param = raw.get('steps')
    csv_text = raw.get('csv_text')
    has_steps = isinstance(steps_param, list) and len(steps_param) > 0
    if has_steps:
        return parse_steps_from_json_list(steps_param)
    if isinstance(csv_text, str) and csv_text.strip():
        return parse_steps_from_csv_text(csv_text)
    if isinstance(steps_param, list) and len(steps_param) == 0:
        return None, 'steps array is empty; provide csv_text or non-empty steps'
    if csv_text is not None and isinstance(csv_text, str) and not csv_text.strip():
        return None, 'csv_text is empty; provide non-empty csv_text or steps'
    if steps_param is not None and not isinstance(steps_param, list):
        return None, 'steps must be a JSON array when present'
    if csv_text is not None and not isinstance(csv_text, str):
        return None, 'csv_text must be a string when present'
    return None, 'scenario must include non-empty csv_text or a non-empty steps array'


def _step_allows_non_working(s: dict[str, Any]) -> bool:
    return s.get('allow_non_working_days') is True


def _calendar_basis_for_steps(steps: list[dict[str, Any]]) -> str:
    any_allow = any(_step_allows_non_working(s) for s in steps)
    any_working = any(not _step_allows_non_working(s) for s in steps)
    if any_allow and any_working:
        return 'mixed'
    if any_allow:
        return 'calendar_days'
    return 'working_days_us'


def compute_scenario_snapshot(steps: list[dict[str, Any]]) -> dict[str, Any]:
    starts = [date.fromisoformat(str(s['start_date'])) for s in steps]
    ends = [date.fromisoformat(str(s['end_date'])) for s in steps]
    return {
        'version': 2,
        'calendar_basis': _calendar_basis_for_steps(steps),
        'steps': steps,
        'overall_start_date': min(starts).isoformat(),
        'overall_end_date': max(ends).isoformat(),
        'step_count': len(steps),
    }


def _md_escape_cell(s: str) -> str:
    return s.replace('|', '\\|').replace('\n', ' ')


def format_scenario_facts_block(snapshot: dict[str, Any]) -> str:
    basis = str(snapshot.get('calendar_basis') or 'calendar_days')
    basis_note = {
        'working_days_us': 'Steps use US working days (weekends and federal holidays excluded) unless marked.',
        'calendar_days': 'Steps use inclusive calendar days (may include weekends/holidays).',
        'mixed': 'Some steps use working days; others allow non-working days — see per-step column.',
    }.get(basis, basis)
    lines = [
        'The schedule below was supplied as structured timeline data (not regulatory advice). '
        'Use these step names and calendar dates as fixed assumptions; do not substitute different dates.',
        '',
        f'- Schedule basis: **{basis}** — {basis_note}',
        '',
        '| Task | Start date | End date | Non-working OK | Note |',
        '| --- | --- | --- | --- | --- |',
    ]
    for s in snapshot['steps']:
        note = s.get('note') or ''
        nw = 'Yes' if _step_allows_non_working(s) else ''
        lines.append(
            f"| {_md_escape_cell(str(s['task']))} | {s['start_date']} | {s['end_date']} | {nw} | {_md_escape_cell(str(note))} |"
        )
    lines.append('')
    lines.append(
        f"- Overall span: {snapshot['overall_start_date']} → {snapshot['overall_end_date']} "
        f"({snapshot['step_count']} steps)."
    )
    return '\n'.join(lines)


def run_scenario_engine_compute(body: dict[str, Any]) -> dict[str, Any]:
    """
    Dashboard-parity forward planner. Body uses camelCase keys like the TypeScript client.
    Returns ``{'ok': True, 'steps': [...]}`` or ``{'ok': False, 'error': str}``.
    """
    from worker.scenario_engine.compute_scenario_steps import compute_scenario_steps
    from worker.scenario_engine.timing_profiles import is_known_timing_profile, resolve_timing_profile_id

    tp_raw = body.get('timingProfile') or body.get('tactic') or 'generic_tactic'
    if not isinstance(tp_raw, str) or not tp_raw.strip():
        return {'ok': False, 'error': 'timingProfile or tactic must be a non-empty string'}
    timing_profile = resolve_timing_profile_id(tp_raw.strip())
    if not is_known_timing_profile(timing_profile):
        return {'ok': False, 'error': f'unknown timing profile: {tp_raw.strip()}'}
    anchor = body.get('anchorStartIso')
    if not isinstance(anchor, str) or not anchor.strip():
        return {'ok': False, 'error': 'anchorStartIso is required'}

    holidays_raw = body.get('holidays')
    holidays: frozenset[str] = frozenset()
    if isinstance(holidays_raw, list):
        holidays = frozenset(str(x) for x in holidays_raw if x)
    elif holidays_raw is not None:
        return {'ok': False, 'error': 'holidays must be a list of YYYY-MM-DD strings if present'}

    params: dict[str, Any] = {
        'timingProfile': timing_profile,
        'anchorStartIso': anchor.strip(),
        'holidays': holidays,
    }

    if body.get('complexity') is not None:
        c = body['complexity']
        if c not in ('basic', 'medium', 'complex'):
            return {'ok': False, 'error': 'complexity must be basic, medium, or complex'}
        params['complexity'] = c

    if body.get('clientReviewExtraCalendarDays') is not None:
        try:
            params['clientReviewExtraCalendarDays'] = int(body['clientReviewExtraCalendarDays'])
        except (TypeError, ValueError):
            return {'ok': False, 'error': 'clientReviewExtraCalendarDays must be an integer'}

    pmap = body.get('phaseAllowNonWorkingDays')
    if pmap is not None:
        if not isinstance(pmap, dict):
            return {'ok': False, 'error': 'phaseAllowNonWorkingDays must be an object'}
        params['phaseAllowNonWorkingDays'] = {str(k): bool(v) for k, v in pmap.items()}

    pap = body.get('prbAnchorPolicy')
    if pap is not None:
        if pap not in ('legacy', 'mon_wed'):
            return {'ok': False, 'error': 'prbAnchorPolicy must be legacy or mon_wed'}
        params['prbAnchorPolicy'] = pap

    pb = body.get('prbBrand')
    if pb is not None:
        if not isinstance(pb, dict):
            return {'ok': False, 'error': 'prbBrand must be an object'}
        params['prbBrand'] = pb

    am = body.get('activeModifierIds')
    if am is not None:
        if not isinstance(am, list):
            return {'ok': False, 'error': 'activeModifierIds must be an array of strings if present'}
        params['activeModifierIds'] = [str(x) for x in am if x is not None]

    if body.get('pageCount') is not None:
        try:
            params['pageCount'] = int(body['pageCount'])
        except (TypeError, ValueError):
            return {'ok': False, 'error': 'pageCount must be an integer'}

    fz_raw = body.get('freezeAfterStepIndex')
    ps_raw = body.get('pinnedPrefixSteps')
    if fz_raw is not None or ps_raw is not None:
        if fz_raw is None or ps_raw is None:
            return {'ok': False, 'error': 'freezeAfterStepIndex and pinnedPrefixSteps must be provided together.'}
        if isinstance(fz_raw, bool) or not isinstance(fz_raw, int):
            return {'ok': False, 'error': 'freezeAfterStepIndex must be a JSON integer.'}
        if not isinstance(ps_raw, list):
            return {'ok': False, 'error': 'pinnedPrefixSteps must be a JSON array.'}
        params['freezeAfterStepIndex'] = fz_raw
        params['pinnedPrefixSteps'] = ps_raw

    r = compute_scenario_steps(params)  # type: ignore[arg-type]
    if r['ok']:
        payload: dict[str, Any] = {'ok': True, 'steps': r['steps'], 'breakdown': r['breakdown']}
        ob = r.get('opdp_binder_steps')
        if ob:
            payload['opdp_binder_steps'] = ob
        return payload
    return {'ok': False, 'error': r['error']}


def run_scenario_engine_find_latest_kickoff(body: dict[str, Any]) -> dict[str, Any]:
    """
    Dashboard-parity reverse planner (latest kickoff for a deadline). camelCase body keys.
    Returns ``{'ok': True, 'kickoffIso', 'steps'}`` or ``{'ok': False, 'error'}``.
    """
    from worker.scenario_engine.find_latest_kickoff import find_latest_kickoff_for_deadline
    from worker.scenario_engine.timing_profiles import is_known_timing_profile, resolve_timing_profile_id

    tp_raw = body.get('timingProfile') or body.get('tactic') or 'generic_tactic'
    if not isinstance(tp_raw, str) or not tp_raw.strip():
        return {'ok': False, 'error': 'timingProfile or tactic must be a non-empty string'}
    timing_profile = resolve_timing_profile_id(tp_raw.strip())
    if not is_known_timing_profile(timing_profile):
        return {'ok': False, 'error': f'unknown timing profile: {tp_raw.strip()}'}
    deadline = body.get('deadlineIso')
    if not isinstance(deadline, str) or not deadline.strip():
        return {'ok': False, 'error': 'deadlineIso is required'}
    anchor_phase = body.get('anchorPhaseId')
    if not isinstance(anchor_phase, str) or not anchor_phase.strip():
        return {'ok': False, 'error': 'anchorPhaseId is required'}

    holidays_raw = body.get('holidays')
    holidays: frozenset[str] = frozenset()
    if isinstance(holidays_raw, list):
        holidays = frozenset(str(x) for x in holidays_raw if x)
    elif holidays_raw is not None:
        return {'ok': False, 'error': 'holidays must be a list of YYYY-MM-DD strings if present'}

    params: dict[str, Any] = {
        'timingProfile': timing_profile,
        'deadlineIso': deadline.strip(),
        'anchorPhaseId': anchor_phase.strip(),
        'holidays': holidays,
    }

    if body.get('complexity') is not None:
        c = body['complexity']
        if c not in ('basic', 'medium', 'complex'):
            return {'ok': False, 'error': 'complexity must be basic, medium, or complex'}
        params['complexity'] = c

    if body.get('clientReviewExtraCalendarDays') is not None:
        try:
            params['clientReviewExtraCalendarDays'] = int(body['clientReviewExtraCalendarDays'])
        except (TypeError, ValueError):
            return {'ok': False, 'error': 'clientReviewExtraCalendarDays must be an integer'}

    pmap = body.get('phaseAllowNonWorkingDays')
    if pmap is not None:
        if not isinstance(pmap, dict):
            return {'ok': False, 'error': 'phaseAllowNonWorkingDays must be an object'}
        params['phaseAllowNonWorkingDays'] = {str(k): bool(v) for k, v in pmap.items()}

    pap = body.get('prbAnchorPolicy')
    if pap is not None:
        if pap not in ('legacy', 'mon_wed'):
            return {'ok': False, 'error': 'prbAnchorPolicy must be legacy or mon_wed'}
        params['prbAnchorPolicy'] = pap

    pb = body.get('prbBrand')
    if pb is not None:
        if not isinstance(pb, dict):
            return {'ok': False, 'error': 'prbBrand must be an object'}
        params['prbBrand'] = pb

    am = body.get('activeModifierIds')
    if am is not None:
        if not isinstance(am, list):
            return {'ok': False, 'error': 'activeModifierIds must be an array of strings if present'}
        params['activeModifierIds'] = [str(x) for x in am if x is not None]

    if body.get('pageCount') is not None:
        try:
            params['pageCount'] = int(body['pageCount'])
        except (TypeError, ValueError):
            return {'ok': False, 'error': 'pageCount must be an integer'}

    if body.get('searchWindowDays') is not None:
        try:
            params['searchWindowDays'] = int(body['searchWindowDays'])
        except (TypeError, ValueError):
            return {'ok': False, 'error': 'searchWindowDays must be an integer'}

    r = find_latest_kickoff_for_deadline(params)  # type: ignore[arg-type]
    if r['ok']:
        return {'ok': True, 'kickoffIso': r['kickoffIso'], 'steps': r['steps'], 'breakdown': r['breakdown']}
    return {'ok': False, 'error': r['error']}


def build_scenario_injection(inp: dict[str, Any]) -> tuple[str | None, dict[str, Any] | None, str | None]:
    """
    Returns (suffix to append to user content, snapshot dict or None, error message if scenario present but invalid).
    """
    raw = inp.get('scenario')
    if raw is None:
        return None, None, None
    if not isinstance(raw, dict):
        return (
            '\n\n## Delivery_scenario_facts\n(Invalid scenario input: scenario must be a JSON object)',
            {'version': 2, 'error': 'scenario must be a JSON object', 'calendar_basis': 'calendar_days'},
            'scenario must be a JSON object',
        )
    steps, err = parse_timeline_scenario(raw)
    if err:
        return (
            '\n\n## Delivery_scenario_facts\n(Invalid scenario input: ' + err + ')',
            {'version': 2, 'error': err, 'calendar_basis': 'calendar_days'},
            err,
        )
    assert steps is not None
    snap = compute_scenario_snapshot(steps)
    block = '\n\n## Delivery_scenario_facts\n' + format_scenario_facts_block(snap)
    return block, snap, None

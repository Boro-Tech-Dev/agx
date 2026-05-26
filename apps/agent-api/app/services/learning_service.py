"""Learning enrollments, validation, coach, and ops summary."""

from __future__ import annotations

import hashlib
import json
import os
import re
from datetime import datetime, timedelta, timezone
from typing import Any
from uuid import UUID

import httpx
from fastapi import HTTPException

from ..db import conn, execute, fetch, fetch_one, j
from ..learning.playbook_loader import (
    all_step_ids,
    catalog_entries,
    find_step,
    load_playbook,
    load_playbook_raw,
    playbook_diff_summary,
    step_completed,
    step_count,
)

RECAP_DAYS = 7
GATES_DISABLED = lambda: os.getenv('LEARNING_GATES_DISABLED', '').lower() in ('1', 'true', 'yes')
OPS_OPEN = lambda: os.getenv('LEARNING_OPS_OPEN', '1').lower() in ('1', 'true', 'yes')


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _enrollment_row_to_dict(row: Any) -> dict[str, Any]:
    d = dict(row)
    for k in ('id',):
        if d.get(k) is not None:
            d[k] = str(d[k])
    return d


def list_catalog() -> list[dict[str, Any]]:
    return catalog_entries()


def get_playbook(playbook_id: str, brand_key: str | None = None) -> dict[str, Any]:
    try:
        return load_playbook(playbook_id, brand_key)
    except FileNotFoundError:
        raise HTTPException(404, f'playbook not found: {playbook_id}') from None


def _resolve_brand_id(brand_key: str) -> str:
    row = fetch_one(
        """SELECT b.id FROM brands b
           JOIN clients c ON b.client_id = c.id
           JOIN workspaces w ON c.workspace_id = w.id
           WHERE b.key = %s""",
        (brand_key,),
    )
    if not row:
        raise HTTPException(400, f'brand_key not found: {brand_key}')
    return str(row['id'])


def _generic_brand_id() -> str:
    row = fetch_one(
        """SELECT b.id FROM brands b
           JOIN clients c ON b.client_id = c.id
           JOIN workspaces w ON c.workspace_id = w.id
           WHERE w.key = 'ragtag-learn' AND c.key = 'training' AND b.key = 'sandbox'"""
    )
    if not row:
        raise HTTPException(500, 'learning workspace not seeded (ragtag-learn/training/sandbox)')
    return str(row['id'])


def _project_key_for_enroll(playbook_id: str, user_sub: str, brand_key: str | None) -> str:
    h = hashlib.sha256(f'{user_sub}:{playbook_id}:{brand_key or ""}'.encode()).hexdigest()[:8]
    base = re.sub(r'[^a-z0-9_-]+', '-', playbook_id.lower())[:40]
    key = f'learn-{base}-{h}'
    return key[:63]


def _create_sandbox_project(
    project_key: str,
    name: str,
    brand_id: str,
    project_type: str,
    metadata: dict[str, Any],
) -> None:
    with conn() as c, c.cursor() as cur:
        cur.execute(
            """INSERT INTO projects(key, name, brand_id, project_type, pm_kind, metadata)
               VALUES(%s, %s, %s, %s, 'business', %s::jsonb)
               ON CONFLICT (key) DO UPDATE SET
                 name = EXCLUDED.name,
                 metadata = projects.metadata || EXCLUDED.metadata""",
            (project_key, name, brand_id, project_type, j(metadata)),
        )
        c.commit()


def _check_prerequisites(user_sub: str, playbook: dict[str, Any]) -> None:
    if GATES_DISABLED():
        return
    for req in playbook.get('requires') or []:
        pid = req.get('playbook_id')
        if not pid:
            continue
        row = fetch_one(
            """SELECT status FROM learning_enrollments
               WHERE user_sub = %s AND playbook_id = %s AND brand_key IS NULL
               ORDER BY started_at DESC LIMIT 1""",
            (user_sub, pid),
        )
        if not row or row['status'] != 'completed':
            raise HTTPException(
                400,
                f'Prerequisite not met: complete {pid} before enrolling in {playbook["id"]}',
            )


def enroll(user_sub: str, playbook_id: str, brand_key: str | None = None) -> dict[str, Any]:
    playbook = get_playbook(playbook_id, brand_key)
    bk = (brand_key or '').strip() or None

    existing = fetch_one(
        """SELECT * FROM learning_enrollments
           WHERE user_sub = %s AND playbook_id = %s
             AND COALESCE(brand_key, '') = COALESCE(%s, '')
             AND status = 'active'""",
        (user_sub, playbook_id, bk),
    )
    if existing:
        return _enrollment_detail(str(existing['id']), user_sub)

    _check_prerequisites(user_sub, playbook)

    project_key = _project_key_for_enroll(playbook_id, user_sub, bk)
    if bk:
        brand_id = _resolve_brand_id(bk)
        meta = {'learning': True, 'brand_training': True, 'allow_structured_breakdown': True}
        ptype = 'other'
    else:
        brand_id = _generic_brand_id()
        meta = {'learning': True, 'allow_structured_breakdown': True}
        ptype = 'marketing_campaign' if playbook.get('vertical') == 'non_pharma' else 'other'

    _create_sandbox_project(
        project_key,
        f'Learning: {playbook.get("title", playbook_id)}',
        brand_id,
        ptype,
        meta,
    )

    steps = all_step_ids(playbook)
    first_step = steps[0] if steps else None

    with conn() as c, c.cursor() as cur:
        cur.execute(
            """INSERT INTO learning_enrollments(
                 user_sub, module_type, playbook_id, playbook_version,
                 agency_role, vertical, brand_key, sandbox_project_key,
                 status, current_step_id, content_seen_version)
               VALUES(%s,%s,%s,%s,%s,%s,%s,%s,'active',%s,%s)
               RETURNING id""",
            (
                user_sub,
                playbook.get('module_type'),
                playbook_id,
                int(playbook.get('version', 1)),
                playbook.get('agency_role'),
                playbook.get('vertical'),
                bk,
                project_key,
                first_step,
                int(playbook.get('version', 1)),
            ),
        )
        eid = cur.fetchone()['id']
        c.commit()

    return _enrollment_detail(str(eid), user_sub)


def list_my_enrollments(user_sub: str) -> list[dict[str, Any]]:
    rows = fetch(
        """SELECT e.*,
                  (SELECT COUNT(*)::int FROM learning_step_completions sc WHERE sc.enrollment_id = e.id) AS completed_steps
           FROM learning_enrollments e
           WHERE e.user_sub = %s
           ORDER BY e.updated_at DESC""",
        (user_sub,),
    )
    out = []
    for r in rows:
        d = _enrollment_row_to_dict(r)
        try:
            pb = load_playbook_raw(d['playbook_id'])
            total = step_count(pb)
        except FileNotFoundError:
            total = 0
        d['total_steps'] = total
        d['progress_label'] = f'{d.get("completed_steps", 0)}/{total}' if total else '0/0'
        out.append(d)
    return out


def _completed_step_ids(enrollment_id: str) -> set[str]:
    rows = fetch(
        'SELECT step_id FROM learning_step_completions WHERE enrollment_id = %s',
        (enrollment_id,),
    )
    return {r['step_id'] for r in rows}


def _enrollment_detail(enrollment_id: str, user_sub: str) -> dict[str, Any]:
    row = fetch_one(
        'SELECT * FROM learning_enrollments WHERE id = %s AND user_sub = %s',
        (enrollment_id, user_sub),
    )
    if not row:
        raise HTTPException(404, 'enrollment not found')
    d = _enrollment_row_to_dict(row)
    playbook = load_playbook(d['playbook_id'], d.get('brand_key'))
    completed = _completed_step_ids(enrollment_id)
    steps = all_step_ids(playbook)
    d['playbook'] = playbook
    d['completed_step_ids'] = sorted(completed)
    d['total_steps'] = len(steps)
    d['completed_steps'] = len(completed)
    if int(playbook.get('version', 1)) > int(d.get('content_seen_version') or 0):
        d['content_update'] = playbook_diff_summary(int(d.get('content_seen_version') or 0), playbook)
    return d


def get_enrollment(enrollment_id: str, user_sub: str) -> dict[str, Any]:
    return _enrollment_detail(enrollment_id, user_sub)


def _step_unlocked(playbook: dict[str, Any], step_id: str, completed: set[str]) -> bool:
    steps = all_step_ids(playbook)
    if step_id not in steps:
        return False
    idx = steps.index(step_id)
    if idx == 0:
        return True
    return step_completed(steps[idx - 1], completed)


def _validate_step(enrollment: dict[str, Any], step: dict[str, Any]) -> tuple[bool, dict[str, Any]]:
    v = step.get('validation') or {}
    vtype = v.get('type', 'manual')
    project_key = enrollment['sandbox_project_key']
    eid = str(enrollment['id'])
    started = enrollment['started_at']

    if vtype == 'manual':
        return True, {'kind': 'manual'}

    if vtype == 'memory':
        title_hint = v.get('title', '')
        row = fetch_one(
            """SELECT id FROM memories
               WHERE project_key = %s
                 AND metadata->>'learning_enrollment_id' = %s
                 AND metadata->>'learning_step_id' = %s
               LIMIT 1""",
            (project_key, eid, step['id']),
        )
        if row:
            return True, {'kind': 'memory', 'memory_id': str(row['id'])}
        if title_hint:
            row = fetch_one(
                """SELECT id FROM memories
                   WHERE project_key = %s AND title ILIKE %s
                     AND created_at >= %s
                   LIMIT 1""",
                (project_key, f'%{title_hint}%', started),
            )
            if row:
                return True, {'kind': 'memory', 'memory_id': str(row['id'])}
        return False, {'kind': 'memory', 'reason': 'missing_memory'}

    if vtype == 'document':
        kind = v.get('documentKind', 'general')
        row = fetch_one(
            """SELECT id FROM source_documents
               WHERE project_key = %s AND document_kind = %s
                 AND created_at >= %s AND archived_at IS NULL
               LIMIT 1""",
            (project_key, kind, started),
        )
        if row:
            return True, {'kind': 'document', 'document_id': str(row['id'])}
        return False, {'kind': 'document', 'reason': 'missing_document'}

    if vtype == 'run':
        keys = v.get('agentKeys') or ['pm', 'kitt']
        row = fetch_one(
            """SELECT id FROM agent_runs
               WHERE project_key = %s AND agent_key = ANY(%s)
                 AND status = 'completed' AND created_at >= %s
               LIMIT 1""",
            (project_key, keys, started),
        )
        if row:
            return True, {'kind': 'run', 'run_id': str(row['id'])}
        return False, {'kind': 'run', 'reason': 'missing_run'}

    if vtype == 'quiz':
        return False, {'kind': 'quiz', 'reason': 'use_complete_with_answers'}

    return False, {'kind': vtype, 'reason': 'unknown'}


def _mark_step_complete(
    enrollment_id: str,
    step_id: str,
    validation_kind: str,
    validation_ref: dict[str, Any],
) -> None:
    execute(
        """INSERT INTO learning_step_completions(enrollment_id, step_id, validation_kind, validation_ref)
           VALUES(%s::uuid, %s, %s, %s::jsonb)
           ON CONFLICT (enrollment_id, step_id) DO UPDATE SET
             completed_at = now(),
             validation_kind = EXCLUDED.validation_kind,
             validation_ref = EXCLUDED.validation_ref""",
        (enrollment_id, step_id, validation_kind, j(validation_ref)),
    )


def _advance_enrollment(enrollment_id: str, playbook: dict[str, Any], completed: set[str]) -> None:
    steps = all_step_ids(playbook)
    next_step = None
    for sid in steps:
        if sid not in completed:
            next_step = sid
            break
    all_done = next_step is None and len(completed) >= len(steps)
    status = 'completed' if all_done else 'active'
    recap = None
    completed_at = None
    if all_done:
        completed_at = _now()
        recap = completed_at + timedelta(days=RECAP_DAYS)
    execute(
        """UPDATE learning_enrollments SET
             current_step_id = %s,
             status = %s,
             completed_at = COALESCE(%s, completed_at),
             recap_due_at = CASE WHEN %s THEN %s ELSE recap_due_at END,
             updated_at = now()
           WHERE id = %s::uuid""",
        (next_step, status, completed_at, all_done, recap, enrollment_id),
    )
    if all_done:
        row = fetch_one('SELECT user_sub FROM learning_enrollments WHERE id = %s::uuid', (enrollment_id,))
        if row:
            for cid in playbook.get('competencies_granted') or []:
                execute(
                    """INSERT INTO learning_competencies(user_sub, competency_id, enrollment_id)
                       VALUES(%s, %s, %s::uuid)
                       ON CONFLICT (user_sub, competency_id) DO NOTHING""",
                    (row['user_sub'], cid, enrollment_id),
                )


def complete_step(
    enrollment_id: str,
    user_sub: str,
    step_id: str,
    quiz_answers: dict[str, Any] | None = None,
) -> dict[str, Any]:
    enrollment = fetch_one(
        'SELECT * FROM learning_enrollments WHERE id = %s::uuid AND user_sub = %s',
        (enrollment_id, user_sub),
    )
    if not enrollment:
        raise HTTPException(404, 'enrollment not found')
    playbook = load_playbook(enrollment['playbook_id'], enrollment.get('brand_key'))
    step = find_step(playbook, step_id)
    if not step:
        raise HTTPException(404, 'step not found')
    completed = _completed_step_ids(enrollment_id)
    if not _step_unlocked(playbook, step_id, completed):
        raise HTTPException(400, 'prior step not completed')

    v = step.get('validation') or {}
    vtype = v.get('type', 'manual')
    ref: dict[str, Any] = {}

    if vtype == 'quiz':
        quiz = step.get('quiz') or {}
        passing = int(v.get('passingScore') or quiz.get('passingScore') or 80)
        questions = quiz.get('questions') or []
        correct = 0
        answers = (quiz_answers or {}).get('answers') or {}
        for q in questions:
            qid = q.get('id')
            if qid is None:
                continue
            try:
                chosen = int(answers.get(qid))
            except (TypeError, ValueError):
                chosen = -1
            if chosen == q.get('correctIndex'):
                correct += 1
        total = max(len(questions), 1)
        score = int(100 * correct / total)
        ref = {'score': score, 'passingScore': passing}
        if score < passing:
            raise HTTPException(
                400,
                detail={
                    'message': 'quiz failed',
                    'score': score,
                    'governance_anchor': step.get('governance_anchor'),
                },
            )
        validation_kind = 'quiz'
    else:
        ok, ref = _validate_step(dict(enrollment), step)
        if vtype != 'manual' and not ok:
            raise HTTPException(400, detail={'message': 'validation failed', **ref})
        validation_kind = vtype if vtype != 'manual' else 'manual'

    _mark_step_complete(enrollment_id, step_id, validation_kind, ref)
    completed.add(step_id)
    _advance_enrollment(enrollment_id, playbook, completed)
    return _enrollment_detail(enrollment_id, user_sub)


def validate_step(enrollment_id: str, user_sub: str, step_id: str | None = None) -> dict[str, Any]:
    enrollment = fetch_one(
        'SELECT * FROM learning_enrollments WHERE id = %s::uuid AND user_sub = %s',
        (enrollment_id, user_sub),
    )
    if not enrollment:
        raise HTTPException(404, 'enrollment not found')
    playbook = load_playbook(enrollment['playbook_id'], enrollment.get('brand_key'))
    sid = step_id or enrollment.get('current_step_id')
    if not sid:
        return {'ok': False, 'reason': 'no_step'}
    step = find_step(playbook, sid)
    if not step:
        return {'ok': False, 'reason': 'step_not_found'}
    ok, ref = _validate_step(dict(enrollment), step)
    if ok and sid not in _completed_step_ids(enrollment_id):
        _mark_step_complete(enrollment_id, sid, ref.get('kind', 'auto'), ref)
        completed = _completed_step_ids(enrollment_id)
        _advance_enrollment(enrollment_id, playbook, completed)
    return {'ok': ok, 'step_id': sid, **ref, 'enrollment': _enrollment_detail(enrollment_id, user_sub)}


def list_recap_due(user_sub: str) -> list[dict[str, Any]]:
    rows = fetch(
        """SELECT * FROM learning_enrollments
           WHERE user_sub = %s AND recap_due_at IS NOT NULL AND recap_due_at <= now()
             AND status = 'completed'
           ORDER BY recap_due_at ASC""",
        (user_sub,),
    )
    return [_enrollment_row_to_dict(r) for r in rows]


def ops_summary() -> list[dict[str, Any]]:
    if not OPS_OPEN():
        raise HTTPException(403, 'Learning ops not enabled')
    rows = fetch(
        """SELECT playbook_id, status, COUNT(*)::int AS cnt
           FROM learning_enrollments
           GROUP BY playbook_id, status"""
    )
    by_playbook: dict[str, dict[str, int]] = {}
    for r in rows:
        pid = r['playbook_id']
        by_playbook.setdefault(pid, {'enrolled': 0, 'completed': 0, 'in_progress': 0})
        by_playbook[pid]['enrolled'] += r['cnt']
        if r['status'] == 'completed':
            by_playbook[pid]['completed'] += r['cnt']
        elif r['status'] == 'active':
            by_playbook[pid]['in_progress'] += r['cnt']
    out = []
    for pid, counts in sorted(by_playbook.items()):
        try:
            title = load_playbook_raw(pid).get('title', pid)
        except FileNotFoundError:
            title = pid
        enrolled = counts['enrolled']
        completed = counts['completed']
        rate = round(100.0 * completed / enrolled, 1) if enrolled else 0.0
        out.append(
            {
                'playbook_id': pid,
                'title': title,
                'enrolled': enrolled,
                'completed': completed,
                'in_progress': counts['in_progress'],
                'completion_rate': rate,
            }
        )
    return out


def list_competencies(user_sub: str) -> list[str]:
    rows = fetch(
        'SELECT competency_id FROM learning_competencies WHERE user_sub = %s',
        (user_sub,),
    )
    return [r['competency_id'] for r in rows]


def mark_content_seen(enrollment_id: str, user_sub: str) -> dict[str, Any]:
    pb = get_enrollment(enrollment_id, user_sub)
    ver = int((pb.get('playbook') or {}).get('version', 1))
    execute(
        'UPDATE learning_enrollments SET content_seen_version = %s, updated_at = now() WHERE id = %s::uuid',
        (ver, enrollment_id),
    )
    return get_enrollment(enrollment_id, user_sub)


async def coach(
    user_sub: str,
    enrollment_id: str,
    message: str,
    step_id: str | None = None,
) -> dict[str, Any]:
    enrollment = get_enrollment(enrollment_id, user_sub)
    playbook = enrollment.get('playbook') or {}
    step = find_step(playbook, step_id) if step_id else None
    router_url = os.getenv('MODEL_ROUTER_URL', 'http://model-router:8085').rstrip('/')
    system = (
        'You are Twiki (canon), embedded as a learning coach. '
        f'Playbook: {playbook.get("title")}. '
        f'Current step: {step.get("title") if step else "overview"}. '
        'Do not provide legal, regulatory, or MLR approval advice. '
        'Do not explain Veeva validation as a substitute for platform QA. '
        'Keep answers short and actionable for the learner.'
    )
    payload = {
        'agent': 'canon',
        'task_type': 'learning_coach',
        'messages': [
            {'role': 'system', 'content': system},
            {'role': 'user', 'content': message[:8000]},
        ],
    }
    try:
        async with httpx.AsyncClient(timeout=120) as client:
            res = await client.post(f'{router_url}/v1/route', json=payload)
            res.raise_for_status()
            data = res.json()
    except Exception as e:
        return {'ok': False, 'error': str(e), 'reply': 'Coach is temporarily unavailable.'}
    reply = ''
    if isinstance(data, dict):
        reply = (
            data.get('content')
            or data.get('text')
            or (data.get('message') or {}).get('content')
            or json.dumps(data)[:4000]
        )
    return {'ok': True, 'reply': str(reply)[:12000]}


def certificate_data(enrollment_id: str, user_sub: str) -> dict[str, Any]:
    e = get_enrollment(enrollment_id, user_sub)
    if e.get('status') != 'completed':
        raise HTTPException(400, 'enrollment not completed')
    memories = fetch(
        """SELECT id, title, created_at FROM memories
           WHERE project_key = %s AND metadata->>'learning_enrollment_id' = %s
           ORDER BY created_at DESC LIMIT 20""",
        (e['sandbox_project_key'], enrollment_id),
    )
    return {
        'title': e.get('playbook', {}).get('title'),
        'completed_at': e.get('completed_at'),
        'playbook_id': e.get('playbook_id'),
        'memories': [dict(m) for m in memories],
    }

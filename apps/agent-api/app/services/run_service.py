import logging
import uuid

from fastapi import HTTPException
from ..db import execute, fetch, fetch_one, j
from ..project_type_catalog import (
    BLOCKED_BREAKDOWN_AGENTS,
    allows_structured_breakdown,
    is_log_only,
)
from . import memory_service
from . import retrieval_config_service
from .common import RUN_QUEUE, enqueue, event, get_run_or_404

log = logging.getLogger(__name__)

AGENTS = {'pm', 'synergy', 'clinic', 'builder', 'canon', 'forge', 'kitt', 'eddie', 'bubs'}


def _validate_focus_project_item(project_key: str | None, base: dict) -> None:
    raw = base.get('focus_project_item_id')
    if raw is None:
        return
    s = str(raw).strip()
    if not s:
        base.pop('focus_project_item_id', None)
        return
    if not project_key:
        raise HTTPException(400, 'focus_project_item_id requires project_key')
    try:
        uid = uuid.UUID(s)
    except ValueError as e:
        raise HTTPException(400, 'focus_project_item_id must be a valid UUID') from e
    row = fetch_one(
        """SELECT id FROM project_items
           WHERE id = %s::uuid AND project_key = %s AND item_type <> 'timeline_event'""",
        (str(uid), project_key),
    )
    if not row:
        raise HTTPException(
            400,
            'focus_project_item_id not found for this project or is a timeline_event row (use a task, risk, question, etc.)',
        )


def _enrich_supporting_memories_output(output: dict, run_id: str | None = None) -> None:
    """Fill title/body on sparse citations when loading a run (older rows pre-worker hydration)."""
    items = output.get('supporting_memories')
    if not isinstance(items, list) or not items:
        return
    need: list[str] = []
    for it in items:
        if not isinstance(it, dict):
            continue
        blob = f"{it.get('body') or ''}{it.get('excerpt') or ''}{it.get('message') or ''}{it.get('content') or ''}"
        if blob.strip():
            continue
        mid = it.get('memory_id') or it.get('id')
        if mid:
            need.append(str(mid))
    if not need:
        return
    uniq = list(dict.fromkeys(need))
    try:
        rows = fetch(
            """
            SELECT id::text AS id, title, body, memory_type FROM memories WHERE id = ANY(%s::uuid[])
            UNION ALL
            SELECT dc.id::text AS id, sd.title, dc.content AS body, 'source_chunk' AS memory_type
            FROM document_chunks dc
            JOIN source_documents sd ON sd.id = dc.document_id
            WHERE dc.id = ANY(%s::uuid[])
            """,
            (uniq, uniq),
        )
    except Exception as e:
        log.warning(
            'supporting_memories enrich failed run_id=%s need=%s: %s',
            run_id,
            len(uniq),
            e,
            exc_info=True,
        )
        return
    by_id = {r['id']: r for r in rows}
    for it in items:
        if not isinstance(it, dict):
            continue
        if (it.get('body') or it.get('excerpt') or '').strip():
            continue
        mid = str(it.get('memory_id') or it.get('id') or '')
        src = by_id.get(mid)
        if not src:
            continue
        body = (src.get('body') or '').strip()
        title = (src.get('title') or '').strip()
        cur_title = (it.get('title') or '').strip()
        if not cur_title or cur_title.lower() == 'memory':
            it['title'] = title or cur_title or 'Referenced memory'
        if body:
            it['body'] = body
            it['excerpt'] = body
        if not (it.get('source_type') or it.get('memory_type')):
            it['source_type'] = src.get('memory_type')


def _validate_reranker_override(base: dict) -> None:
    raw = base.get('reranker_override')
    if raw is None:
        return
    rid = str(raw).strip()
    if not rid:
        base.pop('reranker_override', None)
        return
    valid = {r['reranker_id'] for r in retrieval_config_service.list_reranker_catalog()}
    if rid not in valid:
        raise HTTPException(400, f'unknown reranker_override: {rid}')
    base['reranker_override'] = rid


def create_run(req):
    if req.agent_key not in AGENTS: raise HTTPException(400,'unknown agent_key')
    row = fetch_one('select ui from agents where key=%s', (req.agent_key,))
    ui = (row or {}).get('ui') if row else None
    if isinstance(ui, dict) and ui.get('disabled') is True:
        raise HTTPException(
            400,
            'This agent is disabled in the catalog (agents.ui.disabled). Re-enable when ready.',
        )
    if req.agent_key in ('pm', 'kitt') and req.project_key:
        proj = fetch_one('select pm_kind from projects where key=%s', (req.project_key,))
        if proj and str(proj.get('pm_kind') or '').lower() == 'personal':
            raise HTTPException(
                400,
                'Personal projects use agent_key synergy or bubs, not pm or kitt.',
            )
    if req.agent_key == 'bubs' and req.project_key:
        proj = fetch_one('select pm_kind from projects where key=%s', (req.project_key,))
        if proj and str(proj.get('pm_kind') or '').lower() == 'business':
            raise HTTPException(
                400,
                'Business projects use agent_key pm or kitt, not bubs.',
            )
    if req.project_key and req.agent_key in BLOCKED_BREAKDOWN_AGENTS:
        proj = fetch_one(
            'SELECT project_type, metadata FROM projects WHERE key=%s',
            (req.project_key,),
        )
        if not proj:
            raise HTTPException(404, 'project not found')
        pt = proj.get('project_type')
        if not pt:
            raise HTTPException(400, 'project is missing project_type')
        if is_log_only(str(pt)) and not allows_structured_breakdown(proj):
            raise HTTPException(
                400,
                'This project type is log-only: breakdown agents cannot run until you enable '
                '"Allow structured breakdown" in project settings (Workspaces → current project).',
            )
    base = {'project_key': req.project_key, **(req.input or {})}
    if req.project_key:
        wk = memory_service.workspace_key_for_project(req.project_key)
        if wk:
            base['workspace_key'] = wk
    _validate_focus_project_item(req.project_key, base)
    _validate_reranker_override(base)
    parent_uuid = None
    conv_id = None
    if req.parent_run_id:
        parent = fetch_one(
            'select id, conversation_id, input from agent_runs where id=%s::uuid',
            (str(req.parent_run_id),),
        )
        if not parent:
            raise HTTPException(404, 'parent run not found')
        pin = parent.get('input') or {}
        if isinstance(pin, str):
            try:
                import json as _json

                pin = _json.loads(pin)
            except Exception as e:
                raise HTTPException(
                    400,
                    'parent run input must be valid JSON when stored as a string (cannot verify continuation context)',
                ) from e
            if not isinstance(pin, dict):
                raise HTTPException(400, 'parent run input JSON must be an object')
        pk_parent = pin.get('project_key')
        if req.project_key and pk_parent and pk_parent != req.project_key:
            raise HTTPException(400, 'parent run project_key does not match this run')
        parent_uuid = str(parent['id'])
        conv_id = parent.get('conversation_id') or parent['id']
        base['parent_run_id'] = parent_uuid
        base['include_parent_summary'] = req.include_parent_summary
        if req.reply is not None:
            base['reply'] = req.reply
        content_s = str(base.get('content') or base.get('prompt') or '').strip()
        reply_s = (req.reply or '').strip()
        if not content_s and not reply_s:
            raise HTTPException(400, 'continuation runs require non-empty reply and/or input.content')
    row = execute(
        'insert into agent_runs(agent_key,status,title,input,parent_run_id,conversation_id) values(%s,%s,%s,%s::jsonb,%s,%s) returning *',
        (req.agent_key, 'queued', req.workflow, j(base), parent_uuid, conv_id),
    )
    event(row['id'], 'run.queued', 'Run queued for durable worker execution', {'agent_key': req.agent_key, 'workflow': req.workflow, 'queue': RUN_QUEUE})
    payload = {
        'run_id': str(row['id']),
        'agent_key': req.agent_key,
        'workflow': req.workflow,
        'project_key': req.project_key,
        'input': base,
        'attempt': 1,
    }
    try: enqueue(payload)
    except Exception as e:
        execute('update agent_runs set status=%s,error_message=%s where id=%s',('failed',f'Failed to enqueue run: {e}',row['id']))
        event(row['id'],'run.enqueue_failed','Failed to enqueue run',{'error':str(e)})
        raise HTTPException(503,f'Failed to enqueue run: {e}')
    return {'run_id':row['id'],'status':'queued','message':'Run queued. Poll /api/runs/{id} for status.'}

def list_runs():
    return fetch(
        'select id,agent_key,status,title,model_used,created_at,started_at,completed_at,error_message,parent_run_id,conversation_id from agent_runs order by created_at desc limit 75'
    )
def get_run(run_id):
    row = get_run_or_404(run_id)
    out = row.get('output')
    if isinstance(out, dict):
        _enrich_supporting_memories_output(out, run_id=str(row.get('id', run_id)))
    return row
def run_events(run_id): return fetch('select * from run_events where run_id=%s order by created_at asc',(run_id,))


def get_run_detail(run_id: str):
    """Single round-trip payload for run detail UIs (run row + ordered events)."""
    r = get_run(run_id)
    e = run_events(run_id)
    return {'run': r, 'events': e}
def cancel_run(run_id):
    row=get_run_or_404(run_id)
    if row['status'] in ('completed', 'degraded', 'failed', 'cancelled'): return row
    updated=execute('update agent_runs set status=%s,completed_at=now(),error_message=%s where id=%s returning *',('cancelled','Cancelled by user',run_id))
    event(run_id,'run.cancelled','Run cancellation requested by user',{})
    return updated

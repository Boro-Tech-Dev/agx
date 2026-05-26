from typing import Any
from fastapi import APIRouter, HTTPException, Query
from psycopg import errors as pg_errors
from ..db import fetch, fetch_one, conn, j
from ..project_type_catalog import PROJECT_TYPES, persist_timeline_events_allowed
from ..schemas.omnichannel_plan import OmnichannelPlanApplyBody
from ..schemas.projects import CreateProjectBody, ProjectItemPatch, ProjectPatchBody
from ..schemas.tactics import ProjectTacticAttach, ProjectTacticUpdate
from ..timing_profile_resolve import enrich_project_row
from ..timing_profiles_catalog import is_valid_timing_profile, resolve_timing_profile_id

router = APIRouter(prefix='/api/projects', tags=['projects'])

_LIFECYCLE = frozenset({'draft', 'active', 'paused', 'completed', 'archived'})

_PROJECT_SELECT = """
    SELECT p.*, w.key AS workspace_key, c.key AS client_key, b.key AS brand_key,
           b.timing_profile_id AS brand_timing_profile_id
    FROM projects p
    JOIN brands b ON p.brand_id = b.id
    JOIN clients c ON b.client_id = c.id
    JOIN workspaces w ON c.workspace_id = w.id
"""


def _format_project_row(row) -> dict[str, Any]:
    d = enrich_project_row(dict(row))
    d['persist_timeline_events'] = persist_timeline_events_allowed(row)
    return d


def _validate_timing_profile_id_optional(raw: str | None) -> str | None:
    if raw is None:
        return None
    s = str(raw).strip()
    if not s:
        return None
    resolved = resolve_timing_profile_id(s)
    if not is_valid_timing_profile(resolved):
        raise HTTPException(422, f'unknown timing_profile_id: {raw}')
    return resolved


def _resolve_brand_id(req: CreateProjectBody):
    if req.brand_id:
        row = fetch_one('SELECT id FROM brands WHERE id=%s', (str(req.brand_id),))
        if not row:
            raise HTTPException(400, 'brand_id not found')
        return row['id']
    row = fetch_one(
        """SELECT b.id FROM brands b
           JOIN clients c ON b.client_id = c.id
           JOIN workspaces w ON c.workspace_id = w.id
           WHERE w.key = %s AND c.key = %s AND b.key = %s""",
        (req.workspace_key, req.client_key, req.brand_key),
    )
    if not row:
        raise HTTPException(400, 'brand not found for given workspace_key, client_key, brand_key')
    return row['id']


def _project_exists(project_key: str):
    return fetch_one('SELECT key FROM projects WHERE key=%s', (project_key,))


@router.get('')
def list_projects():
    rows = fetch(f'{_PROJECT_SELECT} ORDER BY p.created_at DESC')
    return [_format_project_row(r) for r in rows]


@router.get('/project-types')
def list_project_types():
    """Catalog for UI; must match enforced DB CHECK and CreateProjectBody validation."""
    return {'project_types': PROJECT_TYPES}


@router.post('')
def create_project(req: CreateProjectBody):
    brand_id = _resolve_brand_id(req)
    try:
        with conn() as c, c.cursor() as cur:
            cur.execute(
                """INSERT INTO projects(key, name, description, brand_id, project_type, pm_kind, metadata)
                   VALUES(%s, %s, %s, %s, %s, %s, %s::jsonb) RETURNING *""",
                (req.key, req.name, req.description, str(brand_id), req.project_type, req.pm_kind, j(req.metadata or {})),
            )
            row = cur.fetchone()
            c.commit()
            return row
    except pg_errors.UniqueViolation:
        raise HTTPException(status_code=409, detail='Project key already exists')


@router.get('/timeline-events')
def list_timeline_events(
    workspace_key: str | None = Query(default=None),
    limit: int = Query(default=2000, ge=1, le=5000),
):
    """All timeline_event rows across projects (optional workspace filter) for home Gantt overview."""
    sql = (
        'SELECT pi.id, pi.project_key, pi.title, pi.due_date, pi.metadata, pi.status, pi.source_run_id, '
        'p.name AS project_name, w.key AS workspace_key '
        'FROM project_items pi '
        'JOIN projects p ON pi.project_key = p.key '
        'JOIN brands b ON p.brand_id = b.id '
        'JOIN clients c ON b.client_id = c.id '
        'JOIN workspaces w ON c.workspace_id = w.id '
        "WHERE pi.item_type = 'timeline_event' "
    )
    params: list[Any] = []
    if workspace_key:
        sql += 'AND w.key = %s '
        params.append(workspace_key)
    sql += (
        'ORDER BY pi.project_key, '
        "(CASE WHEN pi.metadata->>'phase_order' ~ '^[0-9]+$' THEN (pi.metadata->>'phase_order')::int ELSE 0 END), "
        'pi.due_date NULLS LAST LIMIT %s'
    )
    params.append(limit)
    return fetch(sql, tuple(params))


@router.get('/portfolio-items')
def list_portfolio_items(
    workspace_key: str | None = Query(default=None),
    limit: int = Query(default=2000, ge=1, le=5000),
):
    """risk, anomaly, and cost rows across projects (optional workspace filter) for Reports."""
    sql = (
        'SELECT pi.*, p.name AS project_name, p.pm_kind AS project_pm_kind, w.key AS workspace_key, '
        'c.key AS client_key, b.key AS brand_key '
        'FROM project_items pi '
        'JOIN projects p ON pi.project_key = p.key '
        'JOIN brands b ON p.brand_id = b.id '
        'JOIN clients c ON b.client_id = c.id '
        'JOIN workspaces w ON c.workspace_id = w.id '
        "WHERE pi.item_type IN ('risk', 'anomaly', 'cost') "
    )
    params: list[Any] = []
    if workspace_key:
        sql += 'AND w.key = %s '
        params.append(workspace_key)
    sql += 'ORDER BY pi.created_at DESC LIMIT %s'
    params.append(limit)
    return fetch(sql, tuple(params))


@router.get('/{project_key}')
def get_project(project_key: str):
    row = fetch_one(f'{_PROJECT_SELECT} WHERE p.key=%s', (project_key,))
    if not row:
        raise HTTPException(404, 'project not found')
    return _format_project_row(row)


@router.patch('/{project_key}')
def patch_project(project_key: str, req: ProjectPatchBody):
    if not _project_exists(project_key):
        raise HTTPException(404, 'project not found')
    updates: list[str] = []
    params: list[Any] = []
    if req.name is not None:
        updates.append('name=%s')
        params.append(req.name)
    if req.description is not None:
        updates.append('description=%s')
        params.append(req.description)
    if req.project_type is not None:
        updates.append('project_type=%s')
        params.append(req.project_type)
    if req.pm_kind is not None:
        updates.append('pm_kind=%s')
        params.append(req.pm_kind)
    if req.metadata is not None:
        updates.append("metadata = COALESCE(metadata, '{}'::jsonb) || %s::jsonb")
        params.append(j(req.metadata))
    if 'timing_profile_id' in req.model_fields_set:
        updates.append('timing_profile_id=%s')
        params.append(_validate_timing_profile_id_optional(req.timing_profile_id))
    if not updates:
        return get_project(project_key)
    sql = f'UPDATE projects SET {", ".join(updates)} WHERE key=%s RETURNING *'
    params.append(project_key)
    with conn() as c, c.cursor() as cur:
        cur.execute(sql, tuple(params))
        out = cur.fetchone()
        c.commit()
    if not out:
        raise HTTPException(404, 'project not found')
    return get_project(project_key)


@router.get('/{project_key}/items')
def project_items(project_key: str):
    return fetch(
        'SELECT * FROM project_items WHERE project_key=%s ORDER BY created_at DESC LIMIT 300',
        (project_key,),
    )


@router.patch('/{project_key}/items/{item_id}')
def patch_project_item(project_key: str, item_id: str, req: ProjectItemPatch):
    if not _project_exists(project_key):
        raise HTTPException(404, 'project not found')
    row = fetch_one(
        'SELECT * FROM project_items WHERE id=%s::uuid AND project_key=%s',
        (item_id, project_key),
    )
    if not row:
        raise HTTPException(404, 'project item not found')
    updates: list[str] = []
    params: list[Any] = []
    if req.status is not None:
        updates.append('status=%s')
        params.append(req.status.strip()[:120] or row['status'])
    if req.metadata is not None:
        updates.append("metadata = COALESCE(metadata, '{}'::jsonb) || %s::jsonb")
        params.append(j(req.metadata))
    if req.title is not None:
        updates.append('title=%s')
        params.append(req.title)
    if not updates:
        return row
    updates.append('updated_at=now()')
    sql = f'UPDATE project_items SET {", ".join(updates)} WHERE id=%s::uuid AND project_key=%s RETURNING *'
    params.extend([item_id, project_key])
    with conn() as c, c.cursor() as cur:
        cur.execute(sql, tuple(params))
        out = cur.fetchone()
        c.commit()
    return out


@router.delete('/{project_key}')
def delete_project(project_key: str):
    if not _project_exists(project_key):
        raise HTTPException(404, 'project not found')
    with conn() as c, c.cursor() as cur:
        cur.execute('DELETE FROM project_items WHERE project_key=%s', (project_key,))
        cur.execute('DELETE FROM projects WHERE key=%s RETURNING key', (project_key,))
        r = cur.fetchone()
        if not r:
            c.rollback()
            raise HTTPException(404, 'project not found')
        c.commit()
    return {'deleted': True, 'project_key': project_key}


@router.get('/{project_key}/tactics')
def list_tactics(project_key: str):
    if not _project_exists(project_key):
        raise HTTPException(404, 'project not found')
    return fetch(
        """
        SELECT
          pt.*,
          t.key AS tactic_key,
          t.name AS tactic_name,
          t.description AS tactic_description,
          t.tactic_kind,
          t.channel,
          t.medium,
          t.format,
          t.tags,
          t.default_success_metrics,
          t.default_dependencies,
          t.default_start_offset_days,
          t.default_duration_days,
          t.cadence,
          t.estimated_cost_cents,
          t.currency,
          t.owner,
          t.status AS tactic_status,
          t.metadata AS tactic_metadata
        FROM project_tactics pt
        JOIN tactics t ON pt.tactic_id = t.id
        WHERE pt.project_key=%s
        ORDER BY pt.updated_at DESC, pt.created_at DESC
        """,
        (project_key,),
    )


@router.post('/{project_key}/tactics')
def attach_tactic(project_key: str, req: ProjectTacticAttach):
    if not _project_exists(project_key):
        raise HTTPException(404, 'project not found')
    tactic_id = None
    if req.tactic_id:
        tactic_id = str(req.tactic_id)
    elif req.tactic_key:
        row = fetch_one('SELECT id::text AS id FROM tactics WHERE key=%s', (req.tactic_key,))
        if row:
            tactic_id = row['id']
    if not tactic_id and req.tactic:
        # Create library tactic then attach.
        try:
            with conn() as c, c.cursor() as cur:
                cur.execute(
                    """
                    INSERT INTO tactics(
                        key, name, description, tactic_kind, channel, medium, format, tags,
                        default_success_metrics, default_dependencies,
                        default_start_offset_days, default_duration_days, cadence,
                        estimated_cost_cents, currency, owner, status, metadata
                    )
                    VALUES(
                        %s,%s,%s,%s,%s,%s,%s,
                        %s::jsonb,%s::jsonb,%s::jsonb,
                        %s,%s,%s,%s,%s,%s,%s,%s::jsonb
                    )
                    RETURNING id::text
                    """,
                    (
                        req.tactic.key,
                        req.tactic.name,
                        req.tactic.description,
                        req.tactic.tactic_kind,
                        req.tactic.channel,
                        req.tactic.medium,
                        req.tactic.format,
                        j(req.tactic.tags or []),
                        j(req.tactic.default_success_metrics or {}),
                        j(req.tactic.default_dependencies or {}),
                        req.tactic.default_start_offset_days,
                        req.tactic.default_duration_days,
                        req.tactic.cadence,
                        req.tactic.estimated_cost_cents,
                        req.tactic.currency,
                        req.tactic.owner,
                        req.tactic.status,
                        j(req.tactic.metadata or {}),
                    ),
                )
                tactic_id = cur.fetchone()['id']
                c.commit()
        except pg_errors.UniqueViolation:
            row = fetch_one('SELECT id::text AS id FROM tactics WHERE key=%s', (req.tactic.key,))
            if row:
                tactic_id = row['id']
            else:
                raise HTTPException(status_code=409, detail='Tactic key already exists')

    if not tactic_id:
        raise HTTPException(400, 'Provide tactic_id, tactic_key, or tactic (to create)')

    try:
        with conn() as c, c.cursor() as cur:
            cur.execute(
                """
                INSERT INTO project_tactics(
                    project_key, tactic_id, lifecycle_status, priority, start_at, end_at,
                    objective_override, success_metrics_override, dependencies_override,
                    notes, metadata
                )
                VALUES(
                    %s, %s::uuid, %s, %s, %s, %s,
                    %s, %s::jsonb, %s::jsonb,
                    %s, %s::jsonb
                )
                RETURNING id::text
                """,
                (
                    project_key,
                    tactic_id,
                    req.lifecycle_status,
                    req.priority or 'medium',
                    req.start_at or None,
                    req.end_at or None,
                    req.objective_override,
                    j(req.success_metrics_override or {}),
                    j(req.dependencies_override or {}),
                    req.notes,
                    j(req.metadata or {}),
                ),
            )
            pt_id = cur.fetchone()['id']
            c.commit()
    except pg_errors.UniqueViolation:
        raise HTTPException(status_code=409, detail='Tactic already attached to this project')

    return get_project_tactic(project_key, pt_id)


@router.post('/{project_key}/omnichannel-plans/apply')
def apply_omnichannel_plan(project_key: str, body: OmnichannelPlanApplyBody):
    """Attach or update project_tactics from a validated omnichannel plan (explicit user action)."""
    if not _project_exists(project_key):
        raise HTTPException(404, 'project not found')
    plan = body.plan
    if plan.project_key != project_key:
        raise HTTPException(400, 'plan.project_key must match URL project_key')
    sorted_rows = sorted(plan.rows, key=lambda r: r.order)
    details: list[dict[str, Any]] = []
    for row in sorted_rows:
        tid = str(row.tactic_library_id)
        lib = fetch_one('SELECT id::text FROM tactics WHERE id=%s::uuid', (tid,))
        if not lib:
            raise HTTPException(400, f'unknown tactic_library_id: {tid}')
        meta_patch = dict(row.metadata or {})
        meta_patch['omnichannel_row_id'] = row.id
        if row.timing_profile:
            meta_patch['timing_profile'] = row.timing_profile
        if row.scenario_tactic:
            meta_patch['scenario_tactic'] = row.scenario_tactic
        existing = fetch_one(
            'SELECT id::text FROM project_tactics WHERE project_key=%s AND tactic_id=%s::uuid',
            (project_key, tid),
        )
        if existing:
            eid = existing['id']
            with conn() as c, c.cursor() as cur:
                if row.notes is not None:
                    cur.execute(
                        """UPDATE project_tactics SET notes=%s,
                               metadata = COALESCE(metadata, '{}'::jsonb) || %s::jsonb,
                               updated_at=now()
                           WHERE id=%s::uuid AND project_key=%s""",
                        (row.notes, j(meta_patch), eid, project_key),
                    )
                else:
                    cur.execute(
                        """UPDATE project_tactics SET
                               metadata = COALESCE(metadata, '{}'::jsonb) || %s::jsonb,
                               updated_at=now()
                           WHERE id=%s::uuid AND project_key=%s""",
                        (j(meta_patch), eid, project_key),
                    )
                c.commit()
            details.append({'project_tactic_id': eid, 'tactic_id': tid, 'action': 'updated'})
        else:
            try:
                with conn() as c, c.cursor() as cur:
                    cur.execute(
                        """
                        INSERT INTO project_tactics(
                            project_key, tactic_id, lifecycle_status, priority, start_at, end_at,
                            objective_override, success_metrics_override, dependencies_override,
                            notes, metadata
                        )
                        VALUES(
                            %s, %s::uuid, %s, %s, NULL, NULL,
                            NULL, '{}'::jsonb, '{}'::jsonb,
                            %s, %s::jsonb
                        )
                        RETURNING id::text
                        """,
                        (
                            project_key,
                            tid,
                            'draft',
                            'medium',
                            row.notes,
                            j(meta_patch),
                        ),
                    )
                    nid = cur.fetchone()['id']
                    c.commit()
                details.append({'project_tactic_id': nid, 'tactic_id': tid, 'action': 'attached'})
            except pg_errors.UniqueViolation:
                raise HTTPException(409, 'conflict attaching tactic') from None
    return {'applied': len(details), 'details': details}


@router.get('/{project_key}/tactics/{project_tactic_id}')
def get_project_tactic(project_key: str, project_tactic_id: str):
    row = fetch_one(
        """
        SELECT
          pt.*,
          t.key AS tactic_key,
          t.name AS tactic_name,
          t.description AS tactic_description,
          t.tactic_kind,
          t.channel,
          t.medium,
          t.format,
          t.tags,
          t.default_success_metrics,
          t.default_dependencies,
          t.default_start_offset_days,
          t.default_duration_days,
          t.cadence,
          t.estimated_cost_cents,
          t.currency,
          t.owner,
          t.status AS tactic_status,
          t.metadata AS tactic_metadata
        FROM project_tactics pt
        JOIN tactics t ON pt.tactic_id = t.id
        WHERE pt.id=%s::uuid AND pt.project_key=%s
        """,
        (project_tactic_id, project_key),
    )
    if not row:
        raise HTTPException(404, 'project tactic not found')
    return row


@router.patch('/{project_key}/tactics/{project_tactic_id}')
def update_project_tactic(project_key: str, project_tactic_id: str, req: ProjectTacticUpdate):
    row = fetch_one(
        'SELECT * FROM project_tactics WHERE id=%s::uuid AND project_key=%s',
        (project_tactic_id, project_key),
    )
    if not row:
        raise HTTPException(404, 'project tactic not found')
    updates: list[str] = []
    params: list[Any] = []
    if req.lifecycle_status is not None:
        updates.append('lifecycle_status=%s')
        params.append(req.lifecycle_status)
    if req.priority is not None:
        updates.append('priority=%s')
        params.append(req.priority)
    if req.start_at is not None:
        updates.append('start_at=%s')
        params.append(req.start_at or None)
    if req.end_at is not None:
        updates.append('end_at=%s')
        params.append(req.end_at or None)
    if req.objective_override is not None:
        updates.append('objective_override=%s')
        params.append(req.objective_override)
    if req.success_metrics_override is not None:
        updates.append('success_metrics_override=%s::jsonb')
        params.append(j(req.success_metrics_override))
    if req.dependencies_override is not None:
        updates.append('dependencies_override=%s::jsonb')
        params.append(j(req.dependencies_override))
    if req.notes is not None:
        updates.append('notes=%s')
        params.append(req.notes)
    if req.metadata is not None:
        updates.append("metadata = COALESCE(metadata, '{}'::jsonb) || %s::jsonb")
        params.append(j(req.metadata))
    if not updates:
        return get_project_tactic(project_key, project_tactic_id)
    updates.append('updated_at=now()')
    sql = f"UPDATE project_tactics SET {', '.join(updates)} WHERE id=%s::uuid AND project_key=%s RETURNING id::text"
    params.extend([project_tactic_id, project_key])
    with conn() as c, c.cursor() as cur:
        cur.execute(sql, tuple(params))
        out = cur.fetchone()
        c.commit()
        if not out:
            raise HTTPException(404, 'project tactic not found')
        return get_project_tactic(project_key, out['id'])


@router.delete('/{project_key}/tactics/{project_tactic_id}')
def delete_project_tactic(project_key: str, project_tactic_id: str):
    with conn() as c, c.cursor() as cur:
        cur.execute(
            'DELETE FROM project_tactics WHERE id=%s::uuid AND project_key=%s RETURNING id',
            (project_tactic_id, project_key),
        )
        r = cur.fetchone()
        c.commit()
    if not r:
        raise HTTPException(404, 'project tactic not found')
    return {'deleted': True, 'id': str(r['id'])}

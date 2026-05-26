from __future__ import annotations

from typing import Any

from fastapi import APIRouter, HTTPException
from psycopg import errors as pg_errors

from ..db import conn, fetch, fetch_one, j
from ..schemas.tactics import TacticLibraryCreate, TacticLibraryUpdate

router = APIRouter(prefix='/api/tactics', tags=['tactics'])


@router.get('')
def list_tactics(q: str | None = None, channel: str | None = None, tactic_kind: str | None = None, medium: str | None = None, status: str | None = None):
    where: list[str] = []
    params: list[Any] = []
    if q:
        where.append('(key ILIKE %s OR name ILIKE %s OR COALESCE(description, \'\') ILIKE %s)')
        like = f'%{q}%'
        params.extend([like, like, like])
    if channel:
        where.append('channel=%s')
        params.append(channel)
    if tactic_kind:
        where.append('tactic_kind=%s')
        params.append(tactic_kind)
    if medium:
        where.append('medium=%s')
        params.append(medium)
    if status:
        where.append('status=%s')
        params.append(status)
    w = f"WHERE {' AND '.join(where)}" if where else ''
    return fetch(f'SELECT * FROM tactics {w} ORDER BY updated_at DESC, created_at DESC LIMIT 500', tuple(params))


@router.post('')
def create_tactic(req: TacticLibraryCreate):
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
                RETURNING *
                """,
                (
                    req.key,
                    req.name,
                    req.description,
                    req.tactic_kind,
                    req.channel,
                    req.medium,
                    req.format,
                    j(req.tags or []),
                    j(req.default_success_metrics or {}),
                    j(req.default_dependencies or {}),
                    req.default_start_offset_days,
                    req.default_duration_days,
                    req.cadence,
                    req.estimated_cost_cents,
                    req.currency,
                    req.owner,
                    req.status,
                    j(req.metadata or {}),
                ),
            )
            row = cur.fetchone()
            c.commit()
            return row
    except pg_errors.UniqueViolation:
        raise HTTPException(status_code=409, detail='Tactic key already exists')


@router.get('/{tactic_id}')
def get_tactic(tactic_id: str):
    row = fetch_one('SELECT * FROM tactics WHERE id=%s::uuid', (tactic_id,))
    if not row:
        raise HTTPException(404, 'tactic not found')
    return row


@router.patch('/{tactic_id}')
def patch_tactic(tactic_id: str, req: TacticLibraryUpdate):
    row = fetch_one('SELECT * FROM tactics WHERE id=%s::uuid', (tactic_id,))
    if not row:
        raise HTTPException(404, 'tactic not found')

    updates: list[str] = []
    params: list[Any] = []
    for col in ['key', 'name', 'description', 'tactic_kind', 'channel', 'medium', 'format', 'cadence', 'currency', 'owner', 'status']:
        v = getattr(req, col)
        if v is not None:
            updates.append(f'{col}=%s')
            params.append(v)
    if req.tags is not None:
        updates.append('tags=%s::jsonb')
        params.append(j(req.tags))
    if req.default_success_metrics is not None:
        updates.append('default_success_metrics=%s::jsonb')
        params.append(j(req.default_success_metrics))
    if req.default_dependencies is not None:
        updates.append('default_dependencies=%s::jsonb')
        params.append(j(req.default_dependencies))
    if req.default_start_offset_days is not None:
        updates.append('default_start_offset_days=%s')
        params.append(req.default_start_offset_days)
    if req.default_duration_days is not None:
        updates.append('default_duration_days=%s')
        params.append(req.default_duration_days)
    if req.estimated_cost_cents is not None:
        updates.append('estimated_cost_cents=%s')
        params.append(req.estimated_cost_cents)
    if req.metadata is not None:
        updates.append("metadata = COALESCE(metadata, '{}'::jsonb) || %s::jsonb")
        params.append(j(req.metadata))
    if not updates:
        return row
    updates.append('updated_at=now()')

    sql = f"UPDATE tactics SET {', '.join(updates)} WHERE id=%s::uuid RETURNING *"
    params.append(tactic_id)
    try:
        with conn() as c, c.cursor() as cur:
            cur.execute(sql, tuple(params))
            out = cur.fetchone()
            c.commit()
            return out
    except pg_errors.UniqueViolation:
        raise HTTPException(status_code=409, detail='Tactic key already exists')


@router.delete('/{tactic_id}')
def archive_tactic(tactic_id: str):
    row = fetch_one('SELECT id FROM tactics WHERE id=%s::uuid', (tactic_id,))
    if not row:
        raise HTTPException(404, 'tactic not found')
    with conn() as c, c.cursor() as cur:
        cur.execute("UPDATE tactics SET status='archived', updated_at=now() WHERE id=%s::uuid RETURNING id", (tactic_id,))
        out = cur.fetchone()
        c.commit()
        return {'archived': True, 'id': str(out['id'])}


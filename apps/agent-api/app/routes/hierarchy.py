from typing import Any

from fastapi import APIRouter, HTTPException
from psycopg import errors as pg_errors
from ..db import fetch, fetch_one, conn
from ..schemas.hierarchy import WorkspaceCreate, ClientCreate, BrandCreate, BrandPatch, ClientPatch
from ..timing_profile_resolve import enrich_brand_row, enrich_project_row
from ..timing_profiles_catalog import is_valid_timing_profile, resolve_timing_profile_id

router = APIRouter(prefix='/api', tags=['hierarchy'])


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


@router.get('/workspaces')
def list_workspaces():
    return fetch('SELECT * FROM workspaces ORDER BY key')


@router.post('/workspaces')
def create_workspace(req: WorkspaceCreate):
    try:
        with conn() as c, c.cursor() as cur:
            cur.execute(
                'INSERT INTO workspaces(key, name, description) VALUES(%s, %s, %s) RETURNING *',
                (req.key, req.name, req.description or ''),
            )
            row = cur.fetchone()
            c.commit()
            return row
    except pg_errors.UniqueViolation:
        raise HTTPException(status_code=409, detail='Workspace key already exists')


@router.delete('/workspaces/{workspace_key}')
def delete_workspace(workspace_key: str):
    w = fetch_one('SELECT id FROM workspaces WHERE key=%s', (workspace_key,))
    if not w:
        raise HTTPException(404, 'workspace not found')
    with conn() as c, c.cursor() as cur:
        cur.execute(
            """
            SELECT p.key FROM projects p
            JOIN brands b ON p.brand_id = b.id
            JOIN clients cl ON b.client_id = cl.id
            JOIN workspaces w ON cl.workspace_id = w.id
            WHERE w.key = %s
            """,
            (workspace_key,),
        )
        project_keys = [row['key'] for row in cur.fetchall()]
        for pk in project_keys:
            cur.execute('DELETE FROM project_items WHERE project_key=%s', (pk,))
            cur.execute('DELETE FROM projects WHERE key=%s', (pk,))
        cur.execute('DELETE FROM workspaces WHERE key=%s RETURNING key', (workspace_key,))
        r = cur.fetchone()
        if not r:
            c.rollback()
            raise HTTPException(404, 'workspace not found')
        c.commit()
    return {'deleted': True, 'workspace_key': workspace_key, 'projects_removed': len(project_keys)}


@router.get('/workspaces/{workspace_key}/clients')
def list_clients(workspace_key: str):
    w = fetch_one('SELECT id FROM workspaces WHERE key=%s', (workspace_key,))
    if not w:
        raise HTTPException(404, 'workspace not found')
    return fetch('SELECT * FROM clients WHERE workspace_id=%s ORDER BY key', (w['id'],))


@router.post('/workspaces/{workspace_key}/clients')
def create_client(workspace_key: str, req: ClientCreate):
    w = fetch_one('SELECT id FROM workspaces WHERE key=%s', (workspace_key,))
    if not w:
        raise HTTPException(404, 'workspace not found')
    try:
        with conn() as c, c.cursor() as cur:
            cur.execute(
                'INSERT INTO clients(workspace_id, key, name, description) VALUES(%s, %s, %s, %s) RETURNING *',
                (w['id'], req.key, req.name, req.description or ''),
            )
            row = cur.fetchone()
            c.commit()
            return row
    except pg_errors.UniqueViolation:
        raise HTTPException(status_code=409, detail='Client key already exists in this workspace')


@router.get('/clients/{client_id}/brands')
def list_brands(client_id: str):
    return fetch('SELECT * FROM brands WHERE client_id=%s ORDER BY key', (client_id,))


@router.post('/clients/{client_id}/brands')
def create_brand(client_id: str, req: BrandCreate):
    c0 = fetch_one('SELECT id FROM clients WHERE id=%s::uuid', (client_id,))
    if not c0:
        raise HTTPException(404, 'client not found')
    try:
        with conn() as c, c.cursor() as cur:
            cur.execute(
                'INSERT INTO brands(client_id, key, name, description) VALUES(%s::uuid, %s, %s, %s) RETURNING *',
                (client_id, req.key, req.name, req.description or ''),
            )
            row = cur.fetchone()
            c.commit()
            return row
    except pg_errors.UniqueViolation:
        raise HTTPException(status_code=409, detail='Brand key already exists for this client')


@router.patch('/clients/{client_id}')
def patch_client(client_id: str, req: ClientPatch):
    c0 = fetch_one('SELECT id FROM clients WHERE id=%s::uuid', (client_id,))
    if not c0:
        raise HTTPException(404, 'client not found')
    updates: list[str] = []
    params: list[Any] = []
    if req.name is not None:
        updates.append('name=%s')
        params.append(req.name)
    if req.description is not None:
        updates.append('description=%s')
        params.append(req.description)
    if not updates:
        row = fetch_one('SELECT * FROM clients WHERE id=%s::uuid', (client_id,))
        return dict(row) if row else None
    sql = f'UPDATE clients SET {", ".join(updates)} WHERE id=%s::uuid RETURNING *'
    params.append(client_id)
    with conn() as c, c.cursor() as cur:
        cur.execute(sql, tuple(params))
        row = cur.fetchone()
        c.commit()
    if not row:
        raise HTTPException(404, 'client not found')
    return dict(row)


@router.patch('/brands/{brand_id}')
def patch_brand(brand_id: str, req: BrandPatch):
    b0 = fetch_one('SELECT id FROM brands WHERE id=%s::uuid', (brand_id,))
    if not b0:
        raise HTTPException(404, 'brand not found')
    updates: list[str] = []
    params: list[Any] = []
    if req.name is not None:
        updates.append('name=%s')
        params.append(req.name)
    if req.description is not None:
        updates.append('description=%s')
        params.append(req.description)
    if 'timing_profile_id' in req.model_fields_set:
        updates.append('timing_profile_id=%s')
        params.append(_validate_timing_profile_id_optional(req.timing_profile_id))
    if not updates:
        row = fetch_one('SELECT * FROM brands WHERE id=%s::uuid', (brand_id,))
        return enrich_brand_row(dict(row)) if row else None
    sql = f'UPDATE brands SET {", ".join(updates)} WHERE id=%s::uuid RETURNING *'
    params.append(brand_id)
    with conn() as c, c.cursor() as cur:
        cur.execute(sql, tuple(params))
        row = cur.fetchone()
        c.commit()
    if not row:
        raise HTTPException(404, 'brand not found')
    return enrich_brand_row(dict(row))


@router.get('/hierarchy/tree')
def hierarchy_tree():
    out = []
    for w in fetch('SELECT * FROM workspaces ORDER BY key'):
        node = {'workspace': dict(w), 'clients': []}
        for cl in fetch('SELECT * FROM clients WHERE workspace_id=%s ORDER BY key', (w['id'],)):
            cnode = {'client': dict(cl), 'brands': []}
            for br in fetch('SELECT * FROM brands WHERE client_id=%s ORDER BY key', (cl['id'],)):
                brand = enrich_brand_row(dict(br))
                brand_tp = brand.get('timing_profile_id')
                raw_projects = fetch(
                    """SELECT p.*, b.timing_profile_id AS brand_timing_profile_id
                       FROM projects p
                       JOIN brands b ON p.brand_id = b.id
                       WHERE p.brand_id=%s ORDER BY p.key""",
                    (br['id'],),
                )
                projects = [
                    enrich_project_row({**dict(p), 'brand_timing_profile_id': brand_tp or p.get('brand_timing_profile_id')})
                    for p in raw_projects
                ]
                cnode['brands'].append({'brand': brand, 'projects': projects})
            node['clients'].append(cnode)
        out.append(node)
    return {'workspaces': out}

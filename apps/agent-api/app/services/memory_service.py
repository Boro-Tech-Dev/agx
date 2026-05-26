import hashlib
import logging
import os
from typing import Any

import httpx
from fastapi import HTTPException

from ..db import execute, fetch, fetch_one, j
from ..document_kinds import normalize_document_kind

log = logging.getLogger(__name__)

def _model_router_base() -> str:
    v = os.getenv('MODEL_ROUTER_URL', '').strip()
    return v if v else 'http://model-router:8085'


MODEL_ROUTER_URL = _model_router_base()
EMBEDDING_DIM = int(os.getenv('EMBEDDING_DIM', '768'))


def vstr(v):
    return '[' + ','.join(str(float(x)) for x in v) + ']'


def _validated_document_kinds(raw: list[str] | None) -> list[str] | None:
    if not raw:
        return None
    out: list[str] = []
    for k in raw:
        try:
            out.append(normalize_document_kind(k))
        except ValueError:
            raise HTTPException(400, f'invalid document_kind in search: {k!r}') from None
    return out


def workspace_key_for_project(project_key: str | None) -> str | None:
    if not project_key:
        return None
    row = fetch_one(
        """SELECT w.key AS workspace_key FROM projects p
           JOIN brands b ON p.brand_id = b.id
           JOIN clients c ON b.client_id = c.id
           JOIN workspaces w ON c.workspace_id = w.id
           WHERE p.key = %s""",
        (project_key,),
    )
    return row['workspace_key'] if row else None


def resolve_search_context(project_key: str | None, workspace_key: str | None) -> tuple[str | None, str | None]:
    """Returns (W, P) for memory table queries. P is None when browsing workspace-only mode."""
    if project_key:
        derived = workspace_key_for_project(project_key)
        if not derived:
            raise HTTPException(404, 'project not found')
        if workspace_key and workspace_key != derived:
            raise HTTPException(400, 'workspace_key does not match project workspace')
        return derived, project_key
    if workspace_key:
        return workspace_key, None
    return None, None


def keyword_memory(
    query,
    project_key=None,
    workspace_key=None,
    limit=12,
    document_kinds=None,
) -> tuple[list[Any], list[str]]:
    warnings: list[str] = []
    q = f'%{(query or "")[:300]}%'
    try:
        W, P = resolve_search_context(project_key, workspace_key)
    except HTTPException:
        raise
    kinds_f = _validated_document_kinds(document_kinds)
    if not W:
        return [], warnings
    if P is not None:
        rows = fetch(
            """SELECT id::text,title,body,memory_type,confidence,workspace_key,project_key,created_at,updated_at,'memory' AS source_kind
               FROM memories WHERE status='active' AND workspace_key=%s
               AND (project_key IS NULL OR project_key=%s)
               AND (title ILIKE %s OR body ILIKE %s)
               ORDER BY updated_at DESC LIMIT %s::int""",
            (W, P, q, q, limit),
        )
    else:
        rows = fetch(
            """SELECT id::text,title,body,memory_type,confidence,workspace_key,project_key,created_at,updated_at,'memory' AS source_kind
               FROM memories WHERE status='active' AND workspace_key=%s
               AND (title ILIKE %s OR body ILIKE %s)
               ORDER BY updated_at DESC LIMIT %s::int""",
            (W, q, q, limit),
        )
    try:
        kind_clause = ' AND sd.document_kind = ANY(%s)' if kinds_f else ''
        lim_kw = max(3, limit // 2)
        if P is not None:
            if kinds_f:
                rows.extend(
                    fetch(
                        f"""SELECT dc.id::text,sd.title,dc.content AS body,'source_chunk' AS memory_type,'medium' AS confidence,
                                   sd.workspace_key,sd.project_key,dc.created_at,dc.created_at AS updated_at,'document_chunk' AS source_kind
                               FROM document_chunks dc JOIN source_documents sd ON sd.id=dc.document_id
                               WHERE dc.content ILIKE %s AND sd.archived_at IS NULL
                                 AND sd.workspace_key=%s AND sd.project_key=%s{kind_clause}
                               ORDER BY dc.created_at DESC LIMIT %s::int""",
                        (q, W, P, kinds_f, lim_kw),
                    )
                )
            else:
                rows.extend(
                    fetch(
                        """SELECT dc.id::text,sd.title,dc.content AS body,'source_chunk' AS memory_type,'medium' AS confidence,
                                   sd.workspace_key,sd.project_key,dc.created_at,dc.created_at AS updated_at,'document_chunk' AS source_kind
                               FROM document_chunks dc JOIN source_documents sd ON sd.id=dc.document_id
                               WHERE dc.content ILIKE %s AND sd.archived_at IS NULL
                                 AND sd.workspace_key=%s AND sd.project_key=%s
                               ORDER BY dc.created_at DESC LIMIT %s::int""",
                        (q, W, P, lim_kw),
                    )
                )
        else:
            if kinds_f:
                rows.extend(
                    fetch(
                        f"""SELECT dc.id::text,sd.title,dc.content AS body,'source_chunk' AS memory_type,'medium' AS confidence,
                                   sd.workspace_key,sd.project_key,dc.created_at,dc.created_at AS updated_at,'document_chunk' AS source_kind
                               FROM document_chunks dc JOIN source_documents sd ON sd.id=dc.document_id
                               WHERE dc.content ILIKE %s AND sd.archived_at IS NULL
                                 AND sd.workspace_key=%s{kind_clause}
                               ORDER BY dc.created_at DESC LIMIT %s::int""",
                        (q, W, kinds_f, lim_kw),
                    )
                )
            else:
                rows.extend(
                    fetch(
                        """SELECT dc.id::text,sd.title,dc.content AS body,'source_chunk' AS memory_type,'medium' AS confidence,
                                   sd.workspace_key,sd.project_key,dc.created_at,dc.created_at AS updated_at,'document_chunk' AS source_kind
                               FROM document_chunks dc JOIN source_documents sd ON sd.id=dc.document_id
                               WHERE dc.content ILIKE %s AND sd.archived_at IS NULL
                                 AND sd.workspace_key=%s
                               ORDER BY dc.created_at DESC LIMIT %s::int""",
                        (q, W, lim_kw),
                    )
                )
    except Exception as e:
        log.warning('keyword_memory document_chunk augmentation failed: %s', e, exc_info=True)
        warnings.append('chunk_keyword_search_unavailable')
    return rows[:limit], warnings


async def embedding_for(text):
    try:
        async with httpx.AsyncClient(timeout=90) as client:
            data = (await client.post(f'{MODEL_ROUTER_URL}/v1/embed', json={'input': text[:6000]})).json()
        if data.get('error'):
            log.warning('embedding_for: router error: %s', data.get('error'))
            return None
        emb = (data.get('embeddings') or [[]])[0]
        return emb if isinstance(emb, list) and emb else None
    except Exception as e:
        log.warning('embedding_for failed: %s', e, exc_info=True)
        return None


async def hybrid_memory(query, project_key=None, workspace_key=None, limit=12, document_kinds=None):
    rows, warnings = keyword_memory(query, project_key, workspace_key, limit, document_kinds)
    emb = await embedding_for(query or '')
    kinds_f = _validated_document_kinds(document_kinds)
    if not emb:
        if query and (project_key or workspace_key):
            warnings.append('embedding_unavailable_for_vector_search')
    if emb and len(emb) != EMBEDDING_DIM:
        warnings.append('embedding_dim_mismatch')
    if emb and len(emb) == EMBEDDING_DIM:
        try:
            vec = vstr(emb)
            W, P = resolve_search_context(project_key, workspace_key)
            if not W:
                return rows[:limit], warnings
            parts = ['sd.archived_at IS NULL', 'sd.workspace_key=%s']
            params: list[Any] = [vec, W]
            if P is not None:
                parts.append('sd.project_key=%s')
                params.append(P)
            if kinds_f:
                parts.append('sd.document_kind = ANY(%s)')
                params.append(kinds_f)
            params.extend([vec, limit])
            where_clause = ' AND '.join(parts)
            vr = fetch(
                f"""SELECT dc.id::text,sd.title,dc.content AS body,'source_chunk' AS memory_type,'medium' AS confidence,
                           sd.workspace_key,sd.project_key,dc.created_at,dc.created_at AS updated_at,'vector_chunk' AS source_kind,
                           (dc.embedding <=> %s::vector) AS distance
                       FROM document_chunks dc JOIN source_documents sd ON sd.id=dc.document_id
                       WHERE dc.embedding IS NOT NULL AND {where_clause}
                       ORDER BY dc.embedding <=> %s::vector LIMIT %s::int""",
                tuple(params),
            )
            seen = {r['id'] for r in rows}
            rows.extend([r for r in vr if r['id'] not in seen])
        except Exception as e:
            log.warning('hybrid_memory vector chunk search failed: %s', e, exc_info=True)
            warnings.append('vector_chunk_search_unavailable')
    return rows[:limit], warnings


def _validated_workspace_project_for_write(project_key: str | None, workspace_key: str | None) -> tuple[str, str | None]:
    if project_key:
        W = workspace_key_for_project(project_key)
        if not W:
            raise HTTPException(404, 'project not found')
        if workspace_key and workspace_key != W:
            raise HTTPException(400, 'workspace_key does not match project workspace')
        return W, project_key
    if not workspace_key:
        raise HTTPException(400, 'workspace_key required when project_key is omitted')
    return workspace_key, None


def create_memory(payload: dict[str, Any]):
    W, pk = _validated_workspace_project_for_write(payload.get('project_key'), payload.get('workspace_key'))
    return execute(
        'INSERT INTO memories(memory_type,title,body,confidence,workspace_key,project_key,metadata) VALUES(%s,%s,%s,%s,%s,%s,%s::jsonb) RETURNING *',
        (
            payload.get('memory_type', 'note'),
            payload['title'],
            payload['body'],
            payload.get('confidence', 'medium'),
            W,
            pk,
            j(payload.get('metadata', {})),
        ),
    )


def list_memory(project_scoped_only: bool = False, limit: int = 150):
    lim = min(max(int(limit), 1), 500)
    if project_scoped_only:
        return fetch(
            'SELECT * FROM memories WHERE project_key IS NOT NULL ORDER BY created_at DESC LIMIT %s',
            (lim,),
        )
    return fetch('SELECT * FROM memories ORDER BY updated_at DESC LIMIT %s', (lim,))


def update_memory(memory_id, payload):
    row = fetch_one('SELECT * FROM memories WHERE id=%s', (memory_id,))
    if not row:
        raise HTTPException(404, 'memory not found')
    return execute(
        'UPDATE memories SET status=%s,confidence=%s,updated_at=now(),metadata=metadata || %s::jsonb WHERE id=%s RETURNING *',
        (payload.get('status', row['status']), payload.get('confidence', row['confidence']), j(payload.get('metadata', {})), memory_id),
    )


async def ingest_text(payload):
    content = payload.content or ''
    checksum = hashlib.sha256(content.encode()).hexdigest()
    title = payload.title or 'Manual text import'
    W, pk = _validated_workspace_project_for_write(payload.project_key, payload.workspace_key)
    doc = execute(
        """INSERT INTO source_documents(
               title,source_type,source_uri,mime_type,checksum,metadata,ingested_at,
               workspace_key,project_key,original_filename,processing_status,document_kind
           ) VALUES (%s,%s,%s,%s,%s,%s::jsonb,now(),%s,%s,%s,%s,%s) RETURNING *""",
        (
            title,
            payload.source_type,
            payload.source_uri,
            'text/plain',
            checksum,
            j(payload.metadata),
            W,
            pk,
            title,
            'ready',
            'general',
        ),
    )
    chunks = [content[i : i + 1800] for i in range(0, len(content), 1800)] or ['']
    embedded = 0
    from .memory_embedding_service import upsert_source_embeddings

    for idx, chunk in enumerate(chunks):
        emb = await embedding_for(chunk)
        if emb and len(emb) == EMBEDDING_DIM:
            chunk_row = execute(
                'INSERT INTO document_chunks(document_id,chunk_index,content,token_estimate,metadata,embedding) VALUES(%s,%s,%s,%s,%s::jsonb,%s::vector) RETURNING id',
                (doc['id'], idx, chunk, max(1, len(chunk) // 4), j({}), vstr(emb)),
            )
            embedded += 1
            if chunk_row and chunk_row.get('id'):
                await upsert_source_embeddings(
                    source_type='document_chunk',
                    source_id=str(chunk_row['id']),
                    content=chunk,
                )
        else:
            chunk_row = execute(
                'INSERT INTO document_chunks(document_id,chunk_index,content,token_estimate,metadata) VALUES(%s,%s,%s,%s,%s::jsonb) RETURNING id',
                (
                    doc['id'],
                    idx,
                    chunk,
                    max(1, len(chunk) // 4),
                    j({'embedding_skipped': True, 'embedding_length': len(emb or []), 'expected_dim': EMBEDDING_DIM}),
                ),
            )
            if chunk_row and chunk_row.get('id'):
                await upsert_source_embeddings(
                    source_type='document_chunk',
                    source_id=str(chunk_row['id']),
                    content=chunk,
                )
    mem_meta = {'ingested_chunks': len(chunks), 'embedded_chunks': embedded, 'document_kind': 'general'}
    mem = execute(
        'INSERT INTO memories(memory_type,title,body,confidence,workspace_key,project_key,source_document_id,metadata) VALUES(%s,%s,%s,%s,%s,%s,%s,%s::jsonb) RETURNING *',
        ('note', title, content[:6000], payload.confidence, W, pk, doc['id'], j({**payload.metadata, **mem_meta})),
    )
    await upsert_source_embeddings(
        source_type='memory',
        source_id=str(mem['id']),
        content=f'{title}\n{content[:6000]}',
    )
    return {'document': doc, 'memory': mem, 'chunks': len(chunks), 'embedded_chunks': embedded}

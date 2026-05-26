from __future__ import annotations

import logging
import os
from typing import Any, Dict, List, Optional

import httpx
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from ..db import fetch, fetch_one

log = logging.getLogger(__name__)

router = APIRouter(prefix='/api/brief', tags=['brief'])


def _model_router_url() -> str:
    v = os.getenv('MODEL_ROUTER_URL', '').strip()
    return v if v else 'http://model-router:8085'


class BriefAutofillBody(BaseModel):
    prose: str = Field(..., min_length=1, max_length=16000)
    field_ids: List[str] = Field(..., min_length=1, max_length=64)
    field_labels: Optional[Dict[str, str]] = None


class BriefAutofillFromDocumentBody(BaseModel):
    project_key: str = Field(..., min_length=1, max_length=500)
    source_document_id: str = Field(..., min_length=1, max_length=80)
    field_ids: List[str] = Field(..., min_length=1, max_length=64)
    field_labels: Optional[Dict[str, str]] = None


def _max_autofill_chars() -> int:
    return max(4000, int(os.getenv('BRIEF_AUTOFILL_MAX_CHARS', '16000')))


def _build_schema(field_ids: List[str]) -> Dict[str, Any]:
    props = {fid: {'type': 'string'} for fid in field_ids}
    return {
        'type': 'object',
        'properties': {
            'extracted': {
                'type': 'object',
                'properties': props,
                'additionalProperties': False,
            }
        },
        'required': ['extracted'],
        'additionalProperties': False,
    }


async def _run_brief_autofill(*, prose: str, field_ids: List[str], field_labels: Optional[Dict[str, str]]) -> Dict[str, Any]:
    seen: set[str] = set()
    cleaned: List[str] = []
    for fid in field_ids:
        t = fid.strip()
        if not t or t in seen:
            continue
        seen.add(t)
        cleaned.append(t)
    if not cleaned:
        raise HTTPException(status_code=400, detail='field_ids contained no valid ids')
    field_ids = cleaned

    labels = field_labels or {}
    lines = []
    for fid in field_ids:
        lab = labels.get(fid) or fid
        lines.append(f'- {fid}: {lab}')
    label_block = '\n'.join(lines)

    user_msg = (
        'Extract creative brief field values from the prose below.\n'
        'Return JSON matching the schema only. Use empty string "" when information is missing.\n'
        'Do not invent medical, regulatory, or legal claims.\n\n'
        f'Fields:\n{label_block}\n\n'
        f'Prose:\n{prose}'
    )

    payload: Dict[str, Any] = {
        'agent': 'builder',
        'task_type': 'brief_autofill',
        'messages': [
            {'role': 'system', 'content': 'You extract brief fields and reply only as structured JSON via the schema.'},
            {'role': 'user', 'content': user_msg},
        ],
        'schema': _build_schema(field_ids),
    }

    url = f'{_model_router_url().rstrip("/")}/v1/route'
    timeout = httpx.Timeout(connect=30.0, read=240.0, write=60.0, pool=60.0)
    try:
        async with httpx.AsyncClient(timeout=timeout) as client:
            res = await client.post(url, json=payload)
            data = res.json()
    except httpx.HTTPError as e:
        log.warning('brief_autofill transport error: %s', e)
        raise HTTPException(status_code=502, detail=f'model-router unreachable: {e}') from e

    if res.status_code >= 400:
        detail = data.get('error') if isinstance(data, dict) else str(data)
        raise HTTPException(status_code=502, detail=detail or f'model-router HTTP {res.status_code}')

    extracted: Dict[str, str] = {}
    parsed = data.get('parsed') if isinstance(data, dict) else None
    if isinstance(parsed, dict):
        raw_ex = parsed.get('extracted')
        if isinstance(raw_ex, dict):
            for fid in field_ids:
                v = raw_ex.get(fid)
                extracted[fid] = v.strip() if isinstance(v, str) else ''

    err = data.get('error') if isinstance(data, dict) else None
    parse_failed = bool(data.get('parse_failed')) if isinstance(data, dict) else False

    return {
        'extracted': extracted,
        'model_used': data.get('model_used') if isinstance(data, dict) else None,
        'error': err,
        'parse_failed': parse_failed,
        'grammar_failure_fallback_used': bool(data.get('grammar_failure_fallback_used'))
        if isinstance(data, dict)
        else False,
    }


@router.post('/autofill')
async def brief_autofill(body: BriefAutofillBody):
    return await _run_brief_autofill(prose=body.prose, field_ids=body.field_ids, field_labels=body.field_labels)


@router.post('/autofill-from-document')
async def brief_autofill_from_document(body: BriefAutofillFromDocumentBody):
    doc = fetch_one(
        'SELECT id, project_key, processing_status FROM source_documents WHERE id=%s::uuid AND project_key=%s',
        (body.source_document_id, body.project_key),
    )
    if not doc:
        raise HTTPException(status_code=404, detail='document not found for this project')
    if str(doc.get('processing_status') or '') != 'ready':
        raise HTTPException(status_code=400, detail=f"document not ready (status={doc.get('processing_status')})")

    rows = fetch(
        'SELECT content FROM document_chunks WHERE document_id=%s::uuid ORDER BY chunk_index ASC',
        (body.source_document_id,),
    )
    parts: List[str] = []
    total = 0
    cap = _max_autofill_chars()
    for r in rows:
        c = r.get('content')
        if not isinstance(c, str):
            continue
        if total + len(c) > cap:
            parts.append(c[: max(0, cap - total)])
            break
        parts.append(c)
        total += len(c)
    prose = '\n\n'.join(parts).strip()
    if not prose:
        raise HTTPException(status_code=400, detail='no chunk text available for this document')

    seen: set[str] = set()
    field_ids: List[str] = []
    for fid in body.field_ids:
        t = fid.strip()
        if not t or t in seen:
            continue
        seen.add(t)
        field_ids.append(t)
    if not field_ids:
        raise HTTPException(status_code=400, detail='field_ids contained no valid ids')

    out = await _run_brief_autofill(prose=prose, field_ids=field_ids, field_labels=body.field_labels)
    out['prose_chars_used'] = len(prose)
    out['source_document_id'] = body.source_document_id
    return out

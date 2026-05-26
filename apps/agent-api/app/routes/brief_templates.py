from __future__ import annotations

from typing import Any, Optional

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field

from ..services import brief_template_service as svc
from ..services.brief_template_validate import validate_brief_bundle

router = APIRouter(prefix='/api/brief-templates', tags=['brief-templates'])


class BriefDraftPut(BaseModel):
    skeleton: dict[str, Any]
    tactic_overrides: dict[str, Any]
    presets: dict[str, Any]


class BriefDraftPatch(BaseModel):
    skeleton: dict[str, Any] | None = None
    tactic_overrides: dict[str, Any] | None = None
    presets: dict[str, Any] | None = None


class BriefPublishBody(BaseModel):
    label: str | None = Field(None, max_length=500)
    notes: str | None = Field(None, max_length=4000)


@router.get('/published')
def get_published():
    row = svc.get_published_bundle()
    if not row:
        raise HTTPException(status_code=404, detail='no published brief template')
    return row


@router.get('/draft')
def get_draft(request: Request):
    svc.require_brief_ops_write(request)
    row = svc.get_draft_row()
    return {'skeleton': row['skeleton'], 'tactic_overrides': row['tactic_overrides'], 'presets': row['presets'], 'updated_at': row['updated_at']}


@router.put('/draft')
def put_draft(request: Request, body: BriefDraftPut):
    svc.require_brief_ops_write(request)
    return svc.put_draft(body.skeleton, body.tactic_overrides, body.presets)


@router.patch('/draft')
def patch_draft(request: Request, body: BriefDraftPatch):
    svc.require_brief_ops_write(request)
    return svc.patch_draft(body.model_dump(exclude_unset=True))


@router.post('/publish')
def publish(request: Request, body: Optional[BriefPublishBody] = None):
    svc.require_brief_ops_write(request)
    b = body or BriefPublishBody()
    return svc.publish_draft(label=b.label, notes=b.notes)


@router.post('/bootstrap')
def bootstrap(request: Request):
    svc.require_brief_ops_write(request)
    out = svc.bootstrap_from_defaults_if_empty()
    if not out:
        return {'ok': True, 'skipped': True, 'detail': 'published template already exists'}
    return {'ok': True, 'skipped': False, **out}


@router.get('/validate')
def validate_draft(request: Request):
    """Dry-run validation for current draft (no persist)."""
    svc.require_brief_ops_write(request)
    row = svc.get_draft_row()
    sk, ov, pr = row['skeleton'], row['tactic_overrides'], row['presets']
    errs = validate_brief_bundle(sk, ov, pr, tactic_keys_in_db=svc.tactic_keys_for_validation())
    return {'ok': len(errs) == 0, 'errors': errs}

"""Load web capture staging credentials from project documents (server-side only)."""

from __future__ import annotations

import json
import logging
from copy import deepcopy
from typing import Any

from fastapi import HTTPException

from .project_document_service import download_row

log = logging.getLogger(__name__)

_STAGING_KEYS = frozenset({'http_credentials', 'form_login'})


def _deep_merge_staging(base: dict[str, Any], overlay: dict[str, Any]) -> dict[str, Any]:
    out = deepcopy(base)
    for key in _STAGING_KEYS:
        val = overlay.get(key)
        if isinstance(val, dict) and val:
            out[key] = val
    return out


def _load_profile_json(project_key: str, document_id: str) -> dict[str, Any]:
    _row, path = download_row(project_key, document_id)
    if _row.get('document_kind') != 'web_capture_staging':
        raise HTTPException(400, 'staging profile document must have kind web_capture_staging')
    try:
        raw = path.read_text(encoding='utf-8')
        data = json.loads(raw)
    except (OSError, json.JSONDecodeError) as e:
        raise HTTPException(400, f'invalid staging profile JSON: {e}') from e
    if not isinstance(data, dict):
        raise HTTPException(400, 'staging profile JSON must be an object')
    return data


def merge_web_capture_payload(payload: dict[str, Any]) -> dict[str, Any]:
    """Merge credentials from `staging_profile_document_id` into `staging`; strip internal keys."""
    out = dict(payload)
    doc_id = out.pop('staging_profile_document_id', None)
    project_key = out.pop('project_key', None)
    if not doc_id:
        return out
    if not project_key or not str(project_key).strip():
        raise HTTPException(400, 'project_key is required when staging_profile_document_id is set')
    profile = _load_profile_json(str(project_key).strip(), str(doc_id).strip())
    staging = out.get('staging')
    base = staging if isinstance(staging, dict) else {}
    out['staging'] = _deep_merge_staging(base, profile)
    return out

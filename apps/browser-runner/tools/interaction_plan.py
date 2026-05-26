"""Ordered post-overlay interaction steps for screenshot / JS extract / crawl seed."""

from __future__ import annotations

import base64
import os
import re
from typing import Any, List, Literal, Optional

from pydantic import BaseModel, ConfigDict, Field, model_validator


INTERACTION_SELECTOR_MAX_LEN = 400
INTERACTION_WAIT_MS_MAX = 10_000
INTERACTION_PLAN_MAX_STEPS_HARD = 50
UPLOAD_MAX_BYTES = int(os.getenv('WEB_UPLOAD_MAX_BYTES', str(5 * 1024 * 1024)))
_UPLOAD_FILENAME_RE = re.compile(r'^[a-zA-Z0-9._-]{1,120}$')
_UPLOAD_EXT_ALLOW = frozenset(
    {
        '.pdf',
        '.png',
        '.jpg',
        '.jpeg',
        '.gif',
        '.webp',
        '.csv',
        '.txt',
        '.json',
    }
)


def interaction_plan_max_steps() -> int:
    raw = os.getenv('WEB_INTERACTION_PLAN_MAX_STEPS', '').strip()
    if not raw:
        return 20
    try:
        v = int(raw, 10)
    except ValueError:
        return 20
    return max(1, min(v, INTERACTION_PLAN_MAX_STEPS_HARD))


class InteractionPlanStep(BaseModel):
    """``click`` / ``wait_ms`` / ``upload`` — no arbitrary script execution."""

    model_config = ConfigDict(extra='forbid')

    action: Literal['click', 'wait_ms', 'upload']
    selector: Optional[str] = Field(default=None, max_length=INTERACTION_SELECTOR_MAX_LEN)
    wait_ms: Optional[int] = Field(default=None, ge=0, le=INTERACTION_WAIT_MS_MAX)
    file_base64: Optional[str] = Field(default=None, max_length=UPLOAD_MAX_BYTES * 2)
    filename: Optional[str] = Field(default=None, max_length=128)

    @model_validator(mode='before')
    @classmethod
    def _coherent(cls, data: Any) -> Any:
        if not isinstance(data, dict):
            return data
        action = data.get('action')
        if action == 'click':
            raw = data.get('selector')
            if not isinstance(raw, str):
                raise ValueError('click step requires string selector')
            s = raw.strip()
            if not s:
                raise ValueError('click step requires non-empty selector')
            if len(s) > INTERACTION_SELECTOR_MAX_LEN:
                raise ValueError('selector exceeds max length')
            return {**data, 'selector': s, 'wait_ms': None, 'file_base64': None, 'filename': None}
        if action == 'wait_ms':
            if data.get('wait_ms') is None:
                raise ValueError('wait_ms step requires wait_ms')
            return {**data, 'selector': None, 'file_base64': None, 'filename': None}
        if action == 'upload':
            raw_sel = data.get('selector')
            if not isinstance(raw_sel, str) or not raw_sel.strip():
                raise ValueError('upload step requires selector')
            sel = raw_sel.strip()
            if len(sel) > INTERACTION_SELECTOR_MAX_LEN:
                raise ValueError('selector exceeds max length')
            fb = data.get('file_base64')
            if not isinstance(fb, str) or not fb.strip():
                raise ValueError('upload step requires file_base64')
            fn = data.get('filename')
            if not isinstance(fn, str) or not fn.strip():
                raise ValueError('upload step requires filename')
            name = fn.strip()
            if not _UPLOAD_FILENAME_RE.match(name):
                raise ValueError('filename must be alphanumeric with . _ - only')
            ext = os.path.splitext(name)[1].lower()
            if ext not in _UPLOAD_EXT_ALLOW:
                raise ValueError(f'filename extension not allowed: {ext or "(none)"}')
            try:
                # validate= requires Python 3.13+; CI/VPS use 3.11.
                try:
                    raw = base64.standard_b64decode(fb.strip(), validate=True)
                except TypeError:
                    raw = base64.standard_b64decode(fb.strip())
            except Exception as e:
                raise ValueError(f'invalid file_base64: {e!s}') from e
            if len(raw) > UPLOAD_MAX_BYTES:
                raise ValueError(f'upload exceeds max bytes ({UPLOAD_MAX_BYTES})')
            return {
                **data,
                'selector': sel,
                'wait_ms': None,
                'file_base64': base64.standard_b64encode(raw).decode('ascii'),
                'filename': name,
            }
        return data


def validate_plan_length(plan: Optional[List[InteractionPlanStep]]) -> None:
    if not plan:
        return
    mx = interaction_plan_max_steps()
    if len(plan) > mx:
        raise ValueError(f'interaction_plan exceeds max steps ({mx})')

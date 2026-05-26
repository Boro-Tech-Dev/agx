import re
from typing import Any
from uuid import UUID
from pydantic import BaseModel, field_validator, model_validator

from ..project_type_catalog import normalize_project_type

_PM_KINDS = frozenset({'business', 'personal'})


class CreateProjectBody(BaseModel):
    key: str
    name: str
    description: str | None = None
    project_type: str
    pm_kind: str = 'business'
    metadata: dict[str, Any] | None = None
    brand_id: UUID | None = None
    workspace_key: str | None = None
    client_key: str | None = None
    brand_key: str | None = None

    @field_validator('key')
    @classmethod
    def normalize_key(cls, v: str) -> str:
        s = (v or '').strip().lower()
        if not re.fullmatch(r'[a-z][a-z0-9_-]{1,62}', s):
            raise ValueError(
                'Key must be 2–63 characters: start with a letter, then lowercase letters, digits, hyphens, or underscores.'
            )
        return s

    @field_validator('name')
    @classmethod
    def strip_name(cls, v: str) -> str:
        t = (v or '').strip()
        if not t:
            raise ValueError('Name is required.')
        return t[:200]

    @field_validator('pm_kind')
    @classmethod
    def normalize_pm_kind(cls, v: str) -> str:
        s = (v or 'business').strip().lower()
        if s not in _PM_KINDS:
            raise ValueError('pm_kind must be business or personal.')
        return s

    @field_validator('project_type')
    @classmethod
    def validate_project_type(cls, v: str) -> str:
        return normalize_project_type(v)

    @model_validator(mode='after')
    def brand_ref(self):
        if self.brand_id:
            return self
        if self.workspace_key and self.client_key and self.brand_key:
            return self
        raise ValueError('Provide brand_id or workspace_key, client_key, and brand_key.')


class ProjectPatchBody(BaseModel):
    name: str | None = None
    description: str | None = None
    project_type: str | None = None
    pm_kind: str | None = None
    metadata: dict[str, Any] | None = None
    timing_profile_id: str | None = None

    @field_validator('name')
    @classmethod
    def strip_name_opt(cls, v: str | None) -> str | None:
        if v is None:
            return None
        t = v.strip()
        return t[:200] if t else None

    @field_validator('pm_kind')
    @classmethod
    def normalize_pm_kind_opt(cls, v: str | None) -> str | None:
        if v is None:
            return None
        s = v.strip().lower()
        if s not in _PM_KINDS:
            raise ValueError('pm_kind must be business or personal.')
        return s

    @field_validator('project_type')
    @classmethod
    def validate_project_type_opt(cls, v: str | None) -> str | None:
        if v is None:
            return None
        return normalize_project_type(v)


class ProjectItemPatch(BaseModel):
    status: str | None = None
    metadata: dict | None = None
    title: str | None = None

    @field_validator('title')
    @classmethod
    def strip_title_opt(cls, v: str | None) -> str | None:
        if v is None:
            return None
        t = v.strip()
        if not t:
            raise ValueError('title cannot be empty when provided.')
        return t[:500]

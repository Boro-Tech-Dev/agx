from __future__ import annotations

from typing import Any
from uuid import UUID

from pydantic import BaseModel, field_validator

from .hierarchy import _slug_key


_LIFECYCLE = frozenset({'draft', 'active', 'paused', 'completed', 'archived'})
_TACTIC_STATUS = frozenset({'draft', 'active', 'archived'})


class TacticLibraryCreate(BaseModel):
    key: str
    name: str
    description: str | None = None
    tactic_kind: str | None = None
    channel: str | None = None
    medium: str | None = None
    format: str | None = None
    tags: list[str] = []
    default_success_metrics: dict[str, Any] = {}
    default_dependencies: dict[str, Any] = {}
    default_start_offset_days: int | None = None
    default_duration_days: int | None = None
    cadence: str | None = None
    estimated_cost_cents: int | None = None
    currency: str | None = None
    owner: str | None = None
    status: str = 'draft'
    metadata: dict[str, Any] = {}

    @field_validator('key')
    @classmethod
    def k(cls, v: str) -> str:
        return _slug_key(v)

    @field_validator('status')
    @classmethod
    def st(cls, v: str) -> str:
        s = (v or 'draft').strip().lower()
        if s not in _TACTIC_STATUS:
            raise ValueError('status must be draft, active, or archived')
        return s


class TacticLibraryUpdate(BaseModel):
    key: str | None = None
    name: str | None = None
    description: str | None = None
    tactic_kind: str | None = None
    channel: str | None = None
    medium: str | None = None
    format: str | None = None
    tags: list[str] | None = None
    default_success_metrics: dict[str, Any] | None = None
    default_dependencies: dict[str, Any] | None = None
    default_start_offset_days: int | None = None
    default_duration_days: int | None = None
    cadence: str | None = None
    estimated_cost_cents: int | None = None
    currency: str | None = None
    owner: str | None = None
    status: str | None = None
    metadata: dict[str, Any] | None = None

    @field_validator('key')
    @classmethod
    def k_opt(cls, v: str | None) -> str | None:
        if v is None:
            return None
        return _slug_key(v)

    @field_validator('status')
    @classmethod
    def st_opt(cls, v: str | None) -> str | None:
        if v is None:
            return None
        s = v.strip().lower()
        if s not in _TACTIC_STATUS:
            raise ValueError('status must be draft, active, or archived')
        return s


class ProjectTacticAttach(BaseModel):
    tactic_id: UUID | None = None
    tactic_key: str | None = None
    tactic: TacticLibraryCreate | None = None

    lifecycle_status: str = 'draft'
    priority: str | None = None
    start_at: str | None = None
    end_at: str | None = None
    objective_override: str | None = None
    success_metrics_override: dict[str, Any] = {}
    dependencies_override: dict[str, Any] = {}
    notes: str | None = None
    metadata: dict[str, Any] = {}

    @field_validator('tactic_key')
    @classmethod
    def tk_opt(cls, v: str | None) -> str | None:
        if v is None:
            return None
        return _slug_key(v)

    @field_validator('lifecycle_status')
    @classmethod
    def ls(cls, v: str) -> str:
        s = (v or 'draft').strip().lower()
        if s not in _LIFECYCLE:
            raise ValueError('invalid lifecycle_status')
        return s


class ProjectTacticUpdate(BaseModel):
    lifecycle_status: str | None = None
    priority: str | None = None
    start_at: str | None = None
    end_at: str | None = None
    objective_override: str | None = None
    success_metrics_override: dict[str, Any] | None = None
    dependencies_override: dict[str, Any] | None = None
    notes: str | None = None
    metadata: dict[str, Any] | None = None

    @field_validator('lifecycle_status')
    @classmethod
    def ls_opt(cls, v: str | None) -> str | None:
        if v is None:
            return None
        s = v.strip().lower()
        if s not in _LIFECYCLE:
            raise ValueError('invalid lifecycle_status')
        return s

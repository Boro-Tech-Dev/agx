from __future__ import annotations

from typing import Any
from uuid import UUID

from pydantic import BaseModel, Field, field_validator

from ..timing_profiles_catalog import is_valid_timing_profile, resolve_timing_profile_id


def _normalize_timing_token(v: str | None) -> str | None:
    if v is None or v == '':
        return None
    s = v.strip()
    if not s:
        return None
    return s


class OmnichannelPlanRow(BaseModel):
    id: str = Field(min_length=1)
    order: int
    tactic_library_id: UUID
    tactic_key: str | None = None
    label_snapshot: str | None = None
    timing_profile: str | None = None
    scenario_tactic: str | None = None
    notes: str | None = None
    metadata: dict[str, Any] = {}

    @field_validator('timing_profile', 'scenario_tactic')
    @classmethod
    def timing_tokens_ok(cls, v: str | None) -> str | None:
        s = _normalize_timing_token(v)
        if s is None:
            return None
        if not is_valid_timing_profile(s):
            raise ValueError('invalid timing_profile / scenario_tactic')
        return resolve_timing_profile_id(s)


class OmnichannelPlanPayload(BaseModel):
    version: int = 1
    project_key: str = Field(min_length=1)
    rows: list[OmnichannelPlanRow]

    @field_validator('version')
    @classmethod
    def version_ok(cls, v: int) -> int:
        if v != 1:
            raise ValueError('unsupported plan version')
        return v


class OmnichannelPlanApplyBody(BaseModel):
    plan: OmnichannelPlanPayload

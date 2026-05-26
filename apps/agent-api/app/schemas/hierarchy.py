import re
from pydantic import BaseModel, field_validator


def _slug_key(v: str) -> str:
    s = (v or '').strip().lower()
    if not re.fullmatch(r'[a-z][a-z0-9_-]{1,62}', s):
        raise ValueError(
            'Key must be 2–63 characters: start with a letter, then lowercase letters, digits, hyphens, or underscores.'
        )
    return s


class WorkspaceCreate(BaseModel):
    key: str
    name: str
    description: str | None = None

    @field_validator('key')
    @classmethod
    def k(cls, v: str) -> str:
        return _slug_key(v)


class ClientCreate(BaseModel):
    key: str
    name: str
    description: str | None = None

    @field_validator('key')
    @classmethod
    def k(cls, v: str) -> str:
        return _slug_key(v)


class BrandCreate(BaseModel):
    key: str
    name: str
    description: str | None = None

    @field_validator('key')
    @classmethod
    def k(cls, v: str) -> str:
        return _slug_key(v)


class BrandPatch(BaseModel):
    name: str | None = None
    description: str | None = None
    timing_profile_id: str | None = None

    @field_validator('name')
    @classmethod
    def strip_name_opt(cls, v: str | None) -> str | None:
        if v is None:
            return None
        t = v.strip()
        return t[:200] if t else None


class ClientPatch(BaseModel):
    name: str | None = None
    description: str | None = None

    @field_validator('name')
    @classmethod
    def strip_name_opt(cls, v: str | None) -> str | None:
        if v is None:
            return None
        t = v.strip()
        return t[:200] if t else None

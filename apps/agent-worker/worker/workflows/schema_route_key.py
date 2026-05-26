"""Map resolved JSON schema objects to model-router schema_key strings (no httpx)."""

from __future__ import annotations

from typing import Optional

from .schemas import PM_SCHEMA_BUSINESS, PM_SCHEMA_PERSONAL, SCHEMAS


def router_schema_key(agent: str, sch) -> Optional[str]:
    if sch is None:
        return None
    if agent == 'pm':
        if sch is PM_SCHEMA_BUSINESS:
            return 'pm_business'
        if sch is PM_SCHEMA_PERSONAL:
            return 'pm_personal'
        return None
    if SCHEMAS.get(agent) is sch:
        return agent
    return None

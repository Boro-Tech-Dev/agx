"""Resolve timing_profile_id from project/brand rows for API responses."""

from __future__ import annotations

from typing import Any

from .timing_profiles_catalog import is_valid_timing_profile, resolve_timing_profile_id


def _norm_profile(raw: str | None) -> str | None:
    if raw is None:
        return None
    s = str(raw).strip()
    if not s:
        return None
    resolved = resolve_timing_profile_id(s)
    return resolved if is_valid_timing_profile(resolved) else None


def resolved_timing_profile(
    project_timing_profile_id: str | None,
    brand_timing_profile_id: str | None,
) -> str | None:
    """Project override, then brand default."""
    p = _norm_profile(project_timing_profile_id)
    if p is not None:
        return p
    return _norm_profile(brand_timing_profile_id)


def enrich_project_row(row: dict[str, Any]) -> dict[str, Any]:
    d = dict(row)
    brand_tp = d.get('brand_timing_profile_id')
    proj_tp = d.get('timing_profile_id')
    d['resolved_timing_profile'] = resolved_timing_profile(proj_tp, brand_tp)
    return d


def enrich_brand_row(row: dict[str, Any]) -> dict[str, Any]:
    d = dict(row)
    tp = _norm_profile(d.get('timing_profile_id'))
    d['timing_profile_id'] = tp
    return d

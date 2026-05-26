"""Resolve repo config/scenario_planner/timing_profiles.json for API validation."""

from __future__ import annotations

import json
from functools import lru_cache
from pathlib import Path


def _timing_profiles_path() -> Path:
    here = Path(__file__).resolve()
    rel = Path('config') / 'scenario_planner' / 'timing_profiles.json'
    candidates: list[Path] = []
    # Repo checkout: .../apps/agent-api/app/<this>.py → repo root is parents[3]
    if len(here.parents) > 3:
        candidates.append(here.parents[3] / rel)
    # Docker image: WORKDIR /srv, app at /srv/app, config at /srv/config
    if len(here.parents) > 1:
        candidates.append(here.parents[1] / rel)
    for candidate in candidates:
        if candidate.is_file():
            return candidate
    raise FileNotFoundError('timing_profiles.json not found (expected config/scenario_planner/timing_profiles.json)')


@lru_cache(maxsize=1)
def _raw_timing_profiles() -> dict:
    return json.loads(_timing_profiles_path().read_text(encoding='utf-8'))


@lru_cache(maxsize=1)
def canonical_timing_profile_ids() -> frozenset[str]:
    raw = _raw_timing_profiles()
    profiles = raw.get('profiles') or []
    return frozenset(str(p['id']) for p in profiles if isinstance(p, dict) and p.get('id'))


def resolve_timing_profile_id(raw: str) -> str:
    s = raw.strip()
    aliases = _raw_timing_profiles().get('aliases') or {}
    mapped = aliases.get(s)
    if mapped is not None:
        return str(mapped)
    return s


def is_valid_timing_profile(raw: str) -> bool:
    return resolve_timing_profile_id(raw.strip()) in canonical_timing_profile_ids()

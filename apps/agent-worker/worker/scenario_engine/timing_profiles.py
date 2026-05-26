"""Load timing profiles from config/scenario_planner/timing_profiles.json (parity with timingProfiles.ts)."""

from __future__ import annotations

import json
from functools import lru_cache
from pathlib import Path
from typing import Literal, NotRequired, TypedDict


class TimingProfileDef(TypedDict):
    id: str
    prb_cadence: Literal[
        'email_ml_r',
        'schematic_ml_r',
        'linear',
        'skillarts_tiered',
        'happyguy_week_aligned',
    ]
    non_prb_multipliers: dict[str, float]
    client_family: NotRequired[str]
    submit_anchor_weekday: NotRequired[Literal['tuesday', 'thursday']]
    happyguy_spine: NotRequired[Literal['tuesday', 'thursday']]
    include_opdp_binder: NotRequired[bool]


def _scenario_cfg_dir() -> Path:
    here = Path(__file__).resolve()
    if len(here.parents) > 4:
        repo_candidate = here.parents[4] / 'config' / 'scenario_planner'
        if (repo_candidate / 'timing_profiles.json').is_file():
            return repo_candidate
    bundled = here.parents[2] / 'config' / 'scenario_planner'
    if (bundled / 'timing_profiles.json').is_file():
        return bundled
    raise FileNotFoundError(
        'scenario planner timing_profiles.json missing: expected config/scenario_planner/timing_profiles.json'
    )


@lru_cache(maxsize=1)
def load_timing_profiles_file() -> dict:
    p = _scenario_cfg_dir() / 'timing_profiles.json'
    return json.loads(p.read_text(encoding='utf-8'))


@lru_cache(maxsize=1)
def timing_profile_defs() -> dict[str, TimingProfileDef]:
    raw = load_timing_profiles_file()
    profiles: list[dict] = raw.get('profiles') or []
    out: dict[str, TimingProfileDef] = {}
    for row in profiles:
        pid = str(row['id'])
        item: TimingProfileDef = {
            'id': pid,
            'prb_cadence': row['prb_cadence'],
            'non_prb_multipliers': {str(k): float(v) for k, v in (row.get('non_prb_multipliers') or {}).items()},
        }
        cf = row.get('client_family')
        if isinstance(cf, str) and cf.strip():
            item['client_family'] = cf.strip()
        saw = row.get('submit_anchor_weekday')
        if saw in ('tuesday', 'thursday'):
            item['submit_anchor_weekday'] = saw
        if row.get('include_opdp_binder') is True:
            item['include_opdp_binder'] = True
        hgs = row.get('happyguy_spine')
        if hgs in ('tuesday', 'thursday'):
            item['happyguy_spine'] = hgs
        out[pid] = item
    return out


@lru_cache(maxsize=1)
def timing_profile_aliases() -> dict[str, str]:
    raw = load_timing_profiles_file()
    aliases = raw.get('aliases') or {}
    return {str(k): str(v) for k, v in aliases.items()}


@lru_cache(maxsize=1)
def timing_profile_ids_tuple() -> tuple[str, ...]:
    return tuple(timing_profile_defs().keys())


def resolve_timing_profile_id(raw: str) -> str:
    s = raw.strip()
    return timing_profile_aliases().get(s, s)


def is_known_timing_profile(profile_id: str) -> bool:
    return resolve_timing_profile_id(profile_id) in timing_profile_defs()


def uses_schematic_mlr_prb_cadence(profile_id: str) -> bool:
    """Schematic / generic HCP MLR PRB rules (legacy JSON id `email_ml_r` or canonical `schematic_ml_r`)."""
    pid = resolve_timing_profile_id(profile_id)
    p = timing_profile_defs().get(pid)
    return bool(p and p['prb_cadence'] in ('email_ml_r', 'schematic_ml_r'))


def uses_email_mlr_prb_cadence(profile_id: str) -> bool:
    """Deprecated: use uses_schematic_mlr_prb_cadence (same behavior)."""
    return uses_schematic_mlr_prb_cadence(profile_id)


def uses_skillarts_tiered_prb_cadence(profile_id: str) -> bool:
    pid = resolve_timing_profile_id(profile_id)
    p = timing_profile_defs().get(pid)
    return bool(p and p['prb_cadence'] == 'skillarts_tiered')


def uses_happyguy_week_aligned_prb_cadence(profile_id: str) -> bool:
    pid = resolve_timing_profile_id(profile_id)
    p = timing_profile_defs().get(pid)
    return bool(p and p['prb_cadence'] == 'happyguy_week_aligned')


def timing_profile_includes_opdp_binder(profile_id: str) -> bool:
    pid = resolve_timing_profile_id(profile_id)
    p = timing_profile_defs().get(pid)
    return bool(p and p.get('include_opdp_binder') is True)


def happyguy_submit_anchor_weekday(profile_id: str) -> Literal['tuesday', 'thursday']:
    """Deprecated for scheduling: HappyGuy uses submit proximity; field is legacy metadata only."""
    pid = resolve_timing_profile_id(profile_id)
    p = timing_profile_defs().get(pid)
    if p and p.get('submit_anchor_weekday') == 'tuesday':
        return 'tuesday'
    return 'thursday'


def happyguy_mlr_spine_weekday(profile_id: str) -> Literal['tuesday', 'thursday']:
    """Which HappyGuy MLR baseline spine JSON to load (milestone notes: Thursday vs Tuesday)."""
    pid = resolve_timing_profile_id(profile_id)
    p = timing_profile_defs().get(pid)
    if not p or p.get('prb_cadence') != 'happyguy_week_aligned':
        return 'thursday'
    hgs = p.get('happyguy_spine')
    if hgs == 'tuesday' or hgs == 'thursday':
        return hgs
    return 'tuesday' if p.get('submit_anchor_weekday') == 'tuesday' else 'thursday'


def timing_profile_mult_for_phase(profile_id: str, phase_id: str) -> float:
    pid = resolve_timing_profile_id(profile_id)
    p = timing_profile_defs().get(pid)
    if not p:
        return 1.0
    m = p['non_prb_multipliers'].get(phase_id)
    return float(m) if m is not None else 1.0


def scenario_tactics_tuple() -> tuple[str, ...]:
    """Ordered ids for API validation."""
    return timing_profile_ids_tuple()

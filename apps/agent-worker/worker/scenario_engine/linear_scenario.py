"""Linear scenario planner — parity with apps/web-dashboard/lib/scenarioPlanner/linear/computeLinearScenarioSteps.ts."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Literal, TypedDict

from worker.scenario_engine.complexity import (
    ScenarioComplexity,
    basic_scaled_days_override,
    filter_scenario_steps_for_prb_rounds,
    prb_rounds_for_complexity,
)
from worker.scenario_engine.happyguy_strategy import (
    HappyGuyPrbRefs,
    happy_guy_apply_pinned_prefix_prb_state,
    happy_guy_adjust_effective_for_development_dev_gap,
    happy_guy_try_place_week_aligned_development_dev_gap_row,
    happy_guy_try_place_week_aligned_prb_row,
    maybe_shift_happy_guy_client_share,
)
from worker.scenario_engine.scenario_linear_shared import (
    LINEAR_EMPTY_HOLIDAYS,
    linear_allow_non_working_for,
    linear_clamp_days,
    linear_merge_modifier_deltas,
    linear_merge_modifier_phase_notes,
    linear_prb_step_allow_non_working,
    linear_scaled_baseline,
    linear_step_payload,
    linear_validate_iso,
)
from worker.scenario_engine.schematic_strategy import (
    SchematicMlrPrbRefs,
    schematic_mlr_apply_pinned_prefix_prb_state,
    schematic_mlr_adjust_effective_for_development_dev_gap,
    schematic_mlr_try_place_development_dev_gap_row,
    schematic_mlr_try_place_prb_row,
)
from worker.scenario_engine.skill_arts_tier import resolve_skill_arts_page_count, skill_arts_tier_inclusive_working_days
from worker.scenario_engine.skillarts_strategy import (
    SkillArtsPrbRefs,
    skill_arts_apply_pinned_prefix_prb_state,
    skill_arts_adjust_effective_for_development_dev_gap,
    skill_arts_try_place_tiered_development_dev_gap_row,
    skill_arts_try_place_tiered_prb_row,
)
from worker.scenario_engine.tactic_durations import CLIENT_REVIEW_SCENARIO_PHASE_IDS
from worker.scenario_engine.opdp_binder_compute import compute_opdp_binder_steps
from worker.scenario_engine.timing_profiles import (
    timing_profile_includes_opdp_binder,
    uses_schematic_mlr_prb_cadence,
    uses_happyguy_week_aligned_prb_cadence,
    uses_skillarts_tiered_prb_cadence,
)
from worker.scenario_engine.working_days import (
    HolidaySet,
    add_working_days_utc,
    inclusive_working_day_span,
    next_working_day,
)
from worker.scenario_engine.date_calendar import add_calendar_days_utc, inclusive_calendar_day_span

def _scenario_cfg_dir() -> Path:
    """Repo checkout: `agent-x/config/scenario_planner`. Docker image: `/srv/config/scenario_planner`."""
    here = Path(__file__).resolve()
    # Monorepo: .../agent-x/apps/agent-worker/worker/scenario_engine/linear_scenario.py → parents[4] is repo root.
    # Slim Docker layout: /srv/worker/scenario_engine/... has only 4 parents (indices 0–3); skip repo_candidate.
    if len(here.parents) > 4:
        repo_candidate = here.parents[4] / 'config' / 'scenario_planner'
        if (repo_candidate / 'steps.json').is_file():
            return repo_candidate
    bundled = here.parents[2] / 'config' / 'scenario_planner'
    if (bundled / 'steps.json').is_file():
        return bundled
    raise FileNotFoundError(
        'scenario planner config missing: expected config/scenario_planner/steps.json '
        '(monorepo root or bundled under agent-worker service root)'
    )


def _scenario_paths() -> tuple[Path, Path]:
    base = _scenario_cfg_dir()
    return base, base / 'tactics'

_MODIFIER_FILENAMES = (
    'expedited_manuscript.json',
    'extra_client_buffer.json',
    'happyguy_milestones_thursday.json',
    'happyguy_milestones_tuesday.json',
)


class ScenarioStepDef(TypedDict, total=False):
    id: str
    label: str
    baseline_days: int
    note: str
    min_days: int | None
    max_days: int | None


def _parse_steps_rows(raw: dict) -> list[ScenarioStepDef]:
    out: list[ScenarioStepDef] = []
    for row in raw['steps']:
        md = row.get('min_days')
        xd = row.get('max_days')
        item: ScenarioStepDef = {
            'id': row['id'],
            'label': row['label'],
            'baseline_days': int(row['baseline_days']),
            'note': row['note'],
            'min_days': int(md) if md is not None else None,
            'max_days': int(xd) if xd is not None else None,
        }
        out.append(item)
    return out


def _load_steps_default() -> list[ScenarioStepDef]:
    cfg, _ = _scenario_paths()
    raw = json.loads((cfg / 'steps.json').read_text(encoding='utf-8'))
    return _parse_steps_rows(raw)


def _load_steps_skillarts_rte() -> list[ScenarioStepDef]:
    cfg, _ = _scenario_paths()
    p = cfg / 'steps_skillarts_rte.json'
    if not p.is_file():
        raise FileNotFoundError(f'skillarts RTE steps missing: {p}')
    raw = json.loads(p.read_text(encoding='utf-8'))
    return _parse_steps_rows(raw)


def _load_steps_happyguy_mlr(suffix: str) -> list[ScenarioStepDef]:
    cfg, _ = _scenario_paths()
    p = cfg / f'steps_happyguy_mlr_{suffix}.json'
    if not p.is_file():
        raise FileNotFoundError(f'HappyGuy MLR steps missing: {p}')
    raw = json.loads(p.read_text(encoding='utf-8'))
    return _parse_steps_rows(raw)


def _load_steps_happyguy_aasld_congress_print_pickup() -> list[ScenarioStepDef]:
    cfg, _ = _scenario_paths()
    p = cfg / 'steps_happyguy_aasld_congress_print_pickup.json'
    if not p.is_file():
        raise FileNotFoundError(f'HappyGuy AASLD congress print pick-up steps missing: {p}')
    raw = json.loads(p.read_text(encoding='utf-8'))
    return _parse_steps_rows(raw)


def _load_steps_happyguy_aasld_congress_wifi_splash() -> list[ScenarioStepDef]:
    cfg, _ = _scenario_paths()
    p = cfg / 'steps_happyguy_aasld_congress_wifi_splash.json'
    if not p.is_file():
        raise FileNotFoundError(f'HappyGuy AASLD congress wifi splash steps missing: {p}')
    raw = json.loads(p.read_text(encoding='utf-8'))
    return _parse_steps_rows(raw)


def _load_steps_happyguy_mps_website_update() -> list[ScenarioStepDef]:
    cfg, _ = _scenario_paths()
    p = cfg / 'steps_happyguy_mps_website_update.json'
    if not p.is_file():
        raise FileNotFoundError(f'HappyGuy MPS website update steps missing: {p}')
    raw = json.loads(p.read_text(encoding='utf-8'))
    return _parse_steps_rows(raw)


def _load_steps_happyguy_branded_crm_email() -> list[ScenarioStepDef]:
    cfg, _ = _scenario_paths()
    p = cfg / 'steps_happyguy_branded_crm_email.json'
    if not p.is_file():
        raise FileNotFoundError(f'HappyGuy branded CRM email steps missing: {p}')
    raw = json.loads(p.read_text(encoding='utf-8'))
    return _parse_steps_rows(raw)


_STEPS_BY_PROFILE_KEY: dict[str, list[ScenarioStepDef]] = {}

AASLD_WIFI_SPLASH_CATALOG_KEY = 'happyguy_aasld_wifi_splash_page'


def get_scenario_steps_ordered(
    timing_profile: str | None = None,
    catalog_tactic_key: str | None = None,
) -> list[ScenarioStepDef]:
    from worker.scenario_engine.timing_profiles import (
        happyguy_mlr_spine_weekday,
        resolve_timing_profile_id,
        uses_happyguy_week_aligned_prb_cadence,
    )

    key = '_default'
    tp = (timing_profile or '').strip()
    if tp:
        rid = resolve_timing_profile_id(tp)
        if rid == 'skillarts_generic':
            key = 'skillarts_rte'
        elif rid == 'happyguy_aasld_congress_print_pickup':
            if (catalog_tactic_key or '').strip() == AASLD_WIFI_SPLASH_CATALOG_KEY:
                key = 'happyguy_aasld_congress_wifi_splash'
            else:
                key = 'happyguy_aasld_congress_print_pickup'
        elif rid == 'happyguy_mps_website_update':
            key = 'happyguy_mps_website_update'
        elif rid == 'happyguy_branded_crm_email':
            key = 'happyguy_branded_crm_email'
        elif uses_happyguy_week_aligned_prb_cadence(rid):
            key = (
                'happyguy_mlr_tuesday'
                if happyguy_mlr_spine_weekday(rid) == 'tuesday'
                else 'happyguy_mlr_thursday'
            )
    if key not in _STEPS_BY_PROFILE_KEY:
        if key == 'skillarts_rte':
            _STEPS_BY_PROFILE_KEY[key] = _load_steps_skillarts_rte()
        elif key == 'happyguy_mlr_thursday':
            _STEPS_BY_PROFILE_KEY[key] = _load_steps_happyguy_mlr('thursday')
        elif key == 'happyguy_mlr_tuesday':
            _STEPS_BY_PROFILE_KEY[key] = _load_steps_happyguy_mlr('tuesday')
        elif key == 'happyguy_aasld_congress_print_pickup':
            _STEPS_BY_PROFILE_KEY[key] = _load_steps_happyguy_aasld_congress_print_pickup()
        elif key == 'happyguy_aasld_congress_wifi_splash':
            _STEPS_BY_PROFILE_KEY[key] = _load_steps_happyguy_aasld_congress_wifi_splash()
        elif key == 'happyguy_mps_website_update':
            _STEPS_BY_PROFILE_KEY[key] = _load_steps_happyguy_mps_website_update()
        elif key == 'happyguy_branded_crm_email':
            _STEPS_BY_PROFILE_KEY[key] = _load_steps_happyguy_branded_crm_email()
        else:
            _STEPS_BY_PROFILE_KEY[key] = _load_steps_default()
    return _STEPS_BY_PROFILE_KEY[key]


def _load_modifier_bundles() -> dict[str, dict]:
    _, tactics_dir = _scenario_paths()
    bundles: dict[str, dict] = {}
    for fn in _MODIFIER_FILENAMES:
        p = tactics_dir / fn
        data = json.loads(p.read_text(encoding='utf-8'))
        bundles[str(data['id'])] = data
    return bundles


_MODIFIER_BUNDLES: dict[str, dict] | None = None


def _bundles() -> dict[str, dict]:
    global _MODIFIER_BUNDLES
    if _MODIFIER_BUNDLES is None:
        _MODIFIER_BUNDLES = _load_modifier_bundles()
    return _MODIFIER_BUNDLES


class HalTimelineStep(TypedDict, total=False):
    task: str
    start_date: str
    end_date: str
    note: str
    allow_non_working_days: bool


class LinearStepBreakdown(TypedDict):
    phase_id: str
    baseline_days: int
    scaled_days: int
    modifier_deltas: dict[str, int]
    effective_days: int


def _merge_modifier_phase_notes(step_id: str, base_note: str, active_modifier_ids: list[str]) -> str:
    return linear_merge_modifier_phase_notes(step_id, base_note, active_modifier_ids, _bundles())


def _merge_modifier_deltas(
    step_id: str, active_modifier_ids: list[str]
) -> tuple[int, dict[str, int]]:
    return linear_merge_modifier_deltas(step_id, active_modifier_ids, _bundles())


def compute_linear_scenario_steps(
    *,
    anchor_start_iso: str,
    timing_profile: str,
    complexity: ScenarioComplexity = 'medium',
    client_review_extra: int = 0,
    holidays: HolidaySet | None = None,
    phase_allow_non_working_days: dict[str, bool] | None = None,
    active_modifier_ids: list[str] | None = None,
    page_count: int | None = None,
    freeze_after_step_index: int | None = None,
    pinned_prefix_steps: list[HalTimelineStep] | None = None,
    catalog_tactic_key: str | None = None,
) -> tuple[
    bool,
    list[HalTimelineStep] | None,
    list[LinearStepBreakdown] | None,
    str | None,
    list[HalTimelineStep] | None,
]:
    """Returns (ok, steps, breakdown, error, opdp_binder_steps or None)."""
    err = linear_validate_iso(anchor_start_iso, 'Kickoff date')
    if err:
        return False, None, None, err, None

    if client_review_extra < 0 or client_review_extra > 60:
        return False, None, None, 'Client review extra days must be between 0 and 60.', None

    hol: HolidaySet = holidays if holidays is not None else LINEAR_EMPTY_HOLIDAYS
    mids = active_modifier_ids or []
    bundles = _bundles()
    for mid in mids:
        if mid not in bundles:
            return False, None, None, f'Unknown modifier tactic: {mid}', None

    steps_out: list[HalTimelineStep] = []
    breakdown: list[LinearStepBreakdown] = []
    cursor_cal = anchor_start_iso
    email_prb1_submit_monday: str | None = None
    email_prb1_submit_end: str | None = None
    email_prb2_submit_monday: str | None = None
    email_prb2_submit_end: str | None = None
    email_prb3_submit_monday: str | None = None
    email_prb3_submit_end: str | None = None
    skill_arts_prb1_submit_start: str | None = None
    skill_arts_prb1_submit_end: str | None = None
    skill_arts_prb2_submit_start: str | None = None
    skill_arts_prb2_submit_end: str | None = None
    skill_arts_prb3_submit_start: str | None = None
    skill_arts_prb3_submit_end: str | None = None
    happy_guy_prb1_submit_start: str | None = None
    happy_guy_prb1_submit_end: str | None = None
    happy_guy_prb2_submit_start: str | None = None
    happy_guy_prb2_submit_end: str | None = None
    happy_guy_prb3_submit_start: str | None = None
    happy_guy_prb3_submit_end: str | None = None
    happy_guy_prb1_anchor_wd: Literal['tuesday', 'thursday'] | None = None
    happy_guy_prb2_anchor_wd: Literal['tuesday', 'thursday'] | None = None
    happy_guy_prb3_anchor_wd: Literal['tuesday', 'thursday'] | None = None
    happy_guy_last_prb_review_start_for_opdp: str | None = None

    skill_arts_tier_span = (
        skill_arts_tier_inclusive_working_days(resolve_skill_arts_page_count(page_count))
        if uses_skillarts_tiered_prb_cadence(timing_profile)
        else 0
    )

    try:
        ordered = filter_scenario_steps_for_prb_rounds(
            get_scenario_steps_ordered(timing_profile, catalog_tactic_key),
            prb_rounds_for_complexity(complexity),
        )
        fz = freeze_after_step_index
        pins = pinned_prefix_steps
        if (fz is None) != (pins is None):
            return (
                False,
                None,
                None,
                'freezeAfterStepIndex and pinnedPrefixSteps must be provided together.',
                None,
            )
        if fz is not None:
            if fz < 0 or fz >= len(ordered):
                return False, None, None, 'freezeAfterStepIndex out of range for this tactic spine.', None
            if pins is None or len(pins) != fz + 1:
                return (
                    False,
                    None,
                    None,
                    'pinnedPrefixSteps must have length freezeAfterStepIndex + 1.',
                    None,
                )
            for j, pin in enumerate(pins):
                if str(pin.get('task', '')).strip() != str(ordered[j]['label']).strip():
                    return (
                        False,
                        None,
                        None,
                        f'pinnedPrefixSteps[{j}].task must match spine label "{ordered[j]["label"]}".',
                        None,
                    )

        for step_index, row in enumerate(ordered):
            rid = row['id']
            note_out = _merge_modifier_phase_notes(rid, row['note'], mids)
            allow = linear_allow_non_working_for(rid, phase_allow_non_working_days)
            scaled = linear_scaled_baseline(row, timing_profile, complexity)
            if complexity == 'basic':
                fixed = basic_scaled_days_override(rid)
                if fixed is not None:
                    scaled = fixed
            mod_sum, by_id = _merge_modifier_deltas(row['id'], mids)
            effective = linear_clamp_days(scaled + mod_sum, row)
            if row['id'] in CLIENT_REVIEW_SCENARIO_PHASE_IDS:
                effective = linear_clamp_days(effective + client_review_extra, row)

            dev_prb_row = rid in ('development_prb1', 'development_prb2', 'development_prb3')
            use_skillarts_tiered_dev_gap = uses_skillarts_tiered_prb_cadence(timing_profile) and not allow and dev_prb_row
            use_email_prb_dev_gap = uses_schematic_mlr_prb_cadence(timing_profile) and not allow and dev_prb_row

            if use_skillarts_tiered_dev_gap:
                sa_refs_eff: SkillArtsPrbRefs = {
                    'skill_arts_prb1_submit_start': skill_arts_prb1_submit_start,
                    'skill_arts_prb1_submit_end': skill_arts_prb1_submit_end,
                    'skill_arts_prb2_submit_start': skill_arts_prb2_submit_start,
                    'skill_arts_prb2_submit_end': skill_arts_prb2_submit_end,
                    'skill_arts_prb3_submit_start': skill_arts_prb3_submit_start,
                    'skill_arts_prb3_submit_end': skill_arts_prb3_submit_end,
                }
                sa_eff = skill_arts_adjust_effective_for_development_dev_gap(
                    timing_profile,
                    allow,
                    row,
                    hol,
                    phase_allow_non_working_days,
                    mod_sum,
                    effective,
                    skill_arts_tier_span,
                    sa_refs_eff,
                )
                if isinstance(sa_eff, str):
                    return False, None, None, sa_eff, None
                effective = sa_eff

            if use_email_prb_dev_gap:
                mlr_refs_eff: SchematicMlrPrbRefs = {
                    'email_prb1_submit_monday': email_prb1_submit_monday,
                    'email_prb1_submit_end': email_prb1_submit_end,
                    'email_prb2_submit_monday': email_prb2_submit_monday,
                    'email_prb2_submit_end': email_prb2_submit_end,
                    'email_prb3_submit_monday': email_prb3_submit_monday,
                    'email_prb3_submit_end': email_prb3_submit_end,
                }
                e_eff = schematic_mlr_adjust_effective_for_development_dev_gap(
                    timing_profile,
                    allow,
                    row,
                    hol,
                    phase_allow_non_working_days,
                    mod_sum,
                    effective,
                    mlr_refs_eff,
                )
                if isinstance(e_eff, str):
                    return False, None, None, e_eff, None
                effective = e_eff

            use_happyguy_week_aligned_dev_gap = (
                uses_happyguy_week_aligned_prb_cadence(timing_profile) and not allow and dev_prb_row
            )

            if use_happyguy_week_aligned_dev_gap:
                hg_refs_eff: HappyGuyPrbRefs = {
                    'happy_guy_prb1_submit_start': happy_guy_prb1_submit_start,
                    'happy_guy_prb1_submit_end': happy_guy_prb1_submit_end,
                    'happy_guy_prb2_submit_start': happy_guy_prb2_submit_start,
                    'happy_guy_prb2_submit_end': happy_guy_prb2_submit_end,
                    'happy_guy_prb3_submit_start': happy_guy_prb3_submit_start,
                    'happy_guy_prb3_submit_end': happy_guy_prb3_submit_end,
                    'happy_guy_prb1_anchor_wd': happy_guy_prb1_anchor_wd,
                    'happy_guy_prb2_anchor_wd': happy_guy_prb2_anchor_wd,
                    'happy_guy_prb3_anchor_wd': happy_guy_prb3_anchor_wd,
                    'happy_guy_last_prb_review_start_for_opdp': happy_guy_last_prb_review_start_for_opdp,
                }
                hg_eff = happy_guy_adjust_effective_for_development_dev_gap(
                    timing_profile,
                    allow,
                    row,
                    hol,
                    phase_allow_non_working_days,
                    mod_sum,
                    effective,
                    hg_refs_eff,
                )
                if isinstance(hg_eff, str):
                    return False, None, None, hg_eff, None
                effective = hg_eff

            effective = max(1, effective)

            effective_for_breakdown = effective
            if fz is not None and pins is not None and step_index <= fz:
                pin = pins[step_index]
                pin_allow = bool(pin.get('allow_non_working_days')) or allow
                if pin_allow:
                    effective_for_breakdown = max(
                        1, inclusive_calendar_day_span(pin['start_date'], pin['end_date'])
                    )
                else:
                    effective_for_breakdown = max(
                        1, inclusive_working_day_span(pin['start_date'], pin['end_date'], hol) or 1
                    )

            breakdown.append(
                {
                    'phase_id': row['id'],
                    'baseline_days': row['baseline_days'],
                    'scaled_days': scaled,
                    'modifier_deltas': by_id,
                    'effective_days': effective_for_breakdown,
                }
            )

            if fz is not None and pins is not None and step_index <= fz:
                pin = pins[step_index]
                _pin_note = pin.get('note')
                _pin_note_s = str(_pin_note).strip() if _pin_note is not None else ''
                out_step: HalTimelineStep = {
                    'task': row['label'],
                    'start_date': pin['start_date'],
                    'end_date': pin['end_date'],
                    'note': _pin_note_s if _pin_note_s else note_out,
                }
                if pin.get('allow_non_working_days'):
                    out_step['allow_non_working_days'] = True
                steps_out.append(out_step)

                prb_cadence_row = rid in (
                    'submit_prb1',
                    'prb1_review',
                    'submit_prb2',
                    'prb2_review',
                    'submit_prb3',
                    'prb3_review',
                )

                if uses_schematic_mlr_prb_cadence(timing_profile) and not allow and prb_cadence_row:
                    mlr_refs_pin: SchematicMlrPrbRefs = {
                        'email_prb1_submit_monday': email_prb1_submit_monday,
                        'email_prb1_submit_end': email_prb1_submit_end,
                        'email_prb2_submit_monday': email_prb2_submit_monday,
                        'email_prb2_submit_end': email_prb2_submit_end,
                        'email_prb3_submit_monday': email_prb3_submit_monday,
                        'email_prb3_submit_end': email_prb3_submit_end,
                    }
                    schematic_mlr_apply_pinned_prefix_prb_state(
                        timing_profile, allow, row, pin, mlr_refs_pin
                    )
                    email_prb1_submit_monday = mlr_refs_pin['email_prb1_submit_monday']
                    email_prb1_submit_end = mlr_refs_pin['email_prb1_submit_end']
                    email_prb2_submit_monday = mlr_refs_pin['email_prb2_submit_monday']
                    email_prb2_submit_end = mlr_refs_pin['email_prb2_submit_end']
                    email_prb3_submit_monday = mlr_refs_pin['email_prb3_submit_monday']
                    email_prb3_submit_end = mlr_refs_pin['email_prb3_submit_end']

                if uses_skillarts_tiered_prb_cadence(timing_profile) and not allow and prb_cadence_row:
                    sa_refs_pin: SkillArtsPrbRefs = {
                        'skill_arts_prb1_submit_start': skill_arts_prb1_submit_start,
                        'skill_arts_prb1_submit_end': skill_arts_prb1_submit_end,
                        'skill_arts_prb2_submit_start': skill_arts_prb2_submit_start,
                        'skill_arts_prb2_submit_end': skill_arts_prb2_submit_end,
                        'skill_arts_prb3_submit_start': skill_arts_prb3_submit_start,
                        'skill_arts_prb3_submit_end': skill_arts_prb3_submit_end,
                    }
                    skill_arts_apply_pinned_prefix_prb_state(
                        timing_profile, allow, row, pin, sa_refs_pin
                    )
                    skill_arts_prb1_submit_start = sa_refs_pin['skill_arts_prb1_submit_start']
                    skill_arts_prb1_submit_end = sa_refs_pin['skill_arts_prb1_submit_end']
                    skill_arts_prb2_submit_start = sa_refs_pin['skill_arts_prb2_submit_start']
                    skill_arts_prb2_submit_end = sa_refs_pin['skill_arts_prb2_submit_end']
                    skill_arts_prb3_submit_start = sa_refs_pin['skill_arts_prb3_submit_start']
                    skill_arts_prb3_submit_end = sa_refs_pin['skill_arts_prb3_submit_end']

                if uses_happyguy_week_aligned_prb_cadence(timing_profile) and not allow and prb_cadence_row:
                    hg_refs_pin: HappyGuyPrbRefs = {
                        'happy_guy_prb1_submit_start': happy_guy_prb1_submit_start,
                        'happy_guy_prb1_submit_end': happy_guy_prb1_submit_end,
                        'happy_guy_prb2_submit_start': happy_guy_prb2_submit_start,
                        'happy_guy_prb2_submit_end': happy_guy_prb2_submit_end,
                        'happy_guy_prb3_submit_start': happy_guy_prb3_submit_start,
                        'happy_guy_prb3_submit_end': happy_guy_prb3_submit_end,
                        'happy_guy_prb1_anchor_wd': happy_guy_prb1_anchor_wd,
                        'happy_guy_prb2_anchor_wd': happy_guy_prb2_anchor_wd,
                        'happy_guy_prb3_anchor_wd': happy_guy_prb3_anchor_wd,
                        'happy_guy_last_prb_review_start_for_opdp': happy_guy_last_prb_review_start_for_opdp,
                    }
                    happy_guy_apply_pinned_prefix_prb_state(
                        timing_profile, allow, row, pin, cursor_cal, hol, hg_refs_pin
                    )
                    happy_guy_prb1_submit_start = hg_refs_pin['happy_guy_prb1_submit_start']
                    happy_guy_prb1_submit_end = hg_refs_pin['happy_guy_prb1_submit_end']
                    happy_guy_prb2_submit_start = hg_refs_pin['happy_guy_prb2_submit_start']
                    happy_guy_prb2_submit_end = hg_refs_pin['happy_guy_prb2_submit_end']
                    happy_guy_prb3_submit_start = hg_refs_pin['happy_guy_prb3_submit_start']
                    happy_guy_prb3_submit_end = hg_refs_pin['happy_guy_prb3_submit_end']
                    happy_guy_prb1_anchor_wd = hg_refs_pin['happy_guy_prb1_anchor_wd']
                    happy_guy_prb2_anchor_wd = hg_refs_pin['happy_guy_prb2_anchor_wd']
                    happy_guy_prb3_anchor_wd = hg_refs_pin['happy_guy_prb3_anchor_wd']
                    happy_guy_last_prb_review_start_for_opdp = hg_refs_pin[
                        'happy_guy_last_prb_review_start_for_opdp'
                    ]

                cursor_cal = add_calendar_days_utc(pin['end_date'], 1)
                continue

            mlr_refs_place: SchematicMlrPrbRefs = {
                'email_prb1_submit_monday': email_prb1_submit_monday,
                'email_prb1_submit_end': email_prb1_submit_end,
                'email_prb2_submit_monday': email_prb2_submit_monday,
                'email_prb2_submit_end': email_prb2_submit_end,
                'email_prb3_submit_monday': email_prb3_submit_monday,
                'email_prb3_submit_end': email_prb3_submit_end,
            }
            mlr_r = schematic_mlr_try_place_prb_row(
                timing_profile,
                allow,
                row,
                cursor_cal,
                hol,
                phase_allow_non_working_days,
                effective,
                note_out,
                mlr_refs_place,
                steps_out,
            )
            if mlr_r[0] == 'err':
                return False, None, None, mlr_r[1], None
            if mlr_r[0] == 'placed':
                email_prb1_submit_monday = mlr_refs_place['email_prb1_submit_monday']
                email_prb1_submit_end = mlr_refs_place['email_prb1_submit_end']
                email_prb2_submit_monday = mlr_refs_place['email_prb2_submit_monday']
                email_prb2_submit_end = mlr_refs_place['email_prb2_submit_end']
                email_prb3_submit_monday = mlr_refs_place['email_prb3_submit_monday']
                email_prb3_submit_end = mlr_refs_place['email_prb3_submit_end']
                cursor_cal = mlr_r[1]
                continue

            sa_refs_place: SkillArtsPrbRefs = {
                'skill_arts_prb1_submit_start': skill_arts_prb1_submit_start,
                'skill_arts_prb1_submit_end': skill_arts_prb1_submit_end,
                'skill_arts_prb2_submit_start': skill_arts_prb2_submit_start,
                'skill_arts_prb2_submit_end': skill_arts_prb2_submit_end,
                'skill_arts_prb3_submit_start': skill_arts_prb3_submit_start,
                'skill_arts_prb3_submit_end': skill_arts_prb3_submit_end,
            }
            sa_r = skill_arts_try_place_tiered_prb_row(
                timing_profile,
                allow,
                row,
                cursor_cal,
                hol,
                phase_allow_non_working_days,
                effective,
                note_out,
                skill_arts_tier_span,
                sa_refs_place,
                steps_out,
            )
            if sa_r[0] == 'err':
                return False, None, None, sa_r[1], None
            if sa_r[0] == 'placed':
                skill_arts_prb1_submit_start = sa_refs_place['skill_arts_prb1_submit_start']
                skill_arts_prb1_submit_end = sa_refs_place['skill_arts_prb1_submit_end']
                skill_arts_prb2_submit_start = sa_refs_place['skill_arts_prb2_submit_start']
                skill_arts_prb2_submit_end = sa_refs_place['skill_arts_prb2_submit_end']
                skill_arts_prb3_submit_start = sa_refs_place['skill_arts_prb3_submit_start']
                skill_arts_prb3_submit_end = sa_refs_place['skill_arts_prb3_submit_end']
                cursor_cal = sa_r[1]
                continue

            hg_refs_place: HappyGuyPrbRefs = {
                'happy_guy_prb1_submit_start': happy_guy_prb1_submit_start,
                'happy_guy_prb1_submit_end': happy_guy_prb1_submit_end,
                'happy_guy_prb2_submit_start': happy_guy_prb2_submit_start,
                'happy_guy_prb2_submit_end': happy_guy_prb2_submit_end,
                'happy_guy_prb3_submit_start': happy_guy_prb3_submit_start,
                'happy_guy_prb3_submit_end': happy_guy_prb3_submit_end,
                'happy_guy_prb1_anchor_wd': happy_guy_prb1_anchor_wd,
                'happy_guy_prb2_anchor_wd': happy_guy_prb2_anchor_wd,
                'happy_guy_prb3_anchor_wd': happy_guy_prb3_anchor_wd,
                'happy_guy_last_prb_review_start_for_opdp': happy_guy_last_prb_review_start_for_opdp,
            }
            hg_r = happy_guy_try_place_week_aligned_prb_row(
                timing_profile,
                allow,
                row,
                cursor_cal,
                hol,
                phase_allow_non_working_days,
                effective,
                note_out,
                hg_refs_place,
                steps_out,
            )
            if hg_r[0] == 'err':
                return False, None, None, hg_r[1], None
            if hg_r[0] == 'placed':
                happy_guy_prb1_submit_start = hg_refs_place['happy_guy_prb1_submit_start']
                happy_guy_prb1_submit_end = hg_refs_place['happy_guy_prb1_submit_end']
                happy_guy_prb2_submit_start = hg_refs_place['happy_guy_prb2_submit_start']
                happy_guy_prb2_submit_end = hg_refs_place['happy_guy_prb2_submit_end']
                happy_guy_prb3_submit_start = hg_refs_place['happy_guy_prb3_submit_start']
                happy_guy_prb3_submit_end = hg_refs_place['happy_guy_prb3_submit_end']
                happy_guy_prb1_anchor_wd = hg_refs_place['happy_guy_prb1_anchor_wd']
                happy_guy_prb2_anchor_wd = hg_refs_place['happy_guy_prb2_anchor_wd']
                happy_guy_prb3_anchor_wd = hg_refs_place['happy_guy_prb3_anchor_wd']
                happy_guy_last_prb_review_start_for_opdp = hg_refs_place[
                    'happy_guy_last_prb_review_start_for_opdp'
                ]
                cursor_cal = hg_r[1]
                continue

            if use_skillarts_tiered_dev_gap:
                sa_refs_dev: SkillArtsPrbRefs = {
                    'skill_arts_prb1_submit_start': skill_arts_prb1_submit_start,
                    'skill_arts_prb1_submit_end': skill_arts_prb1_submit_end,
                    'skill_arts_prb2_submit_start': skill_arts_prb2_submit_start,
                    'skill_arts_prb2_submit_end': skill_arts_prb2_submit_end,
                    'skill_arts_prb3_submit_start': skill_arts_prb3_submit_start,
                    'skill_arts_prb3_submit_end': skill_arts_prb3_submit_end,
                }
                sa_dg = skill_arts_try_place_tiered_development_dev_gap_row(
                    timing_profile,
                    allow,
                    row,
                    hol,
                    phase_allow_non_working_days,
                    effective,
                    note_out,
                    skill_arts_tier_span,
                    sa_refs_dev,
                    steps_out,
                )
                if sa_dg[0] == 'err':
                    return False, None, None, sa_dg[1], None
                if sa_dg[0] == 'placed':
                    cursor_cal = sa_dg[1]
                    continue

            if use_email_prb_dev_gap:
                mlr_refs_dev: SchematicMlrPrbRefs = {
                    'email_prb1_submit_monday': email_prb1_submit_monday,
                    'email_prb1_submit_end': email_prb1_submit_end,
                    'email_prb2_submit_monday': email_prb2_submit_monday,
                    'email_prb2_submit_end': email_prb2_submit_end,
                    'email_prb3_submit_monday': email_prb3_submit_monday,
                    'email_prb3_submit_end': email_prb3_submit_end,
                }
                mlr_dg = schematic_mlr_try_place_development_dev_gap_row(
                    timing_profile,
                    allow,
                    row,
                    hol,
                    phase_allow_non_working_days,
                    effective,
                    note_out,
                    mlr_refs_dev,
                    steps_out,
                )
                if mlr_dg[0] == 'err':
                    return False, None, None, mlr_dg[1], None
                if mlr_dg[0] == 'placed':
                    cursor_cal = mlr_dg[1]
                    continue

            if use_happyguy_week_aligned_dev_gap:
                hg_refs_dev: HappyGuyPrbRefs = {
                    'happy_guy_prb1_submit_start': happy_guy_prb1_submit_start,
                    'happy_guy_prb1_submit_end': happy_guy_prb1_submit_end,
                    'happy_guy_prb2_submit_start': happy_guy_prb2_submit_start,
                    'happy_guy_prb2_submit_end': happy_guy_prb2_submit_end,
                    'happy_guy_prb3_submit_start': happy_guy_prb3_submit_start,
                    'happy_guy_prb3_submit_end': happy_guy_prb3_submit_end,
                    'happy_guy_prb1_anchor_wd': happy_guy_prb1_anchor_wd,
                    'happy_guy_prb2_anchor_wd': happy_guy_prb2_anchor_wd,
                    'happy_guy_prb3_anchor_wd': happy_guy_prb3_anchor_wd,
                    'happy_guy_last_prb_review_start_for_opdp': happy_guy_last_prb_review_start_for_opdp,
                }
                hg_dg = happy_guy_try_place_week_aligned_development_dev_gap_row(
                    timing_profile,
                    allow,
                    row,
                    hol,
                    phase_allow_non_working_days,
                    effective,
                    note_out,
                    hg_refs_dev,
                    steps_out,
                )
                if hg_dg[0] == 'err':
                    return False, None, None, hg_dg[1], None
                if hg_dg[0] == 'placed':
                    cursor_cal = hg_dg[1]
                    continue

            if allow:
                start = cursor_cal
                end = add_calendar_days_utc(start, effective - 1)
                start, end = maybe_shift_happy_guy_client_share(
                    timing_profile, rid, start, end, hol
                )
                steps_out.append(linear_step_payload(row['label'], start, end, note_out, True))
                cursor_cal = add_calendar_days_utc(end, 1)
            else:
                start = next_working_day(cursor_cal, hol)
                end = add_working_days_utc(start, effective - 1, hol)
                start, end = maybe_shift_happy_guy_client_share(
                    timing_profile, rid, start, end, hol
                )
                steps_out.append(linear_step_payload(row['label'], start, end, note_out, False))
                cursor_cal = add_calendar_days_utc(end, 1)

        opdp_steps: list[HalTimelineStep] | None = None
        if timing_profile_includes_opdp_binder(timing_profile) and happy_guy_last_prb_review_start_for_opdp:
            opdp_steps = compute_opdp_binder_steps(
                anchor_start_iso=happy_guy_last_prb_review_start_for_opdp,
                holidays=hol,
            )

        return True, steps_out, breakdown, None, opdp_steps
    except Exception as e:
        return False, None, None, str(e) if e else type(e).__name__, None

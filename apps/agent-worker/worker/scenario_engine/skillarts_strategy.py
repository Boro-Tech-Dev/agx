"""SkillArts tiered PRB cadence (parity with skillarts_strategy.ts)."""

from __future__ import annotations

from typing import Any, Literal, Mapping, TypedDict

from worker.scenario_engine.date_calendar import add_calendar_days_utc, parse_iso_date_utc
from worker.scenario_engine.prb_weekday_anchors import (
    first_working_thursday_on_or_after,
    resolve_prb_anchor_day,
)
from worker.scenario_engine.scenario_linear_shared import (
    linear_allow_non_working_for,
    linear_clamp_days,
    linear_prb_step_allow_non_working,
    linear_step_payload,
)
from worker.scenario_engine.timing_profiles import uses_skillarts_tiered_prb_cadence
from worker.scenario_engine.working_days import (
    HolidaySet,
    add_working_days_utc,
    inclusive_working_day_span,
    next_working_day,
    previous_working_day_on_or_before,
)

SA_PRB_IDS = frozenset({
    'submit_prb1',
    'prb1_review',
    'submit_prb2',
    'prb2_review',
    'submit_prb3',
    'prb3_review',
})


class SkillArtsPrbRefs(TypedDict):
    skill_arts_prb1_submit_start: str | None
    skill_arts_prb1_submit_end: str | None
    skill_arts_prb2_submit_start: str | None
    skill_arts_prb2_submit_end: str | None
    skill_arts_prb3_submit_start: str | None
    skill_arts_prb3_submit_end: str | None


def skill_arts_apply_pinned_prefix_prb_state(
    timing_profile: str,
    allow: bool,
    row: Mapping[str, Any],
    pin: Mapping[str, Any],
    refs: SkillArtsPrbRefs,
) -> None:
    rid = str(row['id'])
    if not uses_skillarts_tiered_prb_cadence(timing_profile) or allow or rid not in SA_PRB_IDS:
        return
    if rid == 'submit_prb1':
        refs['skill_arts_prb1_submit_start'] = str(pin['start_date'])
        refs['skill_arts_prb1_submit_end'] = str(pin['end_date'])
    elif rid == 'submit_prb2':
        refs['skill_arts_prb2_submit_start'] = str(pin['start_date'])
        refs['skill_arts_prb2_submit_end'] = str(pin['end_date'])
    elif rid == 'submit_prb3':
        refs['skill_arts_prb3_submit_start'] = str(pin['start_date'])
        refs['skill_arts_prb3_submit_end'] = str(pin['end_date'])


def skill_arts_adjust_effective_for_development_dev_gap(
    timing_profile: str,
    allow: bool,
    row: Mapping[str, Any],
    holidays: HolidaySet,
    allow_map: dict[str, bool] | None,
    mod_sum: int,
    effective: int,
    skill_arts_tier_span: int,
    refs: SkillArtsPrbRefs,
) -> int | str:
    rid = str(row['id'])
    dev_prb_row = rid in ('development_prb1', 'development_prb2', 'development_prb3')
    use_skillarts_tiered_dev_gap = uses_skillarts_tiered_prb_cadence(timing_profile) and not allow and dev_prb_row
    if not use_skillarts_tiered_dev_gap:
        return effective

    submit_anchor_a: str | None = None
    submit_end_sa: str | None = None
    review_phase_s: Literal['prb1_review', 'prb2_review', 'prb3_review'] = 'prb1_review'
    err_early_s = 'PRB1 development scheduled before PRB1 submit (internal error).'
    if rid == 'development_prb1':
        submit_anchor_a = refs['skill_arts_prb1_submit_start']
        submit_end_sa = refs['skill_arts_prb1_submit_end']
        review_phase_s = 'prb1_review'
        err_early_s = 'PRB1 development scheduled before PRB1 submit (internal error).'
    elif rid == 'development_prb2':
        submit_anchor_a = refs['skill_arts_prb2_submit_start']
        submit_end_sa = refs['skill_arts_prb2_submit_end']
        review_phase_s = 'prb2_review'
        err_early_s = 'PRB2 development scheduled before PRB2 submit (internal error).'
    else:
        submit_anchor_a = refs['skill_arts_prb3_submit_start']
        submit_end_sa = refs['skill_arts_prb3_submit_end']
        review_phase_s = 'prb3_review'
        err_early_s = 'PRB3 development scheduled before PRB3 submit (internal error).'
    if not submit_anchor_a or not submit_end_sa:
        return err_early_s
    ideal_review = add_working_days_utc(submit_anchor_a, skill_arts_tier_span - 1, holidays)
    review_allow_s = linear_allow_non_working_for(review_phase_s, allow_map)
    review_resolved_s = resolve_prb_anchor_day(ideal_review, holidays, review_allow_s)
    gap_start = next_working_day(add_calendar_days_utc(submit_end_sa, 1), holidays)
    gap_end = previous_working_day_on_or_before(
        add_calendar_days_utc(str(review_resolved_s['iso']), -1), holidays
    )
    if parse_iso_date_utc(gap_start) > parse_iso_date_utc(gap_end):
        gap_start = gap_end
    raw_span = max(1, inclusive_working_day_span(gap_start, gap_end, holidays))
    bumped = linear_clamp_days(raw_span + mod_sum, row)
    return min(bumped, raw_span)


def skill_arts_try_place_tiered_prb_row(
    timing_profile: str,
    allow: bool,
    row: Mapping[str, Any],
    cursor_cal: str,
    holidays: HolidaySet,
    allow_map: dict[str, bool] | None,
    effective: int,
    note_out: str,
    skill_arts_tier_span: int,
    refs: SkillArtsPrbRefs,
    steps_out: list[dict[str, Any]],
) -> tuple[Literal['placed'], str] | tuple[Literal['skip'], None] | tuple[Literal['err'], str]:
    rid = str(row['id'])
    use_skillarts_tiered_cadence = (
        uses_skillarts_tiered_prb_cadence(timing_profile) and not allow and rid in SA_PRB_IDS
    )
    if not use_skillarts_tiered_cadence:
        return ('skip', None)

    phase_allow = linear_allow_non_working_for(rid, allow_map)

    if rid == 'submit_prb1':
        min_start = next_working_day(cursor_cal, holidays)
        merged = min_start
        thu_raw = first_working_thursday_on_or_after(merged, holidays)
        resolved = resolve_prb_anchor_day(thu_raw, holidays, phase_allow)
        start = str(resolved['iso'])
        end = add_working_days_utc(start, effective - 1, holidays)
        refs['skill_arts_prb1_submit_start'] = start
        refs['skill_arts_prb1_submit_end'] = end
        steps_out.append(
            linear_step_payload(
                str(row['label']),
                start,
                end,
                note_out,
                linear_prb_step_allow_non_working(
                    phase_allow, start, holidays, bool(resolved['needsAllowNonWorkingFlag'])
                ),
            )
        )
        return ('placed', add_calendar_days_utc(end, 1))
    if rid == 'prb1_review':
        if not refs['skill_arts_prb1_submit_start']:
            return ('err', 'PRB1 review scheduled before PRB1 submit (internal error).')
        ideal_review = add_working_days_utc(refs['skill_arts_prb1_submit_start'], skill_arts_tier_span - 1, holidays)
        resolved = resolve_prb_anchor_day(ideal_review, holidays, phase_allow)
        start = str(resolved['iso'])
        end = add_working_days_utc(start, effective - 1, holidays)
        steps_out.append(
            linear_step_payload(
                str(row['label']),
                start,
                end,
                note_out,
                linear_prb_step_allow_non_working(
                    phase_allow, start, holidays, bool(resolved['needsAllowNonWorkingFlag'])
                ),
            )
        )
        return ('placed', add_calendar_days_utc(end, 1))
    if rid == 'submit_prb2':
        min_start = next_working_day(cursor_cal, holidays)
        merged = min_start
        thu_raw = first_working_thursday_on_or_after(merged, holidays)
        resolved = resolve_prb_anchor_day(thu_raw, holidays, phase_allow)
        start = str(resolved['iso'])
        end = add_working_days_utc(start, effective - 1, holidays)
        refs['skill_arts_prb2_submit_start'] = start
        refs['skill_arts_prb2_submit_end'] = end
        steps_out.append(
            linear_step_payload(
                str(row['label']),
                start,
                end,
                note_out,
                linear_prb_step_allow_non_working(
                    phase_allow, start, holidays, bool(resolved['needsAllowNonWorkingFlag'])
                ),
            )
        )
        return ('placed', add_calendar_days_utc(end, 1))
    if rid == 'prb2_review':
        if not refs['skill_arts_prb2_submit_start']:
            return ('err', 'PRB2 review scheduled before PRB2 submit (internal error).')
        ideal_review = add_working_days_utc(refs['skill_arts_prb2_submit_start'], skill_arts_tier_span - 1, holidays)
        resolved = resolve_prb_anchor_day(ideal_review, holidays, phase_allow)
        start = str(resolved['iso'])
        end = add_working_days_utc(start, effective - 1, holidays)
        steps_out.append(
            linear_step_payload(
                str(row['label']),
                start,
                end,
                note_out,
                linear_prb_step_allow_non_working(
                    phase_allow, start, holidays, bool(resolved['needsAllowNonWorkingFlag'])
                ),
            )
        )
        return ('placed', add_calendar_days_utc(end, 1))
    if rid == 'submit_prb3':
        min_start = next_working_day(cursor_cal, holidays)
        merged = min_start
        thu_raw = first_working_thursday_on_or_after(merged, holidays)
        resolved = resolve_prb_anchor_day(thu_raw, holidays, phase_allow)
        start = str(resolved['iso'])
        end = add_working_days_utc(start, effective - 1, holidays)
        refs['skill_arts_prb3_submit_start'] = start
        refs['skill_arts_prb3_submit_end'] = end
        steps_out.append(
            linear_step_payload(
                str(row['label']),
                start,
                end,
                note_out,
                linear_prb_step_allow_non_working(
                    phase_allow, start, holidays, bool(resolved['needsAllowNonWorkingFlag'])
                ),
            )
        )
        return ('placed', add_calendar_days_utc(end, 1))
    if rid == 'prb3_review':
        if not refs['skill_arts_prb3_submit_start']:
            return ('err', 'PRB3 review scheduled before PRB3 submit (internal error).')
        ideal_review = add_working_days_utc(refs['skill_arts_prb3_submit_start'], skill_arts_tier_span - 1, holidays)
        resolved = resolve_prb_anchor_day(ideal_review, holidays, phase_allow)
        start = str(resolved['iso'])
        end = add_working_days_utc(start, effective - 1, holidays)
        steps_out.append(
            linear_step_payload(
                str(row['label']),
                start,
                end,
                note_out,
                linear_prb_step_allow_non_working(
                    phase_allow, start, holidays, bool(resolved['needsAllowNonWorkingFlag'])
                ),
            )
        )
        return ('placed', add_calendar_days_utc(end, 1))
    return ('skip', None)


def skill_arts_try_place_tiered_development_dev_gap_row(
    timing_profile: str,
    allow: bool,
    row: Mapping[str, Any],
    holidays: HolidaySet,
    allow_map: dict[str, bool] | None,
    effective: int,
    note_out: str,
    skill_arts_tier_span: int,
    refs: SkillArtsPrbRefs,
    steps_out: list[dict[str, Any]],
) -> tuple[Literal['placed'], str] | tuple[Literal['skip'], None] | tuple[Literal['err'], str]:
    rid = str(row['id'])
    dev_prb_row = rid in ('development_prb1', 'development_prb2', 'development_prb3')
    use_skillarts_tiered_dev_gap = uses_skillarts_tiered_prb_cadence(timing_profile) and not allow and dev_prb_row
    if not use_skillarts_tiered_dev_gap:
        return ('skip', None)

    submit_sa = (
        refs['skill_arts_prb1_submit_start']
        if rid == 'development_prb1'
        else refs['skill_arts_prb2_submit_start']
        if rid == 'development_prb2'
        else refs['skill_arts_prb3_submit_start']
    )
    submit_end_sa = (
        refs['skill_arts_prb1_submit_end']
        if rid == 'development_prb1'
        else refs['skill_arts_prb2_submit_end']
        if rid == 'development_prb2'
        else refs['skill_arts_prb3_submit_end']
    )
    review_phase_sa = (
        'prb1_review' if rid == 'development_prb1' else 'prb2_review' if rid == 'development_prb2' else 'prb3_review'
    )
    if submit_sa is None or submit_end_sa is None:
        return ('err', 'PRB development gap missing submit anchor (internal error).')
    ideal_review_sa = add_working_days_utc(submit_sa, skill_arts_tier_span - 1, holidays)
    review_allow_sa = linear_allow_non_working_for(review_phase_sa, allow_map)
    review_resolved_sa = resolve_prb_anchor_day(ideal_review_sa, holidays, review_allow_sa)
    gap_start = next_working_day(add_calendar_days_utc(submit_end_sa, 1), holidays)
    gap_end = previous_working_day_on_or_before(
        add_calendar_days_utc(str(review_resolved_sa['iso']), -1), holidays
    )
    if parse_iso_date_utc(gap_start) > parse_iso_date_utc(gap_end):
        gap_start = gap_end
    start = gap_start
    end = add_working_days_utc(start, effective - 1, holidays)
    steps_out.append(linear_step_payload(str(row['label']), start, end, note_out, False))
    return ('placed', add_calendar_days_utc(end, 1))

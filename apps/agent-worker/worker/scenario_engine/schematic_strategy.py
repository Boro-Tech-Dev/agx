"""Schematic / generic HCP MLR PRB cadence (parity with schematic_strategy.ts)."""

from __future__ import annotations

from typing import Any, Literal, Mapping, TypedDict

from worker.scenario_engine.date_calendar import add_calendar_days_utc, parse_iso_date_utc
from worker.scenario_engine.prb_weekday_anchors import (
    first_working_monday_on_or_after,
    resolve_prb_anchor_day,
    second_working_wednesday_after_monday_submit,
)
from worker.scenario_engine.scenario_linear_shared import (
    linear_allow_non_working_for,
    linear_clamp_days,
    linear_prb_step_allow_non_working,
    linear_step_payload,
)
from worker.scenario_engine.timing_profiles import uses_schematic_mlr_prb_cadence
from worker.scenario_engine.working_days import (
    HolidaySet,
    add_working_days_utc,
    inclusive_working_day_span,
    next_working_day,
    previous_working_day_on_or_before,
)

MLR_PRB_IDS = frozenset({
    'submit_prb1',
    'prb1_review',
    'submit_prb2',
    'prb2_review',
    'submit_prb3',
    'prb3_review',
})


class SchematicMlrPrbRefs(TypedDict):
    email_prb1_submit_monday: str | None
    email_prb1_submit_end: str | None
    email_prb2_submit_monday: str | None
    email_prb2_submit_end: str | None
    email_prb3_submit_monday: str | None
    email_prb3_submit_end: str | None


def schematic_mlr_apply_pinned_prefix_prb_state(
    timing_profile: str,
    allow: bool,
    row: Mapping[str, Any],
    pin: Mapping[str, Any],
    refs: SchematicMlrPrbRefs,
) -> None:
    rid = str(row['id'])
    if not uses_schematic_mlr_prb_cadence(timing_profile) or allow or rid not in MLR_PRB_IDS:
        return
    if rid == 'submit_prb1':
        refs['email_prb1_submit_monday'] = str(pin['start_date'])
        refs['email_prb1_submit_end'] = str(pin['end_date'])
    elif rid == 'submit_prb2':
        refs['email_prb2_submit_monday'] = str(pin['start_date'])
        refs['email_prb2_submit_end'] = str(pin['end_date'])
    elif rid == 'submit_prb3':
        refs['email_prb3_submit_monday'] = str(pin['start_date'])
        refs['email_prb3_submit_end'] = str(pin['end_date'])


def schematic_mlr_adjust_effective_for_development_dev_gap(
    timing_profile: str,
    allow: bool,
    row: Mapping[str, Any],
    holidays: HolidaySet,
    allow_map: dict[str, bool] | None,
    mod_sum: int,
    effective: int,
    refs: SchematicMlrPrbRefs,
) -> int | str:
    rid = str(row['id'])
    dev_prb_row = rid in ('development_prb1', 'development_prb2', 'development_prb3')
    use_email_prb_dev_gap = uses_schematic_mlr_prb_cadence(timing_profile) and not allow and dev_prb_row
    if not use_email_prb_dev_gap:
        return effective

    submit_mon_a: str | None = None
    submit_end_a: str | None = None
    review_phase_e: Literal['prb1_review', 'prb2_review', 'prb3_review'] = 'prb1_review'
    err_early = 'PRB1 development scheduled before PRB1 submit (internal error).'
    if rid == 'development_prb1':
        submit_mon_a = refs['email_prb1_submit_monday']
        submit_end_a = refs['email_prb1_submit_end']
        review_phase_e = 'prb1_review'
        err_early = 'PRB1 development scheduled before PRB1 submit (internal error).'
    elif rid == 'development_prb2':
        submit_mon_a = refs['email_prb2_submit_monday']
        submit_end_a = refs['email_prb2_submit_end']
        review_phase_e = 'prb2_review'
        err_early = 'PRB2 development scheduled before PRB2 submit (internal error).'
    else:
        submit_mon_a = refs['email_prb3_submit_monday']
        submit_end_a = refs['email_prb3_submit_end']
        review_phase_e = 'prb3_review'
        err_early = 'PRB3 development scheduled before PRB3 submit (internal error).'
    if not submit_mon_a or not submit_end_a:
        return err_early
    ideal_wed = second_working_wednesday_after_monday_submit(submit_mon_a, holidays)
    review_allow = linear_allow_non_working_for(review_phase_e, allow_map)
    review_resolved = resolve_prb_anchor_day(ideal_wed, holidays, review_allow)
    gap_start = next_working_day(add_calendar_days_utc(submit_end_a, 1), holidays)
    gap_end = previous_working_day_on_or_before(
        add_calendar_days_utc(str(review_resolved['iso']), -1), holidays
    )
    if parse_iso_date_utc(gap_start) > parse_iso_date_utc(gap_end):
        gap_start = gap_end
    raw_span = max(1, inclusive_working_day_span(gap_start, gap_end, holidays))
    bumped = linear_clamp_days(raw_span + mod_sum, row)
    return min(bumped, raw_span)


def schematic_mlr_try_place_prb_row(
    timing_profile: str,
    allow: bool,
    row: Mapping[str, Any],
    cursor_cal: str,
    holidays: HolidaySet,
    allow_map: dict[str, bool] | None,
    effective: int,
    note_out: str,
    refs: SchematicMlrPrbRefs,
    steps_out: list[dict[str, Any]],
) -> tuple[Literal['placed'], str] | tuple[Literal['skip'], None] | tuple[Literal['err'], str]:
    rid = str(row['id'])
    use_email_prb_cadence = uses_schematic_mlr_prb_cadence(timing_profile) and not allow and rid in MLR_PRB_IDS
    if not use_email_prb_cadence:
        return ('skip', None)

    phase_allow = linear_allow_non_working_for(rid, allow_map)

    if rid == 'submit_prb1':
        min_start = next_working_day(cursor_cal, holidays)
        merged = min_start
        mon_raw = first_working_monday_on_or_after(merged, holidays)
        resolved = resolve_prb_anchor_day(mon_raw, holidays, phase_allow)
        start = str(resolved['iso'])
        end = add_working_days_utc(start, effective - 1, holidays)
        refs['email_prb1_submit_monday'] = start
        refs['email_prb1_submit_end'] = end
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
        if not refs['email_prb1_submit_monday']:
            return ('err', 'PRB1 review scheduled before PRB1 submit (internal error).')
        ideal_wed = second_working_wednesday_after_monday_submit(refs['email_prb1_submit_monday'], holidays)
        resolved = resolve_prb_anchor_day(ideal_wed, holidays, phase_allow)
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
        mon_raw = first_working_monday_on_or_after(merged, holidays)
        resolved = resolve_prb_anchor_day(mon_raw, holidays, phase_allow)
        start = str(resolved['iso'])
        end = add_working_days_utc(start, effective - 1, holidays)
        refs['email_prb2_submit_monday'] = start
        refs['email_prb2_submit_end'] = end
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
        if not refs['email_prb2_submit_monday']:
            return ('err', 'PRB2 review scheduled before PRB2 submit (internal error).')
        ideal_wed = second_working_wednesday_after_monday_submit(refs['email_prb2_submit_monday'], holidays)
        resolved = resolve_prb_anchor_day(ideal_wed, holidays, phase_allow)
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
        mon_raw = first_working_monday_on_or_after(merged, holidays)
        resolved = resolve_prb_anchor_day(mon_raw, holidays, phase_allow)
        start = str(resolved['iso'])
        end = add_working_days_utc(start, effective - 1, holidays)
        refs['email_prb3_submit_monday'] = start
        refs['email_prb3_submit_end'] = end
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
        if not refs['email_prb3_submit_monday']:
            return ('err', 'PRB3 review scheduled before PRB3 submit (internal error).')
        ideal_wed = second_working_wednesday_after_monday_submit(refs['email_prb3_submit_monday'], holidays)
        resolved = resolve_prb_anchor_day(ideal_wed, holidays, phase_allow)
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


def schematic_mlr_try_place_development_dev_gap_row(
    timing_profile: str,
    allow: bool,
    row: Mapping[str, Any],
    holidays: HolidaySet,
    allow_map: dict[str, bool] | None,
    effective: int,
    note_out: str,
    refs: SchematicMlrPrbRefs,
    steps_out: list[dict[str, Any]],
) -> tuple[Literal['placed'], str] | tuple[Literal['skip'], None] | tuple[Literal['err'], str]:
    rid = str(row['id'])
    dev_prb_row = rid in ('development_prb1', 'development_prb2', 'development_prb3')
    use_email_prb_dev_gap = uses_schematic_mlr_prb_cadence(timing_profile) and not allow and dev_prb_row
    if not use_email_prb_dev_gap:
        return ('skip', None)

    submit_mon = (
        refs['email_prb1_submit_monday']
        if rid == 'development_prb1'
        else refs['email_prb2_submit_monday']
        if rid == 'development_prb2'
        else refs['email_prb3_submit_monday']
    )
    submit_end = (
        refs['email_prb1_submit_end']
        if rid == 'development_prb1'
        else refs['email_prb2_submit_end']
        if rid == 'development_prb2'
        else refs['email_prb3_submit_end']
    )
    review_phase = (
        'prb1_review' if rid == 'development_prb1' else 'prb2_review' if rid == 'development_prb2' else 'prb3_review'
    )
    if submit_mon is None or submit_end is None:
        return ('err', 'PRB development gap missing submit anchor (internal error).')
    ideal_wed = second_working_wednesday_after_monday_submit(submit_mon, holidays)
    review_resolved = resolve_prb_anchor_day(
        ideal_wed,
        holidays,
        linear_allow_non_working_for(review_phase, allow_map),
    )
    gap_start = next_working_day(add_calendar_days_utc(submit_end, 1), holidays)
    gap_end = previous_working_day_on_or_before(
        add_calendar_days_utc(str(review_resolved['iso']), -1), holidays
    )
    if parse_iso_date_utc(gap_start) > parse_iso_date_utc(gap_end):
        gap_start = gap_end
    start = gap_start
    end = add_working_days_utc(start, effective - 1, holidays)
    steps_out.append(linear_step_payload(str(row['label']), start, end, note_out, False))
    return ('placed', add_calendar_days_utc(end, 1))

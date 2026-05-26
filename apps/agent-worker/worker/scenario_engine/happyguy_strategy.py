"""HappyGuy week-aligned PRB cadence (parity with happyguy_strategy.ts)."""

from __future__ import annotations

from typing import Any, Literal, Mapping, TypedDict

from worker.scenario_engine.date_calendar import add_calendar_days_utc, parse_iso_date_utc
from worker.scenario_engine.prb_weekday_anchors import (
    first_working_thursday_on_or_after,
    first_working_tuesday_on_or_after,
    pick_happy_guy_submit_anchor_weekday,
    resolve_happy_guy_prb_review_start,
    resolve_prb_anchor_day,
    shift_happy_guy_client_share_approval_if_overloaded_tuesday,
)
from worker.scenario_engine.scenario_linear_shared import (
    linear_allow_non_working_for,
    linear_clamp_days,
    linear_prb_step_allow_non_working,
    linear_step_payload,
)
from worker.scenario_engine.timing_profiles import uses_happyguy_week_aligned_prb_cadence
from worker.scenario_engine.working_days import (
    HolidaySet,
    add_working_days_utc,
    inclusive_working_day_span,
    next_working_day,
    previous_working_day_on_or_before,
)

HAPPY_GUY_SHARE_CLIENT_APPROVAL_IDS = frozenset({
    'share_client_approval_prb1',
    'share_client_approval_prb2',
    'share_client_approval_prb3',
})

HG_PRB_CADENCE_ROW_IDS = frozenset({
    'submit_prb1',
    'prb1_review',
    'submit_prb2',
    'prb2_review',
    'submit_prb3',
    'prb3_review',
})

HG_PRB_PLACE_IDS = frozenset({
    'submit_prb1',
    'prb1_review',
    'submit_prb2',
    'prb2_review',
    'submit_prb3',
    'prb3_review',
})


def happy_guy_submit_ref_iso_from_cursor(cursor_cal: str) -> str:
    return cursor_cal


def maybe_shift_happy_guy_client_share(
    timing_profile: str,
    rid: str,
    start: str,
    end: str,
    hol: HolidaySet,
) -> tuple[str, str]:
    if not uses_happyguy_week_aligned_prb_cadence(timing_profile):
        return start, end
    if rid not in HAPPY_GUY_SHARE_CLIENT_APPROVAL_IDS:
        return start, end
    return shift_happy_guy_client_share_approval_if_overloaded_tuesday(start, end, hol)


class HappyGuyPrbRefs(TypedDict):
    happy_guy_prb1_submit_start: str | None
    happy_guy_prb1_submit_end: str | None
    happy_guy_prb2_submit_start: str | None
    happy_guy_prb2_submit_end: str | None
    happy_guy_prb3_submit_start: str | None
    happy_guy_prb3_submit_end: str | None
    happy_guy_prb1_anchor_wd: Literal['tuesday', 'thursday'] | None
    happy_guy_prb2_anchor_wd: Literal['tuesday', 'thursday'] | None
    happy_guy_prb3_anchor_wd: Literal['tuesday', 'thursday'] | None
    happy_guy_last_prb_review_start_for_opdp: str | None


def happy_guy_apply_pinned_prefix_prb_state(
    timing_profile: str,
    allow: bool,
    row: Mapping[str, Any],
    pin: Mapping[str, Any],
    cursor_cal: str,
    holidays: HolidaySet,
    refs: HappyGuyPrbRefs,
) -> None:
    rid = str(row['id'])
    if (
        not uses_happyguy_week_aligned_prb_cadence(timing_profile)
        or allow
        or rid not in HG_PRB_CADENCE_ROW_IDS
    ):
        return
    if rid == 'submit_prb1':
        ref_iso = happy_guy_submit_ref_iso_from_cursor(cursor_cal)
        refs['happy_guy_prb1_anchor_wd'] = pick_happy_guy_submit_anchor_weekday(ref_iso, holidays)
        refs['happy_guy_prb1_submit_start'] = str(pin['start_date'])
        refs['happy_guy_prb1_submit_end'] = str(pin['end_date'])
    elif rid == 'prb1_review':
        refs['happy_guy_last_prb_review_start_for_opdp'] = str(pin['start_date'])
    elif rid == 'submit_prb2':
        ref_iso = happy_guy_submit_ref_iso_from_cursor(cursor_cal)
        refs['happy_guy_prb2_anchor_wd'] = pick_happy_guy_submit_anchor_weekday(ref_iso, holidays)
        refs['happy_guy_prb2_submit_start'] = str(pin['start_date'])
        refs['happy_guy_prb2_submit_end'] = str(pin['end_date'])
    elif rid == 'prb2_review':
        refs['happy_guy_last_prb_review_start_for_opdp'] = str(pin['start_date'])
    elif rid == 'submit_prb3':
        ref_iso = happy_guy_submit_ref_iso_from_cursor(cursor_cal)
        refs['happy_guy_prb3_anchor_wd'] = pick_happy_guy_submit_anchor_weekday(ref_iso, holidays)
        refs['happy_guy_prb3_submit_start'] = str(pin['start_date'])
        refs['happy_guy_prb3_submit_end'] = str(pin['end_date'])
    elif rid == 'prb3_review':
        refs['happy_guy_last_prb_review_start_for_opdp'] = str(pin['start_date'])


def happy_guy_adjust_effective_for_development_dev_gap(
    timing_profile: str,
    allow: bool,
    row: Mapping[str, Any],
    holidays: HolidaySet,
    allow_map: dict[str, bool] | None,
    mod_sum: int,
    effective: int,
    refs: HappyGuyPrbRefs,
) -> int | str:
    rid = str(row['id'])
    dev_prb_row = rid in ('development_prb1', 'development_prb2', 'development_prb3')
    use_happyguy_week_aligned_dev_gap = (
        uses_happyguy_week_aligned_prb_cadence(timing_profile) and not allow and dev_prb_row
    )
    if not use_happyguy_week_aligned_dev_gap:
        return effective

    submit_anchor: str | None = None
    submit_end: str | None = None
    review_phase_h: Literal['prb1_review', 'prb2_review', 'prb3_review'] = 'prb1_review'
    round_anchor_h: Literal['tuesday', 'thursday'] | None = None
    err_early_h = 'PRB1 development scheduled before PRB1 submit (internal error).'
    if rid == 'development_prb1':
        submit_anchor = refs['happy_guy_prb1_submit_start']
        submit_end = refs['happy_guy_prb1_submit_end']
        review_phase_h = 'prb1_review'
        round_anchor_h = refs['happy_guy_prb1_anchor_wd']
        err_early_h = 'PRB1 development scheduled before PRB1 submit (internal error).'
    elif rid == 'development_prb2':
        submit_anchor = refs['happy_guy_prb2_submit_start']
        submit_end = refs['happy_guy_prb2_submit_end']
        review_phase_h = 'prb2_review'
        round_anchor_h = refs['happy_guy_prb2_anchor_wd']
        err_early_h = 'PRB2 development scheduled before PRB2 submit (internal error).'
    else:
        submit_anchor = refs['happy_guy_prb3_submit_start']
        submit_end = refs['happy_guy_prb3_submit_end']
        review_phase_h = 'prb3_review'
        round_anchor_h = refs['happy_guy_prb3_anchor_wd']
        err_early_h = 'PRB3 development scheduled before PRB3 submit (internal error).'
    if not submit_anchor or not submit_end or not round_anchor_h:
        return err_early_h

    ideal_review_cal = add_calendar_days_utc(submit_anchor, 7)
    review_allow_h = linear_allow_non_working_for(review_phase_h, allow_map)
    review_resolved_h = resolve_happy_guy_prb_review_start(
        ideal_review_cal, round_anchor_h, holidays, review_allow_h
    )
    gap_start = next_working_day(add_calendar_days_utc(submit_end, 1), holidays)
    gap_end = previous_working_day_on_or_before(
        add_calendar_days_utc(str(review_resolved_h['iso']), -1), holidays
    )
    if parse_iso_date_utc(gap_start) > parse_iso_date_utc(gap_end):
        gap_start = gap_end
    raw_span = max(1, inclusive_working_day_span(gap_start, gap_end, holidays))
    bumped = linear_clamp_days(raw_span + mod_sum, row)
    return min(bumped, raw_span)


def happy_guy_try_place_week_aligned_prb_row(
    timing_profile: str,
    allow: bool,
    row: Mapping[str, Any],
    cursor_cal: str,
    holidays: HolidaySet,
    allow_map: dict[str, bool] | None,
    effective: int,
    note_out: str,
    refs: HappyGuyPrbRefs,
    steps_out: list[dict[str, Any]],
) -> (
    tuple[Literal['placed'], str]
    | tuple[Literal['skip'], None]
    | tuple[Literal['err'], str]
):
    rid = str(row['id'])
    use_happyguy_week_aligned_cadence = (
        uses_happyguy_week_aligned_prb_cadence(timing_profile) and not allow and rid in HG_PRB_PLACE_IDS
    )
    if not use_happyguy_week_aligned_cadence:
        return ('skip', None)

    phase_allow = linear_allow_non_working_for(rid, allow_map)
    if rid == 'submit_prb1':
        ref_iso = happy_guy_submit_ref_iso_from_cursor(cursor_cal)
        anchor_wd = pick_happy_guy_submit_anchor_weekday(ref_iso, holidays)
        refs['happy_guy_prb1_anchor_wd'] = anchor_wd
        raw = (
            first_working_tuesday_on_or_after(ref_iso, holidays)
            if anchor_wd == 'tuesday'
            else first_working_thursday_on_or_after(ref_iso, holidays)
        )
        resolved = resolve_prb_anchor_day(raw, holidays, phase_allow)
        start = str(resolved['iso'])
        end = add_working_days_utc(start, effective - 1, holidays)
        refs['happy_guy_prb1_submit_start'] = start
        refs['happy_guy_prb1_submit_end'] = end
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
        if not refs['happy_guy_prb1_submit_start'] or not refs['happy_guy_prb1_anchor_wd']:
            return ('err', 'PRB1 review scheduled before PRB1 submit (internal error).')
        ideal_review_cal = add_calendar_days_utc(refs['happy_guy_prb1_submit_start'], 7)
        resolved = resolve_happy_guy_prb_review_start(
            ideal_review_cal, refs['happy_guy_prb1_anchor_wd'], holidays, phase_allow
        )
        start = str(resolved['iso'])
        end = add_working_days_utc(start, effective - 1, holidays)
        refs['happy_guy_last_prb_review_start_for_opdp'] = start
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
        ref_iso = happy_guy_submit_ref_iso_from_cursor(cursor_cal)
        anchor_wd = pick_happy_guy_submit_anchor_weekday(ref_iso, holidays)
        refs['happy_guy_prb2_anchor_wd'] = anchor_wd
        raw = (
            first_working_tuesday_on_or_after(ref_iso, holidays)
            if anchor_wd == 'tuesday'
            else first_working_thursday_on_or_after(ref_iso, holidays)
        )
        resolved = resolve_prb_anchor_day(raw, holidays, phase_allow)
        start = str(resolved['iso'])
        end = add_working_days_utc(start, effective - 1, holidays)
        refs['happy_guy_prb2_submit_start'] = start
        refs['happy_guy_prb2_submit_end'] = end
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
        if not refs['happy_guy_prb2_submit_start'] or not refs['happy_guy_prb2_anchor_wd']:
            return ('err', 'PRB2 review scheduled before PRB2 submit (internal error).')
        ideal_review_cal = add_calendar_days_utc(refs['happy_guy_prb2_submit_start'], 7)
        resolved = resolve_happy_guy_prb_review_start(
            ideal_review_cal, refs['happy_guy_prb2_anchor_wd'], holidays, phase_allow
        )
        start = str(resolved['iso'])
        end = add_working_days_utc(start, effective - 1, holidays)
        refs['happy_guy_last_prb_review_start_for_opdp'] = start
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
        ref_iso = happy_guy_submit_ref_iso_from_cursor(cursor_cal)
        anchor_wd = pick_happy_guy_submit_anchor_weekday(ref_iso, holidays)
        refs['happy_guy_prb3_anchor_wd'] = anchor_wd
        raw = (
            first_working_tuesday_on_or_after(ref_iso, holidays)
            if anchor_wd == 'tuesday'
            else first_working_thursday_on_or_after(ref_iso, holidays)
        )
        resolved = resolve_prb_anchor_day(raw, holidays, phase_allow)
        start = str(resolved['iso'])
        end = add_working_days_utc(start, effective - 1, holidays)
        refs['happy_guy_prb3_submit_start'] = start
        refs['happy_guy_prb3_submit_end'] = end
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
        if not refs['happy_guy_prb3_submit_start'] or not refs['happy_guy_prb3_anchor_wd']:
            return ('err', 'PRB3 review scheduled before PRB3 submit (internal error).')
        ideal_review_cal = add_calendar_days_utc(refs['happy_guy_prb3_submit_start'], 7)
        resolved = resolve_happy_guy_prb_review_start(
            ideal_review_cal, refs['happy_guy_prb3_anchor_wd'], holidays, phase_allow
        )
        start = str(resolved['iso'])
        end = add_working_days_utc(start, effective - 1, holidays)
        refs['happy_guy_last_prb_review_start_for_opdp'] = start
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


def happy_guy_try_place_week_aligned_development_dev_gap_row(
    timing_profile: str,
    allow: bool,
    row: Mapping[str, Any],
    holidays: HolidaySet,
    allow_map: dict[str, bool] | None,
    effective: int,
    note_out: str,
    refs: HappyGuyPrbRefs,
    steps_out: list[dict[str, Any]],
) -> (
    tuple[Literal['placed'], str]
    | tuple[Literal['skip'], None]
    | tuple[Literal['err'], str]
):
    rid = str(row['id'])
    dev_prb_row = rid in ('development_prb1', 'development_prb2', 'development_prb3')
    use_happyguy_week_aligned_dev_gap = (
        uses_happyguy_week_aligned_prb_cadence(timing_profile) and not allow and dev_prb_row
    )
    if not use_happyguy_week_aligned_dev_gap:
        return ('skip', None)

    round_wd = (
        refs['happy_guy_prb1_anchor_wd']
        if rid == 'development_prb1'
        else refs['happy_guy_prb2_anchor_wd']
        if rid == 'development_prb2'
        else refs['happy_guy_prb3_anchor_wd']
    )
    submit_anchor = (
        refs['happy_guy_prb1_submit_start']
        if rid == 'development_prb1'
        else refs['happy_guy_prb2_submit_start']
        if rid == 'development_prb2'
        else refs['happy_guy_prb3_submit_start']
    )
    submit_end = (
        refs['happy_guy_prb1_submit_end']
        if rid == 'development_prb1'
        else refs['happy_guy_prb2_submit_end']
        if rid == 'development_prb2'
        else refs['happy_guy_prb3_submit_end']
    )
    review_phase_h2: Literal['prb1_review', 'prb2_review', 'prb3_review'] = (
        'prb1_review' if rid == 'development_prb1' else 'prb2_review' if rid == 'development_prb2' else 'prb3_review'
    )
    if submit_anchor is None or submit_end is None or round_wd is None:
        return ('err', 'PRB development gap missing HappyGuy submit anchor (internal error).')
    ideal_review_h2 = add_calendar_days_utc(submit_anchor, 7)
    review_allow_h2 = linear_allow_non_working_for(review_phase_h2, allow_map)
    review_resolved_h2 = resolve_happy_guy_prb_review_start(
        ideal_review_h2, round_wd, holidays, review_allow_h2
    )
    gap_start = next_working_day(add_calendar_days_utc(submit_end, 1), holidays)
    gap_end = previous_working_day_on_or_before(
        add_calendar_days_utc(str(review_resolved_h2['iso']), -1), holidays
    )
    if parse_iso_date_utc(gap_start) > parse_iso_date_utc(gap_end):
        gap_start = gap_end
    start = gap_start
    end = add_working_days_utc(start, effective - 1, holidays)
    steps_out.append(linear_step_payload(str(row['label']), start, end, note_out, False))
    return ('placed', add_calendar_days_utc(end, 1))

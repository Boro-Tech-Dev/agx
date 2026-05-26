"""Parity with prbWeekdayAnchors.ts."""

from __future__ import annotations

from typing import Literal, NotRequired, TypedDict

from worker.scenario_engine.date_calendar import (
    add_calendar_days_utc,
    calendar_days_offset,
    parse_iso_date_utc,
)
from worker.scenario_engine.email_baseline import BASELINE_BY_ID, EMAIL_BASELINE_KICKOFF_ISO
from worker.scenario_engine.working_days import (
    HolidaySet,
    add_working_days_utc,
    inclusive_working_day_span,
    is_weekend_iso,
    is_working_day,
    next_working_day,
    previous_working_day_on_or_before,
)


class MonWedPrbResolvedRow(TypedDict):
    start: str
    end: str
    allowNonWorking: bool


class MonWedPrbResolved(TypedDict):
    submit_prb1: MonWedPrbResolvedRow
    prb1_review: MonWedPrbResolvedRow
    submit_prb2: MonWedPrbResolvedRow
    prb2_review: MonWedPrbResolvedRow
    submit_prb3: MonWedPrbResolvedRow
    prb3_review: MonWedPrbResolvedRow


class PrbBrandFromShifted(TypedDict):
    mode: Literal['from_shifted_baseline']


class PrbBrandExplicit(TypedDict):
    mode: Literal['explicit_submits']
    prb1SubmitIso: str
    prb2SubmitIso: str
    prb3SubmitIso: NotRequired[str]


PrbBrandConfig = PrbBrandFromShifted | PrbBrandExplicit


def _baseline_row(phase_id: str) -> dict[str, str]:
    r = BASELINE_BY_ID.get(phase_id)
    if not r:
        raise RuntimeError(f'Missing EMAIL_BASELINE row: {phase_id}')
    return r


def _submit_to_review_calendar_delta(submit_phase_id: str, review_phase_id: str) -> int:
    s = _baseline_row(submit_phase_id)
    e = _baseline_row(review_phase_id)
    return calendar_days_offset(s['start_date'], e['start_date'])


PRB1_SUBMIT_TO_REVIEW_CALENDAR_DELTA = _submit_to_review_calendar_delta('submit_prb1', 'prb1_review')
PRB2_SUBMIT_TO_REVIEW_CALENDAR_DELTA = _submit_to_review_calendar_delta('submit_prb2', 'prb2_review')
PRB3_SUBMIT_TO_REVIEW_CALENDAR_DELTA = _submit_to_review_calendar_delta('submit_prb3', 'prb3_review')


def utc_monday_of_week_containing(iso: str) -> str:
    d = parse_iso_date_utc(iso)
    days_from_monday = d.weekday()
    return add_calendar_days_utc(iso, -days_from_monday)


def utc_thursday_of_week_containing(iso: str) -> str:
    return add_calendar_days_utc(utc_monday_of_week_containing(iso), 3)


def utc_tuesday_of_week_containing(iso: str) -> str:
    return add_calendar_days_utc(utc_monday_of_week_containing(iso), 1)


def first_working_tuesday_on_or_after(iso: str, holidays: HolidaySet) -> str:
    cur = iso
    for _ in range(400):
        d = parse_iso_date_utc(cur)
        if d.weekday() == 1 and is_working_day(cur, holidays):
            return cur
        cur = add_calendar_days_utc(cur, 1)
    raise RuntimeError('first_working_tuesday_on_or_after: exceeded search window')


def first_working_thursday_on_or_after(iso: str, holidays: HolidaySet) -> str:
    cur = iso
    for _ in range(400):
        d = parse_iso_date_utc(cur)
        if d.weekday() == 3 and is_working_day(cur, holidays):
            return cur
        cur = add_calendar_days_utc(cur, 1)
    raise RuntimeError('first_working_thursday_on_or_after: exceeded search window')


def resolve_prb_anchor_day(
    ideal_iso: str,
    holidays: HolidaySet,
    allow_non_working: bool,
) -> dict[str, str | bool]:
    if is_working_day(ideal_iso, holidays):
        return {'iso': ideal_iso, 'needsAllowNonWorkingFlag': False}
    candidate = add_calendar_days_utc(ideal_iso, -1)
    if is_working_day(candidate, holidays):
        return {'iso': candidate, 'needsAllowNonWorkingFlag': False}
    if allow_non_working:
        return {
            'iso': candidate,
            'needsAllowNonWorkingFlag': not is_working_day(candidate, holidays),
        }
    return {
        'iso': previous_working_day_on_or_before(candidate, holidays),
        'needsAllowNonWorkingFlag': False,
    }


def resolve_happy_guy_prb_review_start(
    ideal_review_cal_iso: str,
    anchor_weekday: Literal['tuesday', 'thursday'],
    holidays: HolidaySet,
    _allow_non_working: bool,
) -> dict[str, str | bool]:
    """HappyGuy prb*_review: submit_start + 7 calendar days, then first working Tue/Thu on or after."""
    if anchor_weekday == 'tuesday':
        snap = first_working_tuesday_on_or_after(ideal_review_cal_iso, holidays)
    else:
        snap = first_working_thursday_on_or_after(ideal_review_cal_iso, holidays)
    return {'iso': snap, 'needsAllowNonWorkingFlag': False}


HappyGuySubmitAnchorWeekday = Literal['tuesday', 'thursday']


def neutral_shifted_submit_start_from_kickoff(
    anchor_start_iso: str,
    submit_phase_id: Literal['submit_prb1', 'submit_prb2', 'submit_prb3'],
    brand: PrbBrandConfig,
) -> str:
    """Kickoff-shifted baseline submit ISO without snapping to a weekday (HappyGuy proximity ref)."""
    if brand['mode'] == 'explicit_submits':
        if submit_phase_id == 'submit_prb1':
            return brand['prb1SubmitIso']
        if submit_phase_id == 'submit_prb2':
            return brand['prb2SubmitIso']
        raw_o = brand.get('prb3SubmitIso')
        if raw_o:
            return raw_o
        shift = calendar_days_offset(EMAIL_BASELINE_KICKOFF_ISO, anchor_start_iso)
        baseline_submit = _baseline_row('submit_prb3')['start_date']
        return add_calendar_days_utc(baseline_submit, shift)
    shift = calendar_days_offset(EMAIL_BASELINE_KICKOFF_ISO, anchor_start_iso)
    baseline_submit = _baseline_row(submit_phase_id)['start_date']
    return add_calendar_days_utc(baseline_submit, shift)


def pick_happy_guy_submit_anchor_weekday(iso: str, holidays: HolidaySet) -> HappyGuySubmitAnchorWeekday:
    """Pick Tuesday vs Thursday by calendar proximity forward from iso; tie → Tuesday."""
    t = first_working_tuesday_on_or_after(iso, holidays)
    h = first_working_thursday_on_or_after(iso, holidays)
    d_tue = calendar_days_offset(iso, t)
    d_thu = calendar_days_offset(iso, h)
    if d_tue <= d_thu:
        return 'tuesday'
    return 'thursday'


def count_consecutive_working_days_before(start_iso: str, holidays: HolidaySet) -> int:
    """Two ISO weeks lookback from day before start; weekends bridge; holiday breaks."""
    day_before = add_calendar_days_utc(start_iso, -1)
    week_monday = utc_monday_of_week_containing(day_before)
    window_start = add_calendar_days_utc(week_monday, -7)
    cur = day_before
    n = 0
    while cur >= window_start:
        if is_weekend_iso(cur):
            cur = add_calendar_days_utc(cur, -1)
            continue
        if not is_working_day(cur, holidays):
            break
        n += 1
        cur = add_calendar_days_utc(cur, -1)
    return n


def _previous_working_monday_from_calendar_monday(monday_iso: str, holidays: HolidaySet) -> str:
    mon = monday_iso
    for _ in range(60):
        if parse_iso_date_utc(mon).weekday() != 0:
            raise RuntimeError('previous_working_monday_from_calendar_monday: expected Monday')
        if is_working_day(mon, holidays):
            return mon
        mon = add_calendar_days_utc(mon, -7)
    raise RuntimeError('previous_working_monday_from_calendar_monday: exceeded search')


def shift_happy_guy_client_share_approval_if_overloaded_tuesday(
    start_iso: str, end_iso: str, holidays: HolidaySet
) -> tuple[str, str]:
    if not is_working_day(start_iso, holidays):
        return start_iso, end_iso
    if parse_iso_date_utc(start_iso).weekday() != 1:
        return start_iso, end_iso
    if count_consecutive_working_days_before(start_iso, holidays) <= 4:
        return start_iso, end_iso
    cal_monday = add_calendar_days_utc(start_iso, -1)
    new_start = _previous_working_monday_from_calendar_monday(cal_monday, holidays)
    wd_span = inclusive_working_day_span(start_iso, end_iso, holidays)
    new_end = new_start if wd_span <= 1 else add_working_days_utc(new_start, wd_span - 1, holidays)
    return new_start, new_end


def max_iso_date(a: str, b: str) -> str:
    return a if a >= b else b


def first_working_monday_on_or_after(iso: str, holidays: HolidaySet) -> str:
    cur = iso
    for _ in range(400):
        d = parse_iso_date_utc(cur)
        if d.weekday() == 0 and is_working_day(cur, holidays):
            return cur
        cur = add_calendar_days_utc(cur, 1)
    raise RuntimeError('first_working_monday_on_or_after: exceeded search window')


def second_working_wednesday_after_monday_submit(submit_monday_iso: str, holidays: HolidaySet) -> str:
    wed = add_calendar_days_utc(submit_monday_iso, 2)
    while parse_iso_date_utc(wed).weekday() != 2:
        wed = add_calendar_days_utc(wed, 1)
    counted = 0
    for _ in range(120):
        if is_working_day(wed, holidays):
            counted += 1
            if counted == 2:
                return wed
        wed = add_calendar_days_utc(wed, 7)
    raise RuntimeError('second_working_wednesday_after_monday_submit: exceeded search window')


def ideal_monday_for_submit_from_kickoff(
    anchor_start_iso: str,
    submit_phase_id: Literal['submit_prb1', 'submit_prb2', 'submit_prb3'],
    brand: PrbBrandConfig,
) -> str:
    if brand['mode'] == 'explicit_submits':
        if submit_phase_id == 'submit_prb1':
            raw = brand['prb1SubmitIso']
        elif submit_phase_id == 'submit_prb2':
            raw = brand['prb2SubmitIso']
        else:
            raw_o = brand.get('prb3SubmitIso')
            if raw_o:
                raw = raw_o
            else:
                shift = calendar_days_offset(EMAIL_BASELINE_KICKOFF_ISO, anchor_start_iso)
                baseline_submit = _baseline_row('submit_prb3')['start_date']
                raw = add_calendar_days_utc(baseline_submit, shift)
        return utc_monday_of_week_containing(raw)
    shift = calendar_days_offset(EMAIL_BASELINE_KICKOFF_ISO, anchor_start_iso)
    baseline_submit = _baseline_row(submit_phase_id)['start_date']
    shifted = add_calendar_days_utc(baseline_submit, shift)
    return utc_monday_of_week_containing(shifted)


def ideal_tuesday_for_submit_from_kickoff(
    anchor_start_iso: str,
    submit_phase_id: Literal['submit_prb1', 'submit_prb2', 'submit_prb3'],
    brand: PrbBrandConfig,
) -> str:
    if brand['mode'] == 'explicit_submits':
        if submit_phase_id == 'submit_prb1':
            raw = brand['prb1SubmitIso']
        elif submit_phase_id == 'submit_prb2':
            raw = brand['prb2SubmitIso']
        else:
            raw_o = brand.get('prb3SubmitIso')
            if raw_o:
                raw = raw_o
            else:
                shift = calendar_days_offset(EMAIL_BASELINE_KICKOFF_ISO, anchor_start_iso)
                baseline_submit = _baseline_row('submit_prb3')['start_date']
                raw = add_calendar_days_utc(baseline_submit, shift)
        return utc_tuesday_of_week_containing(raw)
    shift = calendar_days_offset(EMAIL_BASELINE_KICKOFF_ISO, anchor_start_iso)
    baseline_submit = _baseline_row(submit_phase_id)['start_date']
    shifted = add_calendar_days_utc(baseline_submit, shift)
    return utc_tuesday_of_week_containing(shifted)


def ideal_thursday_for_submit_from_kickoff(
    anchor_start_iso: str,
    submit_phase_id: Literal['submit_prb1', 'submit_prb2', 'submit_prb3'],
    brand: PrbBrandConfig,
) -> str:
    if brand['mode'] == 'explicit_submits':
        if submit_phase_id == 'submit_prb1':
            raw = brand['prb1SubmitIso']
        elif submit_phase_id == 'submit_prb2':
            raw = brand['prb2SubmitIso']
        else:
            raw_o = brand.get('prb3SubmitIso')
            if raw_o:
                raw = raw_o
            else:
                shift = calendar_days_offset(EMAIL_BASELINE_KICKOFF_ISO, anchor_start_iso)
                baseline_submit = _baseline_row('submit_prb3')['start_date']
                raw = add_calendar_days_utc(baseline_submit, shift)
        return utc_thursday_of_week_containing(raw)
    shift = calendar_days_offset(EMAIL_BASELINE_KICKOFF_ISO, anchor_start_iso)
    baseline_submit = _baseline_row(submit_phase_id)['start_date']
    shifted = add_calendar_days_utc(baseline_submit, shift)
    return utc_thursday_of_week_containing(shifted)


def _step_allow(
    phase_allows: bool,
    iso: str,
    holidays: HolidaySet,
    needs_flag_from_resolver: bool,
) -> bool:
    if not phase_allows:
        return False
    if needs_flag_from_resolver:
        return True
    return not is_working_day(iso, holidays)


def resolve_email_mon_wed_prb_rows(
    anchor_start_iso: str,
    holidays: HolidaySet,
    phase_allow_non_working_days: dict[str, bool] | None,
    brand: PrbBrandConfig,
) -> MonWedPrbResolved:
    def allow(pid: str) -> bool:
        return bool(phase_allow_non_working_days and phase_allow_non_working_days.get(pid))

    if brand['mode'] == 'explicit_submits':
        ideal_mon1 = ideal_monday_for_submit_from_kickoff(anchor_start_iso, 'submit_prb1', brand)
        s1 = resolve_prb_anchor_day(ideal_mon1, holidays, allow('submit_prb1'))
        ideal_wed1 = second_working_wednesday_after_monday_submit(str(s1['iso']), holidays)
        r1 = resolve_prb_anchor_day(ideal_wed1, holidays, allow('prb1_review'))

        ideal_mon2 = ideal_monday_for_submit_from_kickoff(anchor_start_iso, 'submit_prb2', brand)
        s2 = resolve_prb_anchor_day(ideal_mon2, holidays, allow('submit_prb2'))
        ideal_wed2 = second_working_wednesday_after_monday_submit(str(s2['iso']), holidays)
        r2 = resolve_prb_anchor_day(ideal_wed2, holidays, allow('prb2_review'))

        ideal_mon3 = ideal_monday_for_submit_from_kickoff(anchor_start_iso, 'submit_prb3', brand)
        s3 = resolve_prb_anchor_day(ideal_mon3, holidays, allow('submit_prb3'))
        ideal_wed3 = second_working_wednesday_after_monday_submit(str(s3['iso']), holidays)
        r3 = resolve_prb_anchor_day(ideal_wed3, holidays, allow('prb3_review'))

        return {
            'submit_prb1': {
                'start': str(s1['iso']),
                'end': str(s1['iso']),
                'allowNonWorking': _step_allow(
                    allow('submit_prb1'), str(s1['iso']), holidays, bool(s1['needsAllowNonWorkingFlag'])
                ),
            },
            'prb1_review': {
                'start': str(r1['iso']),
                'end': str(r1['iso']),
                'allowNonWorking': _step_allow(
                    allow('prb1_review'), str(r1['iso']), holidays, bool(r1['needsAllowNonWorkingFlag'])
                ),
            },
            'submit_prb2': {
                'start': str(s2['iso']),
                'end': str(s2['iso']),
                'allowNonWorking': _step_allow(
                    allow('submit_prb2'), str(s2['iso']), holidays, bool(s2['needsAllowNonWorkingFlag'])
                ),
            },
            'prb2_review': {
                'start': str(r2['iso']),
                'end': str(r2['iso']),
                'allowNonWorking': _step_allow(
                    allow('prb2_review'), str(r2['iso']), holidays, bool(r2['needsAllowNonWorkingFlag'])
                ),
            },
            'submit_prb3': {
                'start': str(s3['iso']),
                'end': str(s3['iso']),
                'allowNonWorking': _step_allow(
                    allow('submit_prb3'), str(s3['iso']), holidays, bool(s3['needsAllowNonWorkingFlag'])
                ),
            },
            'prb3_review': {
                'start': str(r3['iso']),
                'end': str(r3['iso']),
                'allowNonWorking': _step_allow(
                    allow('prb3_review'), str(r3['iso']), holidays, bool(r3['needsAllowNonWorkingFlag'])
                ),
            },
        }

    cursor_cal = anchor_start_iso
    min1 = next_working_day(cursor_cal, holidays)
    mon_raw1 = first_working_monday_on_or_after(min1, holidays)
    s1 = resolve_prb_anchor_day(mon_raw1, holidays, allow('submit_prb1'))
    ideal_wed1 = second_working_wednesday_after_monday_submit(str(s1['iso']), holidays)
    r1 = resolve_prb_anchor_day(ideal_wed1, holidays, allow('prb1_review'))
    cursor_cal = add_calendar_days_utc(str(r1['iso']), 1)

    min2 = next_working_day(cursor_cal, holidays)
    mon_raw2 = first_working_monday_on_or_after(min2, holidays)
    s2 = resolve_prb_anchor_day(mon_raw2, holidays, allow('submit_prb2'))
    ideal_wed2 = second_working_wednesday_after_monday_submit(str(s2['iso']), holidays)
    r2 = resolve_prb_anchor_day(ideal_wed2, holidays, allow('prb2_review'))
    cursor_cal = add_calendar_days_utc(str(r2['iso']), 1)

    min3 = next_working_day(cursor_cal, holidays)
    mon_raw3 = first_working_monday_on_or_after(min3, holidays)
    s3 = resolve_prb_anchor_day(mon_raw3, holidays, allow('submit_prb3'))
    ideal_wed3 = second_working_wednesday_after_monday_submit(str(s3['iso']), holidays)
    r3 = resolve_prb_anchor_day(ideal_wed3, holidays, allow('prb3_review'))

    return {
        'submit_prb1': {
            'start': str(s1['iso']),
            'end': str(s1['iso']),
            'allowNonWorking': _step_allow(
                allow('submit_prb1'), str(s1['iso']), holidays, bool(s1['needsAllowNonWorkingFlag'])
            ),
        },
        'prb1_review': {
            'start': str(r1['iso']),
            'end': str(r1['iso']),
            'allowNonWorking': _step_allow(
                allow('prb1_review'), str(r1['iso']), holidays, bool(r1['needsAllowNonWorkingFlag'])
            ),
        },
        'submit_prb2': {
            'start': str(s2['iso']),
            'end': str(s2['iso']),
            'allowNonWorking': _step_allow(
                allow('submit_prb2'), str(s2['iso']), holidays, bool(s2['needsAllowNonWorkingFlag'])
            ),
        },
        'prb2_review': {
            'start': str(r2['iso']),
            'end': str(r2['iso']),
            'allowNonWorking': _step_allow(
                allow('prb2_review'), str(r2['iso']), holidays, bool(r2['needsAllowNonWorkingFlag'])
            ),
        },
        'submit_prb3': {
            'start': str(s3['iso']),
            'end': str(s3['iso']),
            'allowNonWorking': _step_allow(
                allow('submit_prb3'), str(s3['iso']), holidays, bool(s3['needsAllowNonWorkingFlag'])
            ),
        },
        'prb3_review': {
            'start': str(r3['iso']),
            'end': str(r3['iso']),
            'allowNonWorking': _step_allow(
                allow('prb3_review'), str(r3['iso']), holidays, bool(r3['needsAllowNonWorkingFlag'])
            ),
        },
    }

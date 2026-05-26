"""Parity tests for worker.scenario_engine — mirrors apps/web-dashboard/lib/scenarioPlanner/*.test.ts."""

from __future__ import annotations

import json
import re
import unittest
from pathlib import Path

from worker.scenario_engine.complexity import filter_scenario_steps_for_prb_rounds, prb_rounds_for_complexity
from worker.scenario_engine.compute_scenario_steps import compute_scenario_steps
from worker.scenario_engine.email_baseline import EMAIL_BASELINE_KICKOFF_ISO
from worker.scenario_engine.find_latest_kickoff import find_latest_kickoff_for_deadline
from worker.scenario_engine.phase_catalog import PHASE_CATALOG
from worker.scenario_engine.linear_scenario import get_scenario_steps_ordered
from worker.scenario_engine.timing_profiles import happyguy_mlr_spine_weekday
from worker.scenario_engine.date_calendar import add_calendar_days_utc
from worker.scenario_engine.prb_weekday_anchors import (
    PRB1_SUBMIT_TO_REVIEW_CALENDAR_DELTA,
    PRB2_SUBMIT_TO_REVIEW_CALENDAR_DELTA,
    PRB3_SUBMIT_TO_REVIEW_CALENDAR_DELTA,
    count_consecutive_working_days_before,
    first_working_thursday_on_or_after,
    first_working_tuesday_on_or_after,
    max_iso_date,
    neutral_shifted_submit_start_from_kickoff,
    pick_happy_guy_submit_anchor_weekday,
    resolve_email_mon_wed_prb_rows,
    resolve_happy_guy_prb_review_start,
    resolve_prb_anchor_day,
    shift_happy_guy_client_share_approval_if_overloaded_tuesday,
    utc_monday_of_week_containing,
)
from worker.scenario_engine.working_days import (
    add_working_days_utc,
    inclusive_working_day_span,
    is_working_day,
    next_working_day,
    previous_working_day_on_or_before,
)
from worker.scenario_planning import run_scenario_engine_compute

_APPS_ROOT = Path(__file__).resolve().parents[2]


def _all_calendar() -> dict[str, bool]:
    return {p['phase_id']: True for p in PHASE_CATALOG}


def _medium_step_count() -> int:
    return len(
        filter_scenario_steps_for_prb_rounds(get_scenario_steps_ordered(), prb_rounds_for_complexity('medium'))
    )


def _breakdown_index_for(steps_breakdown: list, phase_id: str) -> int:
    for i, row in enumerate(steps_breakdown):
        if row['phase_id'] == phase_id:
            return i
    raise AssertionError(f'missing phase {phase_id}')


class TestPhaseCatalogSync(unittest.TestCase):
    def test_phase_ids_match_timeline_phase_catalog_py(self) -> None:
        py_path = _APPS_ROOT / 'ingestion-worker' / 'ingestion' / 'timeline_phase_catalog.py'
        self.assertTrue(py_path.is_file(), f'missing {py_path}')
        text = py_path.read_text(encoding='utf-8')
        start = text.find('PHASE_ROWS: list[PhaseDef] = [')
        self.assertGreater(start, -1)
        block = text[start:]
        end_idx = block.find('\n]\n\n')
        self.assertGreater(end_idx, -1)
        block = block[:end_idx]
        ids = re.findall(r"'phase_id':\s*'([^']+)'", block)
        self.assertEqual(len(ids), len(PHASE_CATALOG))
        self.assertEqual(ids, [p['phase_id'] for p in PHASE_CATALOG])


class TestWorkingDays(unittest.TestCase):
    def setUp(self) -> None:
        self.h = frozenset({'2026-03-09'})

    def test_is_working_day(self) -> None:
        self.assertTrue(is_working_day('2026-03-06', self.h))
        self.assertFalse(is_working_day('2026-03-07', self.h))
        self.assertFalse(is_working_day('2026-03-08', self.h))
        self.assertFalse(is_working_day('2026-03-09', self.h))
        self.assertTrue(is_working_day('2026-03-10', self.h))

    def test_next_working_day(self) -> None:
        self.assertEqual(next_working_day('2026-03-06', self.h), '2026-03-06')
        self.assertEqual(next_working_day('2026-03-07', self.h), '2026-03-10')
        self.assertEqual(next_working_day('2026-03-09', self.h), '2026-03-10')

    def test_add_working_days(self) -> None:
        self.assertEqual(add_working_days_utc('2026-03-06', 0, self.h), '2026-03-06')
        self.assertEqual(add_working_days_utc('2026-03-06', 1, self.h), '2026-03-10')

    def test_inclusive_span(self) -> None:
        self.assertEqual(inclusive_working_day_span('2026-03-06', '2026-03-06', self.h), 1)
        self.assertEqual(inclusive_working_day_span('2026-03-06', '2026-03-10', self.h), 2)
        self.assertEqual(inclusive_working_day_span('2026-03-10', '2026-03-06', self.h), 0)

    def test_add_negative_raises(self) -> None:
        with self.assertRaises(ValueError):
            add_working_days_utc('2026-03-06', -1, self.h)

    def test_previous_working(self) -> None:
        self.assertEqual(previous_working_day_on_or_before('2026-03-06', self.h), '2026-03-06')
        self.assertEqual(previous_working_day_on_or_before('2026-03-10', self.h), '2026-03-10')
        self.assertEqual(previous_working_day_on_or_before('2026-03-08', self.h), '2026-03-06')
        self.assertEqual(previous_working_day_on_or_before('2026-03-09', self.h), '2026-03-06')


class TestPrbWeekdayAnchors(unittest.TestCase):
    def test_deltas(self) -> None:
        self.assertEqual(PRB1_SUBMIT_TO_REVIEW_CALENDAR_DELTA, 9)
        self.assertEqual(PRB2_SUBMIT_TO_REVIEW_CALENDAR_DELTA, 9)
        self.assertEqual(PRB3_SUBMIT_TO_REVIEW_CALENDAR_DELTA, 9)

    def test_utc_monday(self) -> None:
        self.assertEqual(utc_monday_of_week_containing('2026-04-14'), '2026-04-13')
        self.assertEqual(utc_monday_of_week_containing('2026-04-13'), '2026-04-13')
        self.assertEqual(utc_monday_of_week_containing('2026-04-12'), '2026-04-06')

    def test_resolve_prb_anchor_day(self) -> None:
        hol = frozenset()
        self.assertEqual(
            resolve_prb_anchor_day('2026-04-13', hol, False),
            {'iso': '2026-04-13', 'needsAllowNonWorkingFlag': False},
        )
        hol2 = frozenset({'2026-04-13'})
        self.assertEqual(
            resolve_prb_anchor_day('2026-04-13', hol2, False),
            {'iso': '2026-04-10', 'needsAllowNonWorkingFlag': False},
        )
        self.assertEqual(
            resolve_prb_anchor_day('2026-04-13', hol2, True),
            {'iso': '2026-04-12', 'needsAllowNonWorkingFlag': True},
        )

    def test_resolve_happy_guy_prb_review_start_forward_weekday(self) -> None:
        hol = frozenset({'2026-05-05'})
        self.assertEqual(
            resolve_prb_anchor_day('2026-05-05', hol, False),
            {'iso': '2026-05-04', 'needsAllowNonWorkingFlag': False},
        )
        self.assertEqual(
            resolve_happy_guy_prb_review_start('2026-05-05', 'tuesday', hol, False),
            {'iso': '2026-05-12', 'needsAllowNonWorkingFlag': False},
        )
        hol_thu = frozenset({'2026-05-07'})
        self.assertEqual(
            resolve_happy_guy_prb_review_start('2026-05-07', 'thursday', hol_thu, False),
            {'iso': '2026-05-14', 'needsAllowNonWorkingFlag': False},
        )

    def test_pick_happy_guy_submit_anchor_weekday(self) -> None:
        hol = frozenset()
        self.assertEqual(pick_happy_guy_submit_anchor_weekday('2026-06-08', hol), 'tuesday')
        self.assertEqual(pick_happy_guy_submit_anchor_weekday('2026-06-10', hol), 'thursday')

    def test_neutral_shifted_submit_start_from_kickoff(self) -> None:
        iso = neutral_shifted_submit_start_from_kickoff(
            '2026-03-02', 'submit_prb1', {'mode': 'from_shifted_baseline'}
        )
        self.assertGreaterEqual(iso, '2026-04-01')

    def test_resolve_email_mon_wed_rows(self) -> None:
        hol = frozenset()
        r = resolve_email_mon_wed_prb_rows(EMAIL_BASELINE_KICKOFF_ISO, hol, {}, {'mode': 'from_shifted_baseline'})
        self.assertEqual(r['submit_prb1']['start'], '2026-03-02')
        self.assertEqual(r['prb1_review']['start'], '2026-03-11')
        self.assertFalse(r['submit_prb1']['allowNonWorking'])

        hol2 = frozenset({'2026-03-02'})
        off = resolve_email_mon_wed_prb_rows(EMAIL_BASELINE_KICKOFF_ISO, hol2, {}, {'mode': 'from_shifted_baseline'})
        self.assertEqual(off['submit_prb1']['start'], '2026-03-09')
        on = resolve_email_mon_wed_prb_rows(
            EMAIL_BASELINE_KICKOFF_ISO, hol2, {'submit_prb1': True}, {'mode': 'from_shifted_baseline'}
        )
        self.assertEqual(on['submit_prb1']['start'], '2026-03-09')
        self.assertFalse(on['submit_prb1']['allowNonWorking'])

        hol3 = frozenset({'2026-03-11'})
        r2 = resolve_email_mon_wed_prb_rows(EMAIL_BASELINE_KICKOFF_ISO, hol3, {}, {'mode': 'from_shifted_baseline'})
        self.assertEqual(r2['prb1_review']['start'], '2026-03-18')

        r3 = resolve_email_mon_wed_prb_rows(
            '2026-01-01',
            hol,
            {},
            {
                'mode': 'explicit_submits',
                'prb1SubmitIso': '2026-07-06',
                'prb2SubmitIso': '2026-08-03',
                'prb3SubmitIso': '2026-09-07',
            },
        )
        self.assertEqual(r3['submit_prb1']['start'], '2026-07-06')
        self.assertEqual(r3['prb1_review']['start'], '2026-07-15')
        self.assertEqual(r3['submit_prb2']['start'], '2026-08-03')
        self.assertEqual(r3['prb2_review']['start'], '2026-08-12')
        self.assertEqual(r3['submit_prb3']['start'], '2026-09-07')
        self.assertEqual(r3['prb3_review']['start'], '2026-09-16')


class TestComputeScenarioSteps(unittest.TestCase):
    @staticmethod
    def _utc_weekday_sun0(iso: str) -> int:
        from datetime import date

        y, m, d = (int(x) for x in iso.split('-'))
        return (date(y, m, d).weekday() + 1) % 7

    def test_linear_breakdown_aligned(self) -> None:
        r = compute_scenario_steps({'tactic': 'generic_tactic', 'anchorStartIso': '2026-03-02', 'holidays': frozenset()})
        self.assertTrue(r['ok'])
        assert r['ok'] is True
        n = _medium_step_count()
        self.assertEqual(len(r['steps']), n)
        self.assertEqual(len(r['breakdown']), n)
        ordered = filter_scenario_steps_for_prb_rounds(
            get_scenario_steps_ordered(), prb_rounds_for_complexity('medium')
        )
        for i, row in enumerate(ordered):
            self.assertEqual(r['breakdown'][i]['phase_id'], row['id'])

    def test_suffix_recompute_preserves_prefix_and_shifts_following(self) -> None:
        base = compute_scenario_steps(
            {'tactic': 'generic_tactic', 'anchorStartIso': '2026-03-02', 'holidays': frozenset()}
        )
        self.assertTrue(base['ok'])
        assert base['ok'] is True
        steps = base['steps']
        n = len(steps)
        idx = min(8, n - 3)
        prefix = [{**s} for s in steps[: idx + 1]]
        prefix[idx] = {**prefix[idx], 'end_date': add_calendar_days_utc(prefix[idx]['end_date'], 3)}
        r = compute_scenario_steps(
            {
                'tactic': 'generic_tactic',
                'anchorStartIso': '2026-03-02',
                'holidays': frozenset(),
                'freezeAfterStepIndex': idx,
                'pinnedPrefixSteps': prefix,
            }
        )
        self.assertTrue(r['ok'])
        assert r['ok'] is True
        for i in range(idx + 1):
            self.assertEqual(r['steps'][i], prefix[i])
        self.assertNotEqual(
            r['steps'][idx + 1]['start_date'], base['steps'][idx + 1]['start_date']
        )

    def test_happyguy_pinned_submit_prb1_review_uses_ref_iso_anchor_not_pin_start(self) -> None:
        hol: frozenset[str] = frozenset()
        base = compute_scenario_steps(
            {'timingProfile': 'happyguy_submit_tuesday', 'anchorStartIso': '2026-03-02', 'holidays': hol}
        )
        self.assertTrue(base['ok'])
        assert base['ok'] is True
        steps = base['steps']
        bd = base['breakdown']
        i_submit = _breakdown_index_for(bd, 'submit_prb1')
        self.assertEqual(pick_happy_guy_submit_anchor_weekday('2026-06-10', hol), 'thursday')
        prefix = [{**s} for s in steps[: i_submit + 1]]
        prefix[i_submit] = {**prefix[i_submit], 'start_date': '2026-06-10', 'end_date': '2026-06-10'}
        prev_end = prefix[i_submit - 1]['end_date']
        min_start = next_working_day(add_calendar_days_utc(prev_end, 1), hol)
        brand = {'mode': 'from_shifted_baseline'}
        ref_iso = max_iso_date(
            min_start, neutral_shifted_submit_start_from_kickoff('2026-03-02', 'submit_prb1', brand)
        )
        anchor_wd = pick_happy_guy_submit_anchor_weekday(ref_iso, hol)
        r = compute_scenario_steps(
            {
                'timingProfile': 'happyguy_submit_tuesday',
                'anchorStartIso': '2026-03-02',
                'holidays': hol,
                'freezeAfterStepIndex': i_submit,
                'pinnedPrefixSteps': prefix,
            }
        )
        self.assertTrue(r['ok'])
        assert r['ok'] is True
        i_rev = _breakdown_index_for(r['breakdown'], 'prb1_review')
        expected_wd = 2 if anchor_wd == 'tuesday' else 4
        self.assertEqual(self._utc_weekday_sun0(r['steps'][i_rev]['start_date']), expected_wd)

    def test_happyguy_submit_profiles_identical_prb1(self) -> None:
        a = compute_scenario_steps(
            {'timingProfile': 'happyguy_submit_tuesday', 'anchorStartIso': '2026-03-02', 'holidays': frozenset()}
        )
        b = compute_scenario_steps(
            {'timingProfile': 'happyguy_submit_thursday', 'anchorStartIso': '2026-03-02', 'holidays': frozenset()}
        )
        self.assertTrue(a['ok'] and b['ok'])
        assert a['ok'] and b['ok']
        i_s = _breakdown_index_for(a['breakdown'], 'submit_prb1')
        i_r = _breakdown_index_for(a['breakdown'], 'prb1_review')
        self.assertEqual(a['steps'][i_s], b['steps'][i_s])
        self.assertEqual(a['steps'][i_r], b['steps'][i_r])

    def test_happyguy_mlr_spine_weekday(self) -> None:
        self.assertEqual(happyguy_mlr_spine_weekday('happyguy_submit_tuesday'), 'tuesday')
        self.assertEqual(happyguy_mlr_spine_weekday('happyguy_submit_thursday'), 'thursday')
        self.assertEqual(happyguy_mlr_spine_weekday('happyguy_mad_healthgrades_360_email'), 'thursday')
        self.assertEqual(happyguy_mlr_spine_weekday('generic_tactic'), 'thursday')

    def test_happyguy_mad_healthgrades_same_prb1_as_baseline_thursday(self) -> None:
        base = compute_scenario_steps(
            {'timingProfile': 'happyguy_submit_thursday', 'anchorStartIso': '2026-03-02', 'holidays': frozenset()}
        )
        mad = compute_scenario_steps(
            {
                'timingProfile': 'happyguy_mad_healthgrades_360_email',
                'anchorStartIso': '2026-03-02',
                'holidays': frozenset(),
            }
        )
        self.assertTrue(base['ok'] and mad['ok'])
        assert base['ok'] and mad['ok']
        i_s = _breakdown_index_for(base['breakdown'], 'submit_prb1')
        i_r = _breakdown_index_for(base['breakdown'], 'prb1_review')
        self.assertEqual(mad['steps'][i_s], base['steps'][i_s])
        self.assertEqual(mad['steps'][i_r], base['steps'][i_r])
        self.assertEqual(len(mad.get('opdp_binder_steps') or []), 7)

    def test_happyguy_mad_patient_profiles_tll_no_opdp_binder(self) -> None:
        r = compute_scenario_steps(
            {
                'timingProfile': 'happyguy_mad_patient_profiles_tll',
                'anchorStartIso': '2026-03-02',
                'holidays': frozenset(),
            }
        )
        self.assertTrue(r['ok'])
        assert r['ok'] is True
        self.assertIsNone(r.get('opdp_binder_steps'))

    def test_happyguy_mad_healthgrades_prep_assets_scaled_gt_liver(self) -> None:
        hg = compute_scenario_steps(
            {
                'timingProfile': 'happyguy_mad_healthgrades_360_email',
                'anchorStartIso': '2026-03-02',
                'holidays': frozenset(),
            }
        )
        liver = compute_scenario_steps(
            {
                'timingProfile': 'happyguy_mad_liver_brochure_training_blueprint',
                'anchorStartIso': '2026-03-02',
                'holidays': frozenset(),
            }
        )
        self.assertTrue(hg['ok'] and liver['ok'])
        assert hg['ok'] and liver['ok']
        i_hg = _breakdown_index_for(hg['breakdown'], 'prep_assets_release')
        i_lv = _breakdown_index_for(liver['breakdown'], 'prep_assets_release')
        self.assertGreater(hg['breakdown'][i_hg]['scaled_days'], liver['breakdown'][i_lv]['scaled_days'])

    def test_get_scenario_steps_ordered_mad_profiles_use_happyguy_spine(self) -> None:
        omit = frozenset({'development_prb1', 'development_prb2', 'development_prb3'})
        filtered = [r for r in PHASE_CATALOG if r['phase_id'] not in omit]
        for pid in (
            'happyguy_mad_healthgrades_360_email',
            'happyguy_mad_patient_profiles_tll',
            'happyguy_mad_liver_brochure_training_blueprint',
        ):
            steps = get_scenario_steps_ordered(pid)
            self.assertEqual(len(steps), len(filtered))
            for i, cat in enumerate(filtered):
                self.assertEqual(steps[i]['id'], cat['phase_id'])
                self.assertEqual(steps[i]['label'], cat['label'])

    def test_happyguy_prb_review_snaps_forward_across_holiday_ideal(self) -> None:
        base = compute_scenario_steps(
            {
                'timingProfile': 'happyguy_submit_tuesday',
                'anchorStartIso': '2026-03-02',
                'holidays': frozenset(),
            }
        )
        self.assertTrue(base['ok'])
        assert base['ok'] is True
        i_s = _breakdown_index_for(base['breakdown'], 'submit_prb1')
        submit_start = base['steps'][i_s]['start_date']
        ideal_review = add_calendar_days_utc(submit_start, 7)
        r = compute_scenario_steps(
            {
                'timingProfile': 'happyguy_submit_tuesday',
                'anchorStartIso': '2026-03-02',
                'holidays': frozenset({ideal_review}),
            }
        )
        self.assertTrue(r['ok'])
        assert r['ok'] is True
        i_r = _breakdown_index_for(r['breakdown'], 'prb1_review')
        self.assertEqual(
            self._utc_weekday_sun0(r['steps'][i_r]['start_date']),
            self._utc_weekday_sun0(submit_start),
        )
        self.assertGreaterEqual(r['steps'][i_r]['start_date'], ideal_review)

        base_thu = compute_scenario_steps(
            {
                'timingProfile': 'happyguy_submit_thursday',
                'anchorStartIso': '2026-03-02',
                'holidays': frozenset(),
            }
        )
        self.assertTrue(base_thu['ok'])
        assert base_thu['ok'] is True
        i_st = _breakdown_index_for(base_thu['breakdown'], 'submit_prb1')
        sub_t = base_thu['steps'][i_st]['start_date']
        wd_sub = self._utc_weekday_sun0(sub_t)
        ideal_r2 = add_calendar_days_utc(sub_t, 7)
        r2 = compute_scenario_steps(
            {
                'timingProfile': 'happyguy_submit_thursday',
                'anchorStartIso': '2026-03-02',
                'holidays': frozenset({ideal_r2}),
            }
        )
        self.assertTrue(r2['ok'])
        assert r2['ok'] is True
        i_rt = _breakdown_index_for(r2['breakdown'], 'prb1_review')
        self.assertEqual(self._utc_weekday_sun0(r2['steps'][i_rt]['start_date']), wd_sub)
        self.assertGreaterEqual(r2['steps'][i_rt]['start_date'], ideal_r2)

    def test_happyguy_prb2_submit_proximity_from_cursor_only(self) -> None:
        hol = frozenset()
        r = compute_scenario_steps(
            {'timingProfile': 'happyguy_submit_thursday', 'anchorStartIso': '2026-03-02', 'holidays': hol}
        )
        self.assertTrue(r['ok'])
        assert r['ok'] is True
        i_sub2 = _breakdown_index_for(r['breakdown'], 'submit_prb2')
        prev_end = r['steps'][i_sub2 - 1]['end_date']
        min_start = next_working_day(add_calendar_days_utc(prev_end, 1), hol)
        anchor_wd = pick_happy_guy_submit_anchor_weekday(min_start, hol)
        raw = (
            first_working_tuesday_on_or_after(min_start, hol)
            if anchor_wd == 'tuesday'
            else first_working_thursday_on_or_after(min_start, hol)
        )
        resolved = resolve_prb_anchor_day(raw, hol, False)
        self.assertEqual(r['steps'][i_sub2]['start_date'], str(resolved['iso']))

    def test_happyguy_client_share_streak_helpers(self) -> None:
        hol = frozenset()
        self.assertEqual(count_consecutive_working_days_before('2026-06-16', hol), 6)
        ns, ne = shift_happy_guy_client_share_approval_if_overloaded_tuesday('2026-06-16', '2026-06-16', hol)
        self.assertEqual(ns, '2026-06-15')
        self.assertEqual(ne, '2026-06-15')
        hol2 = frozenset({'2026-06-01'})
        self.assertLessEqual(count_consecutive_working_days_before('2026-06-02', hol2), 4)
        a, b = shift_happy_guy_client_share_approval_if_overloaded_tuesday('2026-06-02', '2026-06-02', hol2)
        self.assertEqual(a, '2026-06-02')

    def test_email_all_calendar_first_anchor(self) -> None:
        r = compute_scenario_steps(
            {'tactic': 'generic_tactic', 'anchorStartIso': '2026-03-02', 'phaseAllowNonWorkingDays': _all_calendar()}
        )
        self.assertTrue(r['ok'])
        assert r['ok'] is True
        self.assertEqual(r['steps'][0]['start_date'], '2026-03-02')
        self.assertTrue(r['steps'][0].get('allow_non_working_days'))

    def test_website_manuscript_scaled_above_email(self) -> None:
        email_r = compute_scenario_steps(
            {'tactic': 'generic_tactic', 'anchorStartIso': '2026-03-02', 'phaseAllowNonWorkingDays': _all_calendar()}
        )
        web_r = compute_scenario_steps(
            {'tactic': 'website', 'anchorStartIso': '2026-03-02', 'phaseAllowNonWorkingDays': _all_calendar()}
        )
        self.assertTrue(email_r['ok'] and web_r['ok'])
        assert email_r['ok'] and web_r['ok']
        idx = _breakdown_index_for(web_r['breakdown'], 'manuscript_development')
        idx_e = _breakdown_index_for(email_r['breakdown'], 'manuscript_development')
        self.assertGreater(web_r['breakdown'][idx]['scaled_days'], email_r['breakdown'][idx_e]['scaled_days'])

    def test_banner_weekend_anchor(self) -> None:
        hol = frozenset()
        r = compute_scenario_steps({'tactic': 'banner', 'anchorStartIso': '2026-01-10', 'holidays': hol})
        self.assertTrue(r['ok'])
        assert r['ok'] is True
        self.assertEqual(r['steps'][0]['start_date'], '2026-01-12')

    def test_per_phase_allow_non_working(self) -> None:
        hol = frozenset()
        r = compute_scenario_steps(
            {
                'tactic': 'banner',
                'anchorStartIso': '2026-01-05',
                'holidays': hol,
                'phaseAllowNonWorkingDays': {'kickoff': True},
            }
        )
        self.assertTrue(r['ok'])
        assert r['ok'] is True
        self.assertEqual(r['steps'][0]['start_date'], '2026-01-05')
        self.assertTrue(r['steps'][0].get('allow_non_working_days'))
        self.assertIsNone(r['steps'][1].get('allow_non_working_days'))

    def test_invalid_anchor(self) -> None:
        r = compute_scenario_steps({'tactic': 'generic_tactic', 'anchorStartIso': 'not-a-date'})
        self.assertFalse(r['ok'])

    def test_steps_end_after_start(self) -> None:
        r = compute_scenario_steps({'tactic': 'banner', 'anchorStartIso': '2026-01-05'})
        self.assertTrue(r['ok'])
        assert r['ok'] is True
        for s in r['steps']:
            self.assertGreaterEqual(s['end_date'], s['start_date'])

    def test_skillarts_tiered_thursday_submit_and_ten_day_span(self) -> None:
        hol = frozenset()
        r = compute_scenario_steps(
            {
                'tactic': 'skillarts_generic',
                'anchorStartIso': '2026-03-02',
                'holidays': hol,
                'pageCount': 30,
            }
        )
        self.assertTrue(r['ok'])
        assert r['ok'] is True
        i_s = _breakdown_index_for(r['breakdown'], 'submit_prb1')
        i_r = _breakdown_index_for(r['breakdown'], 'prb1_review')
        self.assertEqual(r['steps'][i_s]['start_date'], '2026-10-29')
        self.assertEqual(r['steps'][i_r]['start_date'], '2026-11-11')
        self.assertEqual(
            inclusive_working_day_span(r['steps'][i_s]['start_date'], r['steps'][i_r]['start_date'], hol),
            10,
        )

    def test_skillarts_tiered_page_14_three_day_span(self) -> None:
        hol = frozenset()
        r = compute_scenario_steps(
            {
                'tactic': 'skillarts_generic',
                'anchorStartIso': '2026-03-02',
                'holidays': hol,
                'pageCount': 14,
            }
        )
        self.assertTrue(r['ok'])
        assert r['ok'] is True
        i_s = _breakdown_index_for(r['breakdown'], 'submit_prb1')
        i_r = _breakdown_index_for(r['breakdown'], 'prb1_review')
        self.assertEqual(
            inclusive_working_day_span(r['steps'][i_s]['start_date'], r['steps'][i_r]['start_date'], hol),
            3,
        )

    def test_skillarts_holiday_on_ideal_thursday_advances_submit(self) -> None:
        hol = frozenset(['2026-10-29'])
        r = compute_scenario_steps(
            {
                'tactic': 'skillarts_generic',
                'anchorStartIso': '2026-03-02',
                'holidays': hol,
                'pageCount': 30,
            }
        )
        self.assertTrue(r['ok'])
        assert r['ok'] is True
        i_s = _breakdown_index_for(r['breakdown'], 'submit_prb1')
        i_r = _breakdown_index_for(r['breakdown'], 'prb1_review')
        self.assertEqual(r['steps'][i_s]['start_date'], '2026-11-05')
        self.assertEqual(
            inclusive_working_day_span(r['steps'][i_s]['start_date'], r['steps'][i_r]['start_date'], hol),
            10,
        )

    def test_complexity_scales_non_prb(self) -> None:
        hol = frozenset()
        basic = compute_scenario_steps(
            {'tactic': 'website', 'anchorStartIso': '2026-03-02', 'holidays': hol, 'complexity': 'basic'}
        )
        complex_r = compute_scenario_steps(
            {'tactic': 'website', 'anchorStartIso': '2026-03-02', 'holidays': hol, 'complexity': 'complex'}
        )
        self.assertTrue(basic['ok'] and complex_r['ok'])
        assert basic['ok'] and complex_r['ok']
        idx_c = _breakdown_index_for(complex_r['breakdown'], 'manuscript_development')
        idx_b = _breakdown_index_for(basic['breakdown'], 'manuscript_development')
        self.assertGreater(
            inclusive_working_day_span(
                complex_r['steps'][idx_c]['start_date'], complex_r['steps'][idx_c]['end_date'], hol
            ),
            inclusive_working_day_span(
                basic['steps'][idx_b]['start_date'], basic['steps'][idx_b]['end_date'], hol
            ),
        )
        for pid in (
            'submit_prb1',
            'prb1_review',
            'submit_prb2',
            'prb2_review',
            'submit_prb3',
            'prb3_review',
        ):
            ib = next((i for i, b in enumerate(basic['breakdown']) if b['phase_id'] == pid), -1)
            ic = next((i for i, b in enumerate(complex_r['breakdown']) if b['phase_id'] == pid), -1)
            if ib < 0 or ic < 0:
                continue
            self.assertEqual(complex_r['breakdown'][ic]['effective_days'], basic['breakdown'][ib]['effective_days'])
            self.assertEqual(
                inclusive_working_day_span(
                    complex_r['steps'][ic]['start_date'], complex_r['steps'][ic]['end_date'], hol
                ),
                inclusive_working_day_span(basic['steps'][ib]['start_date'], basic['steps'][ib]['end_date'], hol),
            )

    def test_smoke_tactics(self) -> None:
        for tactic in ('video_production', 'animation', 'tradeshow_panel'):
            r = compute_scenario_steps({'tactic': tactic, 'anchorStartIso': '2026-01-05'})  # type: ignore[arg-type]
            self.assertTrue(r['ok'], tactic)
            assert r['ok'] is True
            self.assertEqual(len(r['steps']), _medium_step_count())
            for s in r['steps']:
                self.assertGreaterEqual(s['end_date'], s['start_date'])

    def test_stackable_modifiers(self) -> None:
        r = compute_scenario_steps(
            {
                'tactic': 'generic_tactic',
                'anchorStartIso': '2026-03-02',
                'holidays': frozenset(),
                'activeModifierIds': ['expedited_manuscript', 'extra_client_buffer'],
            }
        )
        self.assertTrue(r['ok'])
        assert r['ok'] is True
        mid = _breakdown_index_for(r['breakdown'], 'manuscript_development')
        cr = _breakdown_index_for(r['breakdown'], 'client_review_1_manuscript')
        self.assertEqual(r['breakdown'][mid]['modifier_deltas'].get('expedited_manuscript'), -2)
        self.assertEqual(r['breakdown'][cr]['modifier_deltas'].get('extra_client_buffer'), 1)

    def test_unknown_modifier(self) -> None:
        r = compute_scenario_steps(
            {
                'tactic': 'generic_tactic',
                'anchorStartIso': '2026-03-02',
                'activeModifierIds': ['not_a_real_modifier'],
            }
        )
        self.assertFalse(r['ok'])

    def test_legacy_email_tactic_alias_matches_generic_tactic(self) -> None:
        canon = compute_scenario_steps(
            {'tactic': 'generic_tactic', 'anchorStartIso': '2026-03-02', 'holidays': frozenset()}
        )
        legacy = compute_scenario_steps(
            {'tactic': 'email', 'anchorStartIso': '2026-03-02', 'holidays': frozenset()}
        )
        self.assertTrue(canon['ok'] and legacy['ok'])
        assert canon['ok'] and legacy['ok']
        self.assertEqual(legacy['steps'], canon['steps'])
        self.assertEqual(legacy['breakdown'], canon['breakdown'])


class TestFixtureGolden(unittest.TestCase):
    def test_email_kickoff_smoke_json(self) -> None:
        path = Path(__file__).resolve().parent / 'fixtures' / 'scenario_engine' / 'email_kickoff_smoke.json'
        data = json.loads(path.read_text(encoding='utf-8'))
        r = run_scenario_engine_compute(data['request'])
        self.assertTrue(r['ok'], r)
        assert r['ok'] is True
        steps = r['steps']
        bd = r['breakdown']
        i_s = _breakdown_index_for(bd, 'submit_prb1')
        self.assertEqual(steps[i_s]['start_date'], data['expectedSubmitPrb1Start'])
        self.assertEqual(steps[-1]['end_date'], data['expectedReleaseEnd'])


class TestFindLatestKickoff(unittest.TestCase):
    def test_recover_kickoff_email_all_cal(self) -> None:
        anchor = '2026-04-01'
        forward = compute_scenario_steps(
            {'tactic': 'generic_tactic', 'anchorStartIso': anchor, 'phaseAllowNonWorkingDays': _all_calendar()}
        )
        self.assertTrue(forward['ok'])
        assert forward['ok'] is True
        last_idx = len(forward['breakdown']) - 1
        milestone_id = forward['breakdown'][last_idx]['phase_id']
        deadline = forward['steps'][last_idx]['end_date']
        rev = find_latest_kickoff_for_deadline(
            {
                'tactic': 'generic_tactic',
                'deadlineIso': deadline,
                'anchorPhaseId': milestone_id,
                'phaseAllowNonWorkingDays': _all_calendar(),
            }
        )
        self.assertTrue(rev['ok'])
        assert rev['ok'] is True
        self.assertEqual(rev['kickoffIso'], anchor)
        self.assertEqual(rev['steps'][last_idx]['end_date'], deadline)
        self.assertEqual(len(rev['breakdown']), len(rev['steps']))

    def test_invalid_deadline(self) -> None:
        r = find_latest_kickoff_for_deadline(
            {'tactic': 'generic_tactic', 'deadlineIso': 'nope', 'anchorPhaseId': 'release_assets_vendors'}
        )
        self.assertFalse(r['ok'])
        assert r['ok'] is False
        self.assertIn('Deadline', r['error'])

    def test_unknown_phase(self) -> None:
        r = find_latest_kickoff_for_deadline(
            {'tactic': 'generic_tactic', 'deadlineIso': '2026-12-31', 'anchorPhaseId': 'not_a_phase'}
        )
        self.assertFalse(r['ok'])

    def test_aggressive_deadline(self) -> None:
        r = find_latest_kickoff_for_deadline(
            {
                'tactic': 'website',
                'deadlineIso': '2026-06-30',
                'anchorPhaseId': 'release_assets_vendors',
                'searchWindowDays': 2,
            }
        )
        self.assertFalse(r['ok'])

    def test_reverse_working_day_plan(self) -> None:
        anchor = '2026-03-02'
        hol = frozenset()
        forward = compute_scenario_steps({'tactic': 'website', 'anchorStartIso': anchor, 'holidays': hol})
        self.assertTrue(forward['ok'])
        assert forward['ok'] is True
        last_idx = len(forward['breakdown']) - 1
        milestone_id = forward['breakdown'][last_idx]['phase_id']
        deadline = forward['steps'][last_idx]['end_date']
        rev = find_latest_kickoff_for_deadline(
            {
                'tactic': 'website',
                'deadlineIso': deadline,
                'anchorPhaseId': milestone_id,
                'holidays': hol,
            }
        )
        self.assertTrue(rev['ok'])
        assert rev['ok'] is True
        self.assertEqual(rev['kickoffIso'], anchor)
        self.assertEqual(rev['steps'][last_idx]['end_date'], deadline)
        self.assertEqual(len(rev['breakdown']), len(rev['steps']))


if __name__ == '__main__':
    unittest.main()

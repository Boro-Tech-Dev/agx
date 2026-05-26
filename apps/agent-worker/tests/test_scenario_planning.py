"""cd apps/agent-worker && PYTHONPATH=. python -m unittest tests.test_scenario_planning -v"""

import unittest

from worker.scenario_planning import (
    build_scenario_injection,
    compute_scenario_snapshot,
    parse_steps_from_csv_text,
    parse_steps_from_json_list,
    parse_timeline_scenario,
)


CSV_MIN = """Task,Start Date,End Date,Note
Kickoff,2026-03-02,2026-03-02,Project kickoff
Manuscript development,2026-03-03,2026-03-13,Develop copy
"""


class TestScenarioPlanning(unittest.TestCase):
    def test_parse_csv_ok(self):
        steps, err = parse_steps_from_csv_text(CSV_MIN)
        self.assertIsNone(err)
        assert steps is not None
        self.assertEqual(len(steps), 2)
        self.assertEqual(steps[0]['task'], 'Kickoff')
        self.assertEqual(steps[0]['start_date'], '2026-03-02')
        self.assertEqual(steps[1]['end_date'], '2026-03-13')

    def test_parse_csv_bad_date(self):
        bad = 'Task,Start Date,End Date\nX,2026-13-01,2026-13-02\n'
        steps, err = parse_steps_from_csv_text(bad)
        self.assertIsNone(steps)
        assert err is not None
        self.assertIn('Start Date', err)

    def test_parse_csv_end_before_start(self):
        bad = 'Task,Start Date,End Date\nX,2026-03-05,2026-03-04\n'
        steps, err = parse_steps_from_csv_text(bad)
        self.assertIsNone(steps)
        assert err is not None
        self.assertIn('on or after', err)

    def test_steps_win_over_csv_text(self):
        steps, err = parse_timeline_scenario(
            {
                'csv_text': 'Task,Start Date,End Date\nOnlyCsv,2026-01-01,2026-01-02\n',
                'steps': [{'task': 'FromJson', 'start_date': '2026-06-01', 'end_date': '2026-06-02', 'note': ''}],
            }
        )
        self.assertIsNone(err)
        assert steps is not None
        self.assertEqual(len(steps), 1)
        self.assertEqual(steps[0]['task'], 'FromJson')

    def test_compute_snapshot(self):
        steps, _ = parse_steps_from_csv_text(CSV_MIN)
        assert steps is not None
        snap = compute_scenario_snapshot(steps)
        self.assertEqual(snap['version'], 2)
        self.assertEqual(snap['calendar_basis'], 'working_days_us')
        self.assertEqual(snap['overall_start_date'], '2026-03-02')
        self.assertEqual(snap['overall_end_date'], '2026-03-13')
        self.assertEqual(snap['step_count'], 2)

    def test_compute_snapshot_calendar_days_when_all_allow(self):
        steps = [
            {'task': 'A', 'start_date': '2026-01-01', 'end_date': '2026-01-02', 'note': '', 'allow_non_working_days': True},
            {'task': 'B', 'start_date': '2026-01-03', 'end_date': '2026-01-04', 'note': '', 'allow_non_working_days': True},
        ]
        snap = compute_scenario_snapshot(steps)
        self.assertEqual(snap['calendar_basis'], 'calendar_days')

    def test_compute_snapshot_mixed(self):
        steps = [
            {'task': 'A', 'start_date': '2026-01-01', 'end_date': '2026-01-02', 'note': ''},
            {'task': 'B', 'start_date': '2026-01-03', 'end_date': '2026-01-04', 'note': '', 'allow_non_working_days': True},
        ]
        snap = compute_scenario_snapshot(steps)
        self.assertEqual(snap['calendar_basis'], 'mixed')

    def test_parse_csv_allow_non_working(self):
        csv = """Task,Start Date,End Date,Allow non working days,Note
X,2026-01-01,2026-01-02,true,note
"""
        steps, err = parse_steps_from_csv_text(csv)
        self.assertIsNone(err)
        assert steps is not None
        self.assertTrue(steps[0].get('allow_non_working_days'))

    def test_parse_json_allow_non_working(self):
        steps, err = parse_steps_from_json_list(
            [{'task': 'Z', 'start_date': '2026-02-01', 'end_date': '2026-02-02', 'note': '', 'allow_non_working_days': True}]
        )
        self.assertIsNone(err)
        assert steps is not None
        self.assertIs(steps[0]['allow_non_working_days'], True)

    def test_build_injection_contains_table_and_tasks(self):
        suffix, snap, err = build_scenario_injection({'scenario': {'csv_text': CSV_MIN}})
        self.assertIsNone(err)
        assert suffix is not None and snap is not None
        self.assertNotIn('error', snap)
        self.assertIn('## Delivery_scenario_facts', suffix)
        self.assertIn('| Kickoff |', suffix)
        self.assertIn('Schedule basis', suffix)
        self.assertIn('Manuscript development', suffix)
        self.assertEqual(snap['version'], 2)

    def test_build_injection_invalid(self):
        suffix, snap, err = build_scenario_injection({'scenario': {'csv_text': 'not,a,csv\n'}})
        self.assertIsNotNone(suffix)
        self.assertIn('Invalid', suffix)
        assert snap is not None
        self.assertIn('error', snap)
        self.assertIsNotNone(err)

    def test_build_injection_none(self):
        self.assertEqual(build_scenario_injection({}), (None, None, None))


if __name__ == '__main__':
    unittest.main()

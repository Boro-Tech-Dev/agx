"""Unit tests for timeline CSV / line parsing."""

from __future__ import annotations

import unittest
from pathlib import Path

from ingestion.timeline_phase_catalog import PHASE_ROWS, phase_by_id
from ingestion.timeline_raw_parse import parse_raw_timeline


class TestPhaseCatalog(unittest.TestCase):
    def test_order_monotonic(self):
        orders = [p['order'] for p in PHASE_ROWS]
        self.assertEqual(orders, list(range(1, len(PHASE_ROWS) + 1)))

    def test_phase_ids_unique(self):
        ids = [p['phase_id'] for p in PHASE_ROWS]
        self.assertEqual(len(ids), len(set(ids)))

    def test_lookup(self):
        self.assertEqual(phase_by_id()['prb1_review']['label'], 'PRB1 Review')


class TestRawParse(unittest.TestCase):
    def test_csv_header_date_task(self):
        text = 'Start,Task\n2026-05-01,Kickoff\n2026-05-10,Internal review\n'
        rows = parse_raw_timeline(text, 'plan.csv')
        self.assertEqual(len(rows), 2)
        self.assertEqual(rows[0]['date_iso'], '2026-05-01')
        self.assertIn('Kickoff', rows[0]['raw_label'])

    def test_csv_positional(self):
        text = '2026-06-01,Submit PRB1\n2026-06-15,PRB1 Review\n'
        rows = parse_raw_timeline(text, 'x.csv')
        self.assertGreaterEqual(len(rows), 1)

    def test_standard_task_start_date_end_date_note(self):
        """Canonical format: Task, Start Date, End Date, Note."""
        text = (
            'Task,Start Date,End Date,Note\n'
            'Kickoff,2026-03-02,2026-03-02,"Hello, team"\n'
            'PRB1 Review,2026-04-22,2026-04-22,\n'
        )
        rows = parse_raw_timeline(text, 'email_timeline.csv')
        self.assertEqual(len(rows), 2)
        self.assertEqual(rows[0]['raw_label'], 'Kickoff')
        self.assertEqual(rows[0]['date_iso'], '2026-03-02')
        self.assertEqual(rows[0]['start_date_iso'], '2026-03-02')
        self.assertEqual(rows[0]['end_date_iso'], '2026-03-02')
        self.assertIn('Hello', rows[0]['timeline_note'])
        self.assertEqual(rows[0]['source_row'].get('format'), 'timeline_csv_standard')
        self.assertEqual(rows[1]['raw_label'], 'PRB1 Review')
        self.assertEqual(rows[1]['date_iso'], '2026-04-22')

    def test_fixture_march_june_2026_sample(self):
        path = Path(__file__).resolve().parent / 'fixtures' / 'email_timeline_march_june_2026.csv'
        text = path.read_text(encoding='utf-8')
        rows = parse_raw_timeline(text, 'email_timeline_march_june_2026.csv')
        self.assertEqual(len(rows), 28)
        self.assertEqual(rows[0]['raw_label'], 'Kickoff')
        self.assertEqual(rows[0]['end_date_iso'], '2026-03-02')
        self.assertTrue(rows[0]['timeline_note'].startswith('Project kickoff'))
        self.assertEqual(rows[-1]['raw_label'], 'Release Assets to vendors.')
        self.assertEqual(rows[-1]['date_iso'], '2026-06-05')


if __name__ == '__main__':
    unittest.main()

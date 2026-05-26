"""Unit tests for PM Update/Cost/Impact backfill (no DB)."""

import unittest

from worker.workflows.pm_user_backfill import backfill_pm_lists_from_user_text


SAMPLE = """Update: client requested 3 more headlines and visual treatments
Cost: 1 senior artist and 1 senior copywriter for 4 hours
Impact: Client advised of cost and three hour delay in getting client approval. Lost time absorbed after hours."""


class TestPmBackfill(unittest.TestCase):
    def test_backfill_populates_from_labeled_lines(self):
        out = {
            'summary': 'Model put everything here only.',
            'tasks': [],
            'risks': [],
            'costs': [],
            'anomalies': [],
            'recommended_next_actions': [],
        }
        self.assertTrue(backfill_pm_lists_from_user_text(out, SAMPLE))
        self.assertEqual(len(out['tasks']), 1)
        self.assertEqual(len(out['costs']), 2)
        self.assertEqual(len(out['risks']), 1)
        self.assertGreaterEqual(len(out['anomalies']), 1)
        titles = {c.get('title') for c in out['costs']}
        self.assertIn('Senior artist', titles)
        self.assertIn('Senior copywriter', titles)

    def test_no_op_when_model_already_filled_tasks(self):
        out = {
            'summary': 'x',
            'tasks': [{'title': 'Already'}],
            'risks': [],
            'costs': [],
            'anomalies': [],
        }
        self.assertFalse(backfill_pm_lists_from_user_text(out, SAMPLE))
        self.assertEqual(len(out['tasks']), 1)

    def test_no_op_without_labels(self):
        out = {'summary': 'no structured labels here', 'tasks': [], 'risks': [], 'costs': [], 'anomalies': []}
        self.assertFalse(backfill_pm_lists_from_user_text(out, 'just free text'))


if __name__ == '__main__':
    unittest.main()

"""Tests for markdown prose → PM structured lists (grammar/schema fallback)."""

import unittest

from worker.workflows.pm_prose_sections import merge_prose_sections_into_pm_if_lists_empty
from worker.workflows.pm_structured_cleanup import attach_parse_warning_if_substantive_summary_empty_core_lists


MARKDOWN_SAMPLE = """Based on the provided user request, I will populate the structured arrays as follows:

**Summary**
* Client wants three new headlines and visual treatments
* Tasks:
\t+ Assign senior copywriter and senior artist for 4 hours
\t+ Send changeorder to client

**Tasks**
* Concrete next steps (research, verify a source, file, schedule time)
\t+ Research potential headline ideas
\t+ Verify sources for visual treatment
\t+ File and prepare visual treatment
\t+ Schedule time with copywriter and artist
* Tasks[]
\t+ Assign senior copywriter
\t+ Assign senior artist

**Risks**
* No risks (although time was absorbed after-hours, this is not a risk)

**Costs**
* Budget: $0 (no budget allocated)
* Contract: 10 hours @ $100/hour = $1,000

**Anomalies**
* One-off scope or delivery surprise: Unplanned rounds with client

**Recommended Next Actions**
* Assign senior copywriter
* Assign senior artist
* Send changeorder to client
"""


class TestPmProseExtract(unittest.TestCase):
    def test_merge_fills_tasks_costs_and_skips_no_risks(self):
        out = {
            'summary': MARKDOWN_SAMPLE,
            'tasks': [],
            'risks': [],
            'costs': [],
            'anomalies': [],
            'recommended_next_actions': [],
        }
        self.assertTrue(merge_prose_sections_into_pm_if_lists_empty(out))
        self.assertGreater(len(out['tasks']), 3)
        self.assertEqual(out['risks'], [])
        self.assertGreaterEqual(len(out['costs']), 1)
        self.assertGreaterEqual(len(out['anomalies']), 1)
        self.assertGreaterEqual(len(out['recommended_next_actions']), 2)

    def test_parse_warning_cleared_when_tasks_populated(self):
        out = {
            'summary': MARKDOWN_SAMPLE,
            'tasks': [],
            'risks': [],
            'costs': [],
            'anomalies': [],
            'recommended_next_actions': [],
        }
        merge_prose_sections_into_pm_if_lists_empty(out)
        attach_parse_warning_if_substantive_summary_empty_core_lists(out)
        self.assertNotIn('parse_warning', out)

    def test_merge_no_op_when_lists_already_have_rows(self):
        out = {
            'summary': MARKDOWN_SAMPLE,
            'tasks': [{'title': 'Existing', 'description': 'x'}],
            'risks': [],
            'costs': [],
            'anomalies': [],
        }
        self.assertFalse(merge_prose_sections_into_pm_if_lists_empty(out))
        self.assertEqual(len(out['tasks']), 1)

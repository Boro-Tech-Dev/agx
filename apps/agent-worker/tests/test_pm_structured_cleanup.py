"""Unit tests for PM structured sanitization and parse_warning (no DB)."""

import unittest

from worker.workflows.pm_structured_cleanup import (
    attach_parse_warning_if_substantive_summary_empty_core_lists,
    clamp_pm_structured_to_schema_caps,
    dedupe_pm_structured_lists,
    collapse_duplicate_em_dash_phrase,
    item_has_substance,
    normalize_pm_dedupe_label,
    normalize_pm_router_payload,
    pm_lists_effectively_empty,
    promote_non_question_open_questions_to_tasks,
    prune_pm_cross_list_duplicates,
    sanitize_pm_duplicate_em_dash_phrases,
    sanitize_pm_placeholder_rows,
)
from worker.workflows.schemas import (
    PM_MAX_ACCEPTANCE_CRITERIA,
    PM_MAX_STRING_LIST,
    PM_MAX_SUMMARY_LENGTH,
    PM_MAX_TASKS,
    PM_MAX_TASK_DEPS,
)
from worker.workflows.pm_user_backfill import backfill_pm_lists_from_user_text

SAMPLE = """Update: client requested 3 more headlines
Cost: 1 senior artist for 4 hours
Impact: Client approval delayed by three hours."""


class TestPmStructuredCleanup(unittest.TestCase):
    def test_normalize_pm_router_payload_empty_dict_gets_summary_from_raw_content(self):
        out = {}
        raw = 'Line one.\nLine two.\n' + 'x' * 90
        normalize_pm_router_payload(out, raw)
        self.assertTrue(len(out['summary']) >= 80)
        self.assertIsInstance(out['tasks'], list)
        self.assertIsInstance(out['reflections'], list)

    def test_normalize_pm_router_payload_preserves_existing_summary(self):
        out = {'summary': 'already here'}
        normalize_pm_router_payload(out, 'ignored unless summary empty')
        self.assertEqual(out['summary'], 'already here')

    def test_item_has_substance_tasks(self):
        self.assertTrue(item_has_substance('tasks', {'title': 'Do X'}))
        self.assertTrue(item_has_substance('tasks', {'description': 'Only desc'}))
        self.assertFalse(item_has_substance('tasks', {}))
        self.assertFalse(item_has_substance('tasks', {'title': ''}))

    def test_item_has_substance_risks(self):
        self.assertTrue(item_has_substance('risks', {'risk': 'Slip'}))
        self.assertFalse(item_has_substance('risks', {}))

    def test_sanitize_strips_placeholders(self):
        out = {
            'tasks': [{}, {'title': 'Keep'}, {}],
            'risks': [{'risk': 'R1'}, {}],
            'costs': [],
            'decisions': [{}],
        }
        self.assertTrue(sanitize_pm_placeholder_rows(out))
        self.assertEqual(out['tasks'], [{'title': 'Keep'}])
        self.assertEqual(out['risks'], [{'risk': 'R1'}])
        self.assertEqual(out['decisions'], [])

    def test_pm_lists_effectively_empty(self):
        self.assertTrue(pm_lists_effectively_empty({'tasks': [{}, {}], 'risks': [], 'costs': [], 'anomalies': []}))
        self.assertFalse(pm_lists_effectively_empty({'tasks': [{'title': 'x'}], 'risks': [], 'costs': [], 'anomalies': []}))

    def test_backfill_runs_after_placeholders_removed(self):
        out = {
            'summary': 'Short',
            'tasks': [{}, {}],
            'risks': [{}],
            'costs': [],
            'anomalies': [],
            'recommended_next_actions': [],
        }
        sanitize_pm_placeholder_rows(out)
        self.assertTrue(pm_lists_effectively_empty(out))
        self.assertTrue(backfill_pm_lists_from_user_text(out, SAMPLE))
        self.assertGreaterEqual(len(out['tasks']), 1)
        self.assertGreaterEqual(len(out['risks']), 1)

    def test_parse_warning_when_summary_long_but_lists_empty(self):
        out = {
            'summary': 'x' * 90,
            'tasks': [],
            'risks': [],
            'decisions': [],
            'costs': [],
            'anomalies': [],
            'recommended_next_actions': [],
            'open_questions': [],
            'assumptions': [],
            'reflections': [],
        }
        attach_parse_warning_if_substantive_summary_empty_core_lists(out)
        self.assertIn('parse_warning', out)
        self.assertIn('tasks', out['parse_warning'].lower() or '')

    def test_parse_warning_skipped_when_decisions_or_actions_present(self):
        long_summary = 'x' * 90
        with_decisions = {
            'summary': long_summary,
            'tasks': [],
            'risks': [],
            'decisions': [{'decision': 'Proceed with client revision'}],
        }
        attach_parse_warning_if_substantive_summary_empty_core_lists(with_decisions)
        self.assertNotIn('parse_warning', with_decisions)

        with_actions = {
            'summary': long_summary,
            'tasks': [],
            'risks': [],
            'recommended_next_actions': ['Ship draft to client'],
        }
        attach_parse_warning_if_substantive_summary_empty_core_lists(with_actions)
        self.assertNotIn('parse_warning', with_actions)

    def test_parse_warning_skipped_for_short_summary(self):
        out = {'summary': 'short', 'tasks': [], 'risks': []}
        attach_parse_warning_if_substantive_summary_empty_core_lists(out)
        self.assertNotIn('parse_warning', out)

    def test_normalize_pm_dedupe_label(self):
        self.assertEqual(normalize_pm_dedupe_label('  Foo   Bar  '), 'foo bar')

    def test_dedupe_tasks_same_title(self):
        t = {'title': 'Assign Senior Copywriter', 'priority': 'medium'}
        out = {'tasks': [t, dict(t), {'title': '  assign senior copywriter  ', 'status': 'open'}]}
        stats = dedupe_pm_structured_lists(out)
        self.assertTrue(stats['changed'])
        self.assertEqual(stats['removed_total'], 2)
        self.assertEqual(len(out['tasks']), 1)

    def test_dedupe_string_lists(self):
        out = {
            'recommended_next_actions': ['Do X', 'Do X', ' do x ', 'Y'],
        }
        stats = dedupe_pm_structured_lists(out)
        self.assertTrue(stats['changed'])
        self.assertEqual(out['recommended_next_actions'], ['Do X', 'Y'])

    def test_dedupe_no_pm_keys_unchanged(self):
        out = {'portfolio_summary': 'x', 'opportunities': []}
        stats = dedupe_pm_structured_lists(out)
        self.assertFalse(stats['changed'])
        self.assertEqual(stats['removed_total'], 0)

    def test_clamp_truncates_summary_and_lists(self):
        out = {
            'summary': 'x' * (PM_MAX_SUMMARY_LENGTH + 50),
            'tasks': [{'title': f'T{i}'} for i in range(PM_MAX_TASKS + 3)],
            'risks': [],
            'recommended_next_actions': ['a'] * (PM_MAX_STRING_LIST + 2),
        }
        stats = clamp_pm_structured_to_schema_caps(out)
        self.assertTrue(stats['changed'])
        self.assertEqual(len(out['summary']), PM_MAX_SUMMARY_LENGTH)
        self.assertEqual(len(out['tasks']), PM_MAX_TASKS)
        self.assertEqual(len(out['recommended_next_actions']), PM_MAX_STRING_LIST)
        self.assertGreater(stats['clamped_total'], 0)

    def test_clamp_task_nested_lists(self):
        out = {
            'tasks': [
                {
                    'title': 't',
                    'dependencies': [f'd{i}' for i in range(PM_MAX_TASK_DEPS + 2)],
                    'acceptance_criteria': ['c'] * (PM_MAX_ACCEPTANCE_CRITERIA + 1),
                }
            ],
        }
        stats = clamp_pm_structured_to_schema_caps(out)
        self.assertTrue(stats['changed'])
        self.assertEqual(len(out['tasks'][0]['dependencies']), PM_MAX_TASK_DEPS)
        self.assertEqual(len(out['tasks'][0]['acceptance_criteria']), PM_MAX_ACCEPTANCE_CRITERIA)

    def test_clamp_idempotent_when_within_caps(self):
        out = {
            'summary': 'short',
            'tasks': [{'title': 'one'}],
            'risks': [{'risk': 'r'}],
            'recommended_next_actions': ['go'],
        }
        stats = clamp_pm_structured_to_schema_caps(out)
        self.assertFalse(stats['changed'])
        self.assertEqual(stats['clamped_total'], 0)

    def test_cross_prune_drops_rna_matching_task_title(self):
        out = {
            'tasks': [{'title': 'Schedule design review'}],
            'recommended_next_actions': [
                'Schedule design review',
                'Unrelated follow-up',
            ],
            'open_questions': [],
        }
        stats = prune_pm_cross_list_duplicates(out)
        self.assertTrue(stats['changed'])
        self.assertEqual(stats['removed_total'], 1)
        self.assertEqual(out['recommended_next_actions'], ['Unrelated follow-up'])

    def test_cross_prune_does_not_strip_open_questions_even_if_task_duplicate(self):
        """Cross-prune only touches recommended_next_actions; keep open_questions intact."""
        out = {
            'tasks': [{'title': 'Assign owner for API timeline'}],
            'recommended_next_actions': [],
            'open_questions': [
                'Assign owner for API timeline',
                'What is the budget cap for Q3?',
            ],
        }
        stats = prune_pm_cross_list_duplicates(out)
        self.assertFalse(stats['changed'])
        self.assertEqual(len(out['open_questions']), 2)

    def test_promote_non_question_open_questions_when_tasks_empty(self):
        out = {
            'tasks': [],
            'open_questions': [
                'What are the requirements?',
                'Assign senior copywriter',
                'Send change order to client',
            ],
        }
        stats = promote_non_question_open_questions_to_tasks(out)
        self.assertTrue(stats['changed'])
        self.assertEqual(stats['promoted'], 2)
        self.assertEqual(out['open_questions'], ['What are the requirements?'])
        self.assertEqual(len(out['tasks']), 2)
        self.assertEqual(out['tasks'][0]['title'], 'Assign senior copywriter')

    def test_promote_skips_when_tasks_already_populated(self):
        out = {
            'tasks': [{'title': 'Existing'}],
            'open_questions': ['Do something'],
        }
        stats = promote_non_question_open_questions_to_tasks(out)
        self.assertFalse(stats['changed'])
        self.assertEqual(len(out['tasks']), 1)

    def test_collapse_duplicate_em_dash_phrase(self):
        s = "I've used placeholders. — I've used placeholders."
        self.assertEqual(collapse_duplicate_em_dash_phrase(s), "I've used placeholders.")

    def test_sanitize_pm_duplicate_em_dash_in_costs(self):
        out = {
            'costs': [
                {
                    'title': 'Note',
                    'description': 'Same line — Same line',
                }
            ],
            'tasks': [],
        }
        stats = sanitize_pm_duplicate_em_dash_phrases(out)
        self.assertTrue(stats['changed'])
        self.assertEqual(out['costs'][0]['description'], 'Same line')

    def test_cross_prune_keeps_similar_but_non_matching_strings(self):
        out = {
            'tasks': [{'title': 'Ship v1 to staging'}],
            'recommended_next_actions': ['Ship v1 to production'],
            'open_questions': [],
        }
        stats = prune_pm_cross_list_duplicates(out)
        self.assertFalse(stats['changed'])
        self.assertEqual(out['recommended_next_actions'], ['Ship v1 to production'])

    def test_cross_prune_first_line_of_multiline_rna(self):
        out = {
            'tasks': [{'title': 'Call client'}],
            'recommended_next_actions': ['Call client\n(extra detail)'],
        }
        stats = prune_pm_cross_list_duplicates(out)
        self.assertTrue(stats['changed'])
        self.assertEqual(out['recommended_next_actions'], [])

    def test_cross_prune_task_description_headline(self):
        long_desc = 'Confirm compliance sign-off with legal before launch'
        out = {
            'tasks': [{'title': 'Prepare launch checklist', 'description': long_desc}],
            'recommended_next_actions': [long_desc],
            'open_questions': [],
        }
        stats = prune_pm_cross_list_duplicates(out)
        self.assertTrue(stats['changed'])
        self.assertEqual(out['recommended_next_actions'], [])

    def test_cross_prune_no_tasks_noop(self):
        out = {'portfolio_summary': 'x', 'opportunities': [], 'recommended_next_actions': ['a']}
        stats = prune_pm_cross_list_duplicates(out)
        self.assertFalse(stats['changed'])
        self.assertEqual(out['recommended_next_actions'], ['a'])

    def test_cross_prune_empty_tasks_noop(self):
        out = {'tasks': [], 'recommended_next_actions': ['Only RNA']}
        stats = prune_pm_cross_list_duplicates(out)
        self.assertFalse(stats['changed'])


if __name__ == '__main__':
    unittest.main()

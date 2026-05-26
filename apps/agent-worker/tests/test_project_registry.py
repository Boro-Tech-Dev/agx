"""cd apps/agent-worker && PYTHONPATH=. python -m unittest tests.test_project_registry -v"""

import json
import unittest

from worker.project_registry_format import (
    REGISTRY_AGENTS,
    format_registry_markdown,
    normalize_focus_id_for_retrieval,
)


class TestProjectRegistry(unittest.TestCase):
    def test_normalize_focus_id(self):
        self.assertIsNone(normalize_focus_id_for_retrieval(None))
        self.assertIsNone(normalize_focus_id_for_retrieval(''))
        self.assertIsNone(normalize_focus_id_for_retrieval('not-a-uuid'))
        u = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'
        self.assertEqual(normalize_focus_id_for_retrieval(u), u)
        self.assertEqual(normalize_focus_id_for_retrieval(f'  {u.upper()}  '), u.lower())

    def test_registry_agents(self):
        self.assertEqual(REGISTRY_AGENTS, {'pm', 'synergy', 'clinic', 'kitt', 'bubs'})

    def test_format_registry_markdown_ordering_and_truncation(self):
        project = {
            'key': 'demo-proj',
            'name': 'Demo',
            'description': 'Scope and owner: Team A',
            'project_type': 'software_delivery',
            'pm_kind': 'business',
            'metadata': {'owner_hint': 'Team A'},
        }
        body_t = json.dumps(
            {
                'start_date_iso': '2026-03-02',
                'end_date_iso': '2026-03-02',
                'timeline_note': 'Kickoff',
                'raw_label': 'Kickoff',
            }
        )
        timeline_rows = [
            {
                'id': 't1',
                'item_type': 'timeline_event',
                'title': 'Later phase',
                'body': body_t,
                'due_date': None,
                'metadata': {'phase_order': '2'},
            },
            {
                'id': 't0',
                'item_type': 'timeline_event',
                'title': 'Kickoff',
                'body': body_t,
                'due_date': None,
                'metadata': {'phase_order': '1'},
            },
        ]
        other = [
            {
                'id': 'q1',
                'item_type': 'risk',
                'title': 'Model offline',
                'body': json.dumps({'risk': 'fallback'}),
                'metadata': {},
            }
        ]
        focus = {
            'id': 'f1',
            'item_type': 'open_question',
            'title': 'Who owns X?',
            'body': json.dumps({'question': 'Who owns X?'}),
        }
        md = format_registry_markdown(project, timeline_rows, other, focus)
        self.assertIn('## Project_registry_facts', md)
        self.assertIn('### Focus_project_item', md)
        self.assertIn('**item_type**', md)
        self.assertIn('open_question', md)
        self.assertIn('### Key_dates_from_uploads', md)
        self.assertIn('Kickoff', md)
        self.assertIn('### Current_project_items', md)
        self.assertIn('Model offline', md)
        # Table rows should mention phase titles from input order as given (SQL orders; here order is Later, Kickoff as passed)
        self.assertLess(md.index('Later phase'), md.index('Kickoff') or len(md))

    def test_format_empty_project(self):
        md = format_registry_markdown(None, [], [], None)
        self.assertIn('## Project_registry_facts', md)


if __name__ == '__main__':
    unittest.main()

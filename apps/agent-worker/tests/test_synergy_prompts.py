"""No DB: Synergy agent wiring (run from repo: cd apps/agent-worker && PYTHONPATH=. python -m unittest tests.test_synergy_prompts -v)."""

import unittest

from worker.workflows.prompts import SYSTEMS, SYSTEM_PM_PERSONAL
from worker.workflows.schemas import PM_SCHEMA_PERSONAL, SCHEMAS


class TestSynergyAgent(unittest.TestCase):
    def test_synergy_system_is_personal(self):
        self.assertIs(SYSTEMS['synergy'], SYSTEM_PM_PERSONAL)
        self.assertIn('personal mode', SYSTEMS['synergy'].lower())
        # Personal-mode Synergy omits ## Project_registry_facts (business/clinic prompts include it).
        self.assertNotIn('project_registry_facts', SYSTEMS['synergy'].lower())

    def test_synergy_schema_is_personal_pm_schema(self):
        self.assertIs(SCHEMAS['synergy'], PM_SCHEMA_PERSONAL)

    def test_synergy_task_items_require_title(self):
        items = PM_SCHEMA_PERSONAL['properties']['tasks']['items']
        self.assertEqual(items.get('required'), ['title'])
        self.assertIn('minLength', items['properties']['title'])


if __name__ == '__main__':
    unittest.main()

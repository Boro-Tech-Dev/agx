"""No DB: Clinic agent wiring (cd apps/agent-worker && PYTHONPATH=. python -m unittest tests.test_clinic_prompts -v)."""

import unittest

from worker.workflows.prompts import SYSTEMS, SYSTEM_CLINIC
from worker.workflows.schemas import CLINIC_SCHEMA, SCHEMAS


class TestClinicAgent(unittest.TestCase):
    def test_clinic_system(self):
        self.assertIs(SYSTEMS['clinic'], SYSTEM_CLINIC)
        self.assertIn('licensed', SYSTEMS['clinic'].lower())
        self.assertIn('not diagnose', SYSTEMS['clinic'].lower())
        self.assertIn('project_registry_facts', SYSTEMS['clinic'].lower())

    def test_clinic_schema_registered(self):
        self.assertIs(SCHEMAS['clinic'], CLINIC_SCHEMA)
        self.assertIn('required', CLINIC_SCHEMA)
        self.assertEqual(
            set(CLINIC_SCHEMA['required']),
            {'summary', 'tasks', 'risks', 'recommended_next_actions'},
        )


if __name__ == '__main__':
    unittest.main()

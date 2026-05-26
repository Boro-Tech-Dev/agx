"""No DB: prompt branching for projects.pm_kind (run from repo: cd apps/agent-worker && PYTHONPATH=. python -m unittest tests.test_pm_prompts -v)."""

import unittest

from worker.workflows.prompts import system_prompt_pm


class TestPmPromptBranch(unittest.TestCase):
    def test_business_default(self):
        s = system_prompt_pm('business').lower()
        self.assertIn('technical project management', s)
        self.assertIn('project_registry_facts', s)
        self.assertIn('update', s)
        self.assertIn('cost', s)
        self.assertIn('impact', s)

    def test_personal_branch(self):
        self.assertIn('personal mode', system_prompt_pm('personal').lower())


if __name__ == '__main__':
    unittest.main()

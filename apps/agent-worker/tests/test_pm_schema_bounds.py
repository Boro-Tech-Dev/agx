"""PM / H.E.L.P.eR JSON schema export includes generation bounds (maxItems, maxLength)."""

import unittest

from worker.workflows import schemas


class TestPmSchemaBounds(unittest.TestCase):
    def test_pm_business_excludes_open_questions_other_schemas_keep_it(self):
        props_b = schemas.PM_SCHEMA_BUSINESS["properties"]
        self.assertNotIn("open_questions", props_b)
        self.assertIn("open_questions", schemas.PM_SCHEMA_PERSONAL["properties"])
        self.assertIn("open_questions", schemas.KITT_SCHEMA_TRIAGE["properties"])
        self.assertIn("open_questions", schemas.CLINIC_SCHEMA["properties"])

    def test_pm_business_tasks_bounded(self):
        tasks = schemas.PM_SCHEMA_BUSINESS["properties"]["tasks"]
        self.assertEqual(tasks["maxItems"], schemas.PM_MAX_TASKS)
        self.assertIn("maxItems", tasks)

    def test_pm_business_summary_max_length(self):
        summary = schemas.PM_SCHEMA_BUSINESS["properties"]["summary"]
        self.assertEqual(summary.get("maxLength"), schemas.PM_MAX_SUMMARY_LENGTH)

    def test_clinic_arrays_bounded(self):
        self.assertEqual(
            schemas.CLINIC_SCHEMA["properties"]["tasks"]["maxItems"],
            schemas.PM_MAX_TASKS,
        )
        self.assertEqual(
            schemas.CLINIC_SCHEMA["properties"]["recommended_next_actions"]["maxItems"],
            schemas.PM_MAX_STRING_LIST,
        )


if __name__ == "__main__":
    unittest.main()

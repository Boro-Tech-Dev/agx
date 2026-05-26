"""Pydantic validation for omnichannel plan payloads."""

import importlib.util
import unittest
from uuid import UUID

HAS_PYDANTIC = importlib.util.find_spec('pydantic') is not None

if HAS_PYDANTIC:
    from pydantic import ValidationError

    from app.schemas.omnichannel_plan import OmnichannelPlanPayload, OmnichannelPlanRow


@unittest.skipUnless(HAS_PYDANTIC, 'pydantic not installed (use project venv / Docker image)')
class TestOmnichannelPlanSchema(unittest.TestCase):
    def test_row_accepts_valid_scenario_tactic(self):
        row = OmnichannelPlanRow(
            id='r1',
            order=0,
            tactic_library_id=UUID('00000000-0000-4000-8000-000000000099'),
            scenario_tactic='generic_tactic',
        )
        self.assertEqual(row.scenario_tactic, 'generic_tactic')

    def test_row_normalizes_legacy_email_alias_to_generic_tactic(self):
        row = OmnichannelPlanRow(
            id='r1',
            order=0,
            tactic_library_id=UUID('00000000-0000-4000-8000-000000000099'),
            scenario_tactic='email',
        )
        self.assertEqual(row.scenario_tactic, 'generic_tactic')

    def test_row_normalizes_legacy_email_linear_alias(self):
        row = OmnichannelPlanRow(
            id='r1',
            order=0,
            tactic_library_id=UUID('00000000-0000-4000-8000-000000000099'),
            timing_profile='email_linear',
        )
        self.assertEqual(row.timing_profile, 'generic_tactic_linear')

    def test_row_accepts_timing_profile(self):
        row = OmnichannelPlanRow(
            id='r1',
            order=0,
            tactic_library_id=UUID('00000000-0000-4000-8000-000000000099'),
            timing_profile='sem_seo',
        )
        self.assertEqual(row.timing_profile, 'sem_seo')

    def test_row_rejects_invalid_scenario_tactic(self):
        with self.assertRaises(ValidationError):
            OmnichannelPlanRow(
                id='r1',
                order=0,
                tactic_library_id=UUID('00000000-0000-4000-8000-000000000099'),
                scenario_tactic='not_a_tactic',
            )

    def test_plan_version_must_be_1(self):
        with self.assertRaises(ValidationError):
            OmnichannelPlanPayload(version=2, project_key='p', rows=[])


if __name__ == '__main__':
    unittest.main()

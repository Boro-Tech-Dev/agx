"""Unit tests for timing profile resolution (no database)."""

import importlib.util
import unittest

HAS_APP = importlib.util.find_spec('app.timing_profile_resolve') is not None

if HAS_APP:
    from app.timing_profile_resolve import enrich_project_row, resolved_timing_profile


@unittest.skipUnless(HAS_APP, 'app package not on path')
class TestTimingProfileResolve(unittest.TestCase):
    def test_project_override_wins(self):
        self.assertEqual(
            resolved_timing_profile('happyguy_submit_tuesday', 'generic_tactic'),
            'happyguy_submit_tuesday',
        )

    def test_falls_back_to_brand(self):
        self.assertEqual(resolved_timing_profile(None, 'skillarts_generic'), 'skillarts_generic')

    def test_unknown_project_profile_falls_back_to_brand(self):
        self.assertEqual(resolved_timing_profile('not_a_profile', 'generic_tactic'), 'generic_tactic')

    def test_unknown_brand_profile_returns_none(self):
        self.assertIsNone(resolved_timing_profile(None, 'not_a_profile'))

    def test_enrich_project_row(self):
        row = enrich_project_row(
            {
                'key': 'p1',
                'timing_profile_id': None,
                'brand_timing_profile_id': 'happyguy_submit_thursday',
            }
        )
        self.assertEqual(row['resolved_timing_profile'], 'happyguy_submit_thursday')


if __name__ == '__main__':
    unittest.main()

"""Tests for document kind normalization."""

import unittest

from app.document_kinds import DOCUMENT_KINDS, normalize_document_kind


class TestDocumentKinds(unittest.TestCase):
    def test_omnichannel_plan_allowed(self):
        self.assertIn('omnichannel_plan', DOCUMENT_KINDS)
        self.assertEqual(normalize_document_kind('omnichannel_plan'), 'omnichannel_plan')
        self.assertEqual(normalize_document_kind('OMNICHANNEL_PLAN'), 'omnichannel_plan')

    def test_veeva_suite_allowed(self):
        self.assertIn('veeva_suite', DOCUMENT_KINDS)
        self.assertEqual(normalize_document_kind('veeva_suite'), 'veeva_suite')
        self.assertEqual(normalize_document_kind('VEEVA_SUITE'), 'veeva_suite')

    def test_unknown_kind_raises(self):
        with self.assertRaises(ValueError):
            normalize_document_kind('not_a_kind')


if __name__ == '__main__':
    unittest.main()

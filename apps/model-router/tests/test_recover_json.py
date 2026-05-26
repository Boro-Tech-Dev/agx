"""Tests for router.main.recover_json."""

import unittest

from router.json_recovery import recover_json


class TestRecoverJson(unittest.TestCase):
    def test_empty_object_is_none(self):
        self.assertIsNone(recover_json('{}'))
        self.assertIsNone(recover_json('  {}  '))

    def test_valid_object_roundtrip(self):
        self.assertEqual(recover_json('{"summary":"a","tasks":[]}')['summary'], 'a')

    def test_fenced_json_block(self):
        body = '```json\n{"ok": true}\n```'
        self.assertEqual(recover_json(body), {'ok': True})

    def test_prefers_largest_embedded_object(self):
        text = 'Intro text {"small": 1} trailing {"big": true, "nested": {"x": 2}} end.'
        got = recover_json(text)
        self.assertEqual(got.get('big'), True)
        self.assertIn('nested', got)

    def test_markdown_without_json_returns_none(self):
        prose = "**Summary**\n* Only bullets\n* No braces\n" * 15
        self.assertIsNone(recover_json(prose))


if __name__ == '__main__':
    unittest.main()

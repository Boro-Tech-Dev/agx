"""Unit tests for brief template bundle validation."""

import unittest

from app.services import brief_template_validate as bts


class TestBriefTemplateValidation(unittest.TestCase):
    def _minimal_skeleton(self):
        return {
            'version': 1,
            'sections': [
                {
                    'id': 'a',
                    'title': 'A',
                    'fields': [{'id': 'f1', 'label': 'F1'}],
                }
            ],
        }

    def test_valid_empty_overrides(self):
        sk = self._minimal_skeleton()
        ov = {'version': 1, 'overrides': {}}
        pr = {'version': 1, 'presets': []}
        errs = bts.validate_brief_bundle(sk, ov, pr, tactic_keys_in_db=None)
        self.assertEqual(errs, [])

    def test_duplicate_field_id(self):
        sk = {
            'version': 1,
            'sections': [
                {'id': 's1', 'title': 'S1', 'fields': [{'id': 'x', 'label': 'X'}]},
                {'id': 's2', 'title': 'S2', 'fields': [{'id': 'x', 'label': 'X2'}]},
            ],
        }
        ov = {'version': 1, 'overrides': {}}
        pr = {'version': 1, 'presets': []}
        errs = bts.validate_brief_bundle(sk, ov, pr, tactic_keys_in_db=None)
        self.assertTrue(any('duplicate field id' in e for e in errs))

    def test_hide_section_unknown(self):
        sk = self._minimal_skeleton()
        ov = {'version': 1, 'overrides': {'t1': {'hideSectionIds': ['nope']}}}
        pr = {'version': 1, 'presets': []}
        errs = bts.validate_brief_bundle(sk, ov, pr, tactic_keys_in_db={'t1'})
        self.assertTrue(any('unknown section' in e for e in errs))

    def test_preset_unknown_field(self):
        sk = self._minimal_skeleton()
        ov = {'version': 1, 'overrides': {}}
        pr = {
            'version': 1,
            'presets': [
                {
                    'id': 'p1',
                    'label': 'P',
                    'tactic_keys': ['t1'],
                    'field_defaults': {'bad': 'v'},
                }
            ],
        }
        errs = bts.validate_brief_bundle(sk, ov, pr, tactic_keys_in_db={'t1'})
        self.assertTrue(any('field_defaults key not in skeleton' in e for e in errs))


if __name__ == '__main__':
    unittest.main()

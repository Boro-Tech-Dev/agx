"""Router output envelope (output['_router']) for run diagnostics."""

import hashlib
import unittest

from worker.workflows.router_output_envelope import attach_router_envelope, router_raw_content_max_chars


class TestRouterEnvelope(unittest.TestCase):
    def test_preview_truncation_and_hash(self):
        body = 'abcdef' * 5000
        routed = {'content': body, 'error': 'schema_parse_failed', 'parse_failed': True, 'model_used': 'm1'}
        out: dict = {'summary': 'x'}
        attach_router_envelope(out, routed, fallback_used=True, loose_unparsed=False)
        r = out.get('_router')
        self.assertIsInstance(r, dict)
        self.assertTrue(r.get('fallback_used'))
        self.assertFalse(r.get('loose_unparsed'))
        self.assertEqual(r.get('error'), 'schema_parse_failed')
        exp = hashlib.sha256(body.encode()).hexdigest()
        self.assertEqual(r.get('raw_content_sha256'), exp)
        max_c = router_raw_content_max_chars()
        self.assertEqual(len(r.get('raw_content_preview') or ''), min(len(body), max_c))
        self.assertEqual(r.get('raw_content_char_len'), len(body))

    def test_empty_routed(self):
        out: dict = {'summary': 'only'}
        attach_router_envelope(out, None, fallback_used=False, loose_unparsed=True)
        r = out['_router']
        self.assertTrue(r.get('loose_unparsed'))
        self.assertEqual(r.get('raw_content_char_len'), 0)

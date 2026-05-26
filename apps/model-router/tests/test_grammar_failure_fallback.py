"""Tests for OLLAMA_GRAMMAR_FAILURE_FALLBACK (/v1/route unstructured retry)."""

import asyncio
import json
import unittest
from unittest.mock import AsyncMock, patch

from router.main import RouteRequest, Message, route


_MINIMAL_PM = {
    'type': 'object',
    'properties': {
        'summary': {'type': 'string'},
        'tasks': {'type': 'array', 'items': {'type': 'object'}},
        'risks': {'type': 'array', 'items': {'type': 'object'}},
        'recommended_next_actions': {'type': 'array', 'items': {'type': 'string'}},
    },
    'required': ['summary', 'tasks', 'risks', 'recommended_next_actions'],
}


def _pm_req() -> RouteRequest:
    return RouteRequest(
        agent='pm',
        task_type='general',
        messages=[Message(role='user', content='hello')],
        schema_=_MINIMAL_PM,
    )


class TestGrammarFailureFallback(unittest.TestCase):
    def test_recovers_after_ollama_500(self):
        async def _run():
            payload = {
                'summary': 'ok',
                'tasks': [],
                'risks': [],
                'recommended_next_actions': [],
            }
            body = json.dumps(payload)
            with patch('router.main.GRAMMAR_FAILURE_FALLBACK', True), patch(
                'router.main.chat_completion', new_callable=AsyncMock
            ) as m:
                m.side_effect = [
                    {
                        'content': '',
                        'raw': None,
                        'error': 'Ollama HTTP 500: boom',
                        'ollama_http_error': True,
                        'ollama_status': 500,
                    },
                    {'content': body, 'raw': {}},
                ]
                r = await route(_pm_req())
                self.assertEqual(r.get('parsed'), payload)
                self.assertTrue(r.get('grammar_failure_fallback_used'))
                self.assertNotIn('error', r)
                self.assertEqual(m.await_count, 2)

        asyncio.run(_run())

    def test_transport_error_triggers_retry(self):
        async def _run():
            payload = {
                'summary': 'ok',
                'tasks': [],
                'risks': [],
                'recommended_next_actions': [],
            }
            body = json.dumps(payload)
            with patch('router.main.GRAMMAR_FAILURE_FALLBACK', True), patch(
                'router.main.chat_completion', new_callable=AsyncMock
            ) as m:
                m.side_effect = [
                    {'content': '', 'raw': None, 'error': 'connection refused'},
                    {'content': body, 'raw': {}},
                ]
                r = await route(_pm_req())
                self.assertEqual(r.get('parsed'), payload)
                self.assertTrue(r.get('grammar_failure_fallback_used'))
                self.assertEqual(m.await_count, 2)

        asyncio.run(_run())

    def test_http_400_no_retry(self):
        async def _run():
            with patch('router.main.GRAMMAR_FAILURE_FALLBACK', True), patch(
                'router.main.chat_completion', new_callable=AsyncMock
            ) as m:
                m.return_value = {
                    'content': '',
                    'raw': None,
                    'error': 'Ollama HTTP 400: bad',
                    'ollama_http_error': True,
                    'ollama_status': 400,
                }
                r = await route(_pm_req())
                self.assertIsNone(r.get('parsed'))
                self.assertIn('error', r)
                self.assertEqual(m.await_count, 1)

        asyncio.run(_run())

    def test_both_attempts_fail_returns_original_error(self):
        async def _run():
            with patch('router.main.GRAMMAR_FAILURE_FALLBACK', True), patch(
                'router.main.chat_completion', new_callable=AsyncMock
            ) as m:
                m.side_effect = [
                    {
                        'content': '',
                        'raw': None,
                        'error': 'Ollama HTTP 500: first',
                        'ollama_http_error': True,
                        'ollama_status': 500,
                    },
                    {'content': '', 'raw': None, 'error': 'Ollama HTTP 503: second'},
                ]
                r = await route(_pm_req())
                self.assertIsNone(r.get('parsed'))
                self.assertEqual(r.get('error'), 'Ollama HTTP 500: first')
                self.assertEqual(m.await_count, 2)

        asyncio.run(_run())

    def test_disabled_skips_retry(self):
        async def _run():
            with (
                patch('router.main.GRAMMAR_FAILURE_FALLBACK', False),
                patch('router.main.chat_completion', new_callable=AsyncMock) as m,
            ):
                m.return_value = {
                    'content': '',
                    'raw': None,
                    'error': 'Ollama HTTP 500: boom',
                    'ollama_http_error': True,
                    'ollama_status': 500,
                }
                r = await route(_pm_req())
                self.assertIsNone(r.get('parsed'))
                self.assertEqual(m.await_count, 1)

        asyncio.run(_run())

    def test_parse_failure_after_retry_sets_error(self):
        async def _run():
            with patch('router.main.GRAMMAR_FAILURE_FALLBACK', True), patch(
                'router.main.chat_completion', new_callable=AsyncMock
            ) as m:
                m.side_effect = [
                    {
                        'content': '',
                        'raw': None,
                        'error': 'Ollama HTTP 500: boom',
                        'ollama_http_error': True,
                        'ollama_status': 500,
                    },
                    {'content': 'not json', 'raw': {}},
                ]
                r = await route(_pm_req())
                self.assertTrue(r.get('grammar_failure_fallback_used'))
                self.assertEqual(r.get('error'), 'schema_parse_failed_after_grammar_fallback')

        asyncio.run(_run())


if __name__ == '__main__':
    unittest.main()

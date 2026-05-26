"""Tests for cumulative /v1/route token fields."""

import asyncio
import json
import unittest
from unittest.mock import AsyncMock, patch

from router.main import Message, RouteRequest, route


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


class TestRouteTokenAccumulation(unittest.TestCase):
    def test_single_completion_sums_tokens(self):
        async def _run():
            payload = {
                'summary': 'ok',
                'tasks': [],
                'risks': [],
                'recommended_next_actions': [],
            }
            body = json.dumps(payload)
            with patch('router.main.chat_completion', new_callable=AsyncMock) as m:
                m.return_value = {
                    'content': body,
                    'raw': {},
                    'prompt_tokens': 10,
                    'completion_tokens': 20,
                    'total_tokens': 30,
                }
                r = await route(_pm_req())
                self.assertEqual(r.get('prompt_tokens'), 10)
                self.assertEqual(r.get('completion_tokens'), 20)
                self.assertEqual(r.get('total_tokens'), 30)
                self.assertEqual(m.await_count, 1)

        asyncio.run(_run())

    def test_grammar_fallback_sums_both_calls(self):
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
                        'prompt_tokens': 1,
                        'completion_tokens': 2,
                        'total_tokens': 3,
                    },
                    {
                        'content': body,
                        'raw': {},
                        'prompt_tokens': 100,
                        'completion_tokens': 200,
                        'total_tokens': 300,
                    },
                ]
                r = await route(_pm_req())
                self.assertNotIn('error', r)
                self.assertEqual(r.get('prompt_tokens'), 101)
                self.assertEqual(r.get('completion_tokens'), 202)
                self.assertEqual(r.get('total_tokens'), 303)
                self.assertEqual(m.await_count, 2)

        asyncio.run(_run())

    def test_pm_schema_fallback_sums_both_calls(self):
        async def _run():
            payload = {
                'summary': 'ok',
                'tasks': [],
                'risks': [],
                'recommended_next_actions': [],
            }
            body = json.dumps(payload)
            bad_first = 'not valid json {'
            with patch('router.main.PM_SCHEMA_FALLBACK', True), patch(
                'router.main.chat_completion', new_callable=AsyncMock
            ) as m:
                m.side_effect = [
                    {
                        'content': bad_first,
                        'raw': {},
                        'prompt_tokens': 5,
                        'completion_tokens': 6,
                        'total_tokens': 11,
                    },
                    {
                        'content': json.dumps(payload),
                        'raw': {},
                        'prompt_tokens': 7,
                        'completion_tokens': 8,
                        'total_tokens': 15,
                    },
                ]
                r = await route(_pm_req())
                self.assertEqual(r.get('parsed'), payload)
                self.assertTrue(r.get('schema_fallback_used'))
                self.assertEqual(r.get('prompt_tokens'), 12)
                self.assertEqual(r.get('completion_tokens'), 14)
                self.assertEqual(r.get('total_tokens'), 26)
                self.assertEqual(m.await_count, 2)

        asyncio.run(_run())

    def test_unknown_schema_key_returns_zero_tokens(self):
        async def _run():
            req = RouteRequest(
                agent='pm',
                task_type='general',
                messages=[Message(role='user', content='x')],
                schema_key='definitely_missing_key_xyz',
            )
            with patch('router.main.chat_completion', new_callable=AsyncMock) as m:
                r = await route(req)
                self.assertIn('error', r)
                self.assertEqual(r.get('total_tokens'), 0)
                self.assertEqual(m.await_count, 0)

        asyncio.run(_run())


if __name__ == '__main__':
    unittest.main()

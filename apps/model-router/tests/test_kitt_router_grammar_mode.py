"""KITT_ROUTER_GRAMMAR_MODE and redundant grammar-fallback suppression."""

import asyncio
import json
import os
import unittest
from unittest.mock import AsyncMock, patch

from router.main import Message, RouteRequest, route

_MINIMAL_KITT = {
    'type': 'object',
    'properties': {
        'summary': {'type': 'string'},
        'tasks': {'type': 'array', 'items': {'type': 'object'}},
        'risks': {'type': 'array', 'items': {'type': 'object'}},
        'recommended_next_actions': {'type': 'array', 'items': {'type': 'string'}},
    },
    'required': ['summary', 'tasks', 'risks', 'recommended_next_actions'],
}


def _kitt_req() -> RouteRequest:
    return RouteRequest(
        agent='kitt',
        task_type='breakdown',
        messages=[Message(role='user', content='hello')],
        schema_=_MINIMAL_KITT,
    )


class TestKittRouterGrammarMode(unittest.TestCase):
    def test_never_omits_ollama_format_single_call(self):
        async def _run():
            payload = {
                'summary': 'ok',
                'tasks': [],
                'risks': [],
                'recommended_next_actions': [],
            }
            body = json.dumps(payload)
            with patch.dict(os.environ, {'KITT_ROUTER_GRAMMAR_MODE': 'never'}, clear=False):
                with patch('router.main.chat_completion', new_callable=AsyncMock) as m:
                    m.return_value = {
                        'content': body,
                        'raw': {},
                        'prompt_tokens': 1,
                        'completion_tokens': 2,
                        'total_tokens': 3,
                    }
                    r = await route(_kitt_req())
                    self.assertEqual(m.await_count, 1)
                    self.assertIsNone(m.call_args.kwargs.get('schema'))
                    self.assertEqual(r.get('kitt_grammar_mode'), 'never')
                    self.assertEqual(r.get('parsed'), payload)

        asyncio.run(_run())

    def test_always_passes_schema_to_ollama(self):
        async def _run():
            payload = {
                'summary': 'ok',
                'tasks': [],
                'risks': [],
                'recommended_next_actions': [],
            }
            body = json.dumps(payload)
            with patch.dict(os.environ, {'KITT_ROUTER_GRAMMAR_MODE': 'always'}, clear=False):
                with patch('router.main.chat_completion', new_callable=AsyncMock) as m:
                    m.return_value = {'content': body, 'raw': {}}
                    r = await route(_kitt_req())
                    sch = m.call_args.kwargs.get('schema')
                    self.assertIsNotNone(sch)
                    self.assertEqual(sch.get('type'), 'object')
                    self.assertEqual(r.get('kitt_grammar_mode'), 'always')

        asyncio.run(_run())

    def test_never_skips_grammar_failure_retry_on_500(self):
        """First KITT pass is already unstructured; do not fire a second identical retry."""
        async def _run():
            with patch.dict(os.environ, {'KITT_ROUTER_GRAMMAR_MODE': 'never'}, clear=False):
                with patch('router.main.GRAMMAR_FAILURE_FALLBACK', True), patch(
                    'router.main.chat_completion', new_callable=AsyncMock
                ) as m:
                    m.return_value = {
                        'content': '',
                        'error': 'Ollama HTTP 500: boom',
                        'ollama_http_error': True,
                        'ollama_status': 500,
                    }
                    r = await route(_kitt_req())
                    self.assertEqual(m.await_count, 1)
                    self.assertIn('error', r)

        asyncio.run(_run())


if __name__ == '__main__':
    unittest.main()

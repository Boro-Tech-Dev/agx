"""PM/KITT workflows: router error visibility and parse-recovery behavior."""

import unittest
from contextlib import contextmanager
from unittest.mock import AsyncMock, patch

import pytest

pytest.importorskip('psycopg')

from worker.workflows import kitt_breakdown, pm_breakdown


@contextmanager
def _patch_no_db():
    """Workflow unit tests must not reach Postgres (no host `postgres` in CI)."""
    with (
        patch('worker.workflows.common.event'),
        patch('worker.workflows.pm_breakdown.project_pm_kind', return_value='business'),
    ):
        yield


class TestPmRouterErrorVisibility(unittest.IsolatedAsyncioTestCase):
    async def test_error_survives_with_parsed_dict(self):
        routed = {
            'parsed': {'summary': 'Still here', 'tasks': [], 'risks': []},
            'parse_failed': False,
            'content': '{"summary":"Still here"}',
            'error': 'should_not_be_cleared',
            'model_used': 'test-model',
        }
        with _patch_no_db(), patch.object(pm_breakdown, 'route_model', new_callable=AsyncMock, return_value=routed):
            out, r = await pm_breakdown.run(
                '00000000-0000-4000-8000-000000000001',
                'general',
                'user text',
                '',
                {'content': 'user text'},
                [],
            )
        self.assertEqual(r.get('error'), 'should_not_be_cleared')
        self.assertEqual(out.get('summary'), 'Still here')


class TestParseRecoveryLooseShell(unittest.IsolatedAsyncioTestCase):
    """After grammar fallback, model text without extracted JSON must not trigger generic scaffold or degraded."""

    async def test_kitt_grammar_fallback_parse_error_uses_model_text(self):
        routed = {
            'parsed': None,
            'parse_failed': True,
            'content': '## Summary\nShip the milestone.\n\n### Tasks\n- [ ] QA sign-off',
            'error': 'schema_parse_failed_after_grammar_fallback',
            'grammar_failure_fallback_used': True,
            'warning': 'Ollama HTTP 500: runner stopped',
            'model_used': 'llama3.1:8b',
        }
        with _patch_no_db(), patch.object(kitt_breakdown, 'route_model', new_callable=AsyncMock, return_value=routed):
            out, r = await kitt_breakdown.run(
                '00000000-0000-4000-8000-000000000002',
                'general',
                'user text',
                '',
                {'content': 'user text'},
                [],
            )
        self.assertIsNone(r.get('error'))
        self.assertIn('milestone', (out or {}).get('summary', ''))
        self.assertNotIn('_fallback_scaffold', out or {})

    async def test_pm_parse_recovery_clears_router_error_for_completed_status(self):
        routed = {
            'parsed': None,
            'parse_failed': True,
            'content': '{"almost":"json" broken trailing',
            'error': 'schema_parse_failed_after_fallback',
            'model_used': 'test',
        }
        with _patch_no_db(), patch.object(pm_breakdown, 'route_model', new_callable=AsyncMock, return_value=routed):
            _out, r = await pm_breakdown.run(
                '00000000-0000-4000-8000-000000000003',
                'general',
                'user text',
                '',
                {'content': 'user text'},
                [],
            )
        self.assertIsNone(r.get('error'))


class TestKittSparseListsWarning(unittest.IsolatedAsyncioTestCase):
    async def test_sparse_core_lists_sets_code_and_event_path(self):
        summary = 'Client wants three new headlines and visual treatments for the campaign.'
        routed = {
            'parsed': {
                'summary': summary,
                'project_context': '',
                'assumptions': [],
                'open_questions': [],
                'decisions': [],
                'tasks': [],
                'risks': [],
                'costs': [],
                'anomalies': [],
                'recommended_next_actions': [],
            },
            'parse_failed': False,
            'content': '{}',
            'model_used': 'gemma3:270m',
            'kitt_grammar_mode': 'never',
        }
        with _patch_no_db(), patch.object(kitt_breakdown, 'route_model', new_callable=AsyncMock, return_value=routed):
            out, r = await kitt_breakdown.run(
                '00000000-0000-4000-8000-000000000010',
                'breakdown',
                'user text',
                '',
                {'content': 'user text'},
                [],
            )
        self.assertIsInstance(out, dict)
        self.assertIn('kitt_sparse_lists', out.get('kitt_parse_codes') or [])
        self.assertIn('kitt_sparse_lists', (out.get('parse_warning') or ''))


if __name__ == '__main__':
    unittest.main()

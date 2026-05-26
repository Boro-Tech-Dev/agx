import unittest
from unittest.mock import patch

from fastapi import HTTPException

from app.services.run_service import _validate_reranker_override


class TestRerankerOverrideValidation(unittest.TestCase):
    @patch('app.services.run_service.retrieval_config_service.list_reranker_catalog')
    def test_accepts_catalog_id(self, mock_catalog):
        mock_catalog.return_value = [
            {'reranker_id': 'off'},
            {'reranker_id': 'colbert_gte_modern'},
            {'reranker_id': 'colbert_gte_modern'},
        ]
        base = {'reranker_override': ' colbert_gte_modern '}
        _validate_reranker_override(base)
        self.assertEqual(base['reranker_override'], 'colbert_gte_modern')

    @patch('app.services.run_service.retrieval_config_service.list_reranker_catalog')
    def test_rejects_unknown_id(self, mock_catalog):
        mock_catalog.return_value = [{'reranker_id': 'off'}, {'reranker_id': 'colbert_gte_modern'}]
        with self.assertRaises(HTTPException) as ctx:
            _validate_reranker_override({'reranker_override': 'not_a_reranker'})
        self.assertEqual(ctx.exception.status_code, 400)
        self.assertIn('unknown reranker_override', str(ctx.exception.detail))

    @patch('app.services.run_service.retrieval_config_service.list_reranker_catalog')
    def test_strips_empty_override(self, mock_catalog):
        mock_catalog.return_value = [{'reranker_id': 'off'}]
        base = {'reranker_override': '   '}
        _validate_reranker_override(base)
        self.assertNotIn('reranker_override', base)


if __name__ == '__main__':
    unittest.main()

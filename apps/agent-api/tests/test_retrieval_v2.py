import unittest

from app.services.retrieval_ranking import rrf_merge


class TestRetrievalV2(unittest.TestCase):
    def test_rrf_merge_deduplicates(self):
        a = [{'id': '1', 'title': 'A'}, {'id': '2', 'title': 'B'}]
        b = [{'id': '2', 'title': 'B2'}, {'id': '3', 'title': 'C'}]
        merged = rrf_merge([a, b], k=10)
        ids = [r['id'] for r in merged]
        self.assertEqual(ids[0], '2')
        self.assertEqual(set(ids), {'1', '2', '3'})


if __name__ == '__main__':
    unittest.main()

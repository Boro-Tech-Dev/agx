"""Tests for Ollama token count extraction in router.hybrid."""

import unittest

from router.hybrid import ollama_chat_token_counts


class TestOllamaChatTokenCounts(unittest.TestCase):
    def test_none_raw(self):
        self.assertEqual(ollama_chat_token_counts(None), (0, 0, 0))

    def test_non_dict_raw(self):
        self.assertEqual(ollama_chat_token_counts([]), (0, 0, 0))
        self.assertEqual(ollama_chat_token_counts('x'), (0, 0, 0))

    def test_typical_ollama_body(self):
        raw = {'prompt_eval_count': 12, 'eval_count': 34}
        self.assertEqual(ollama_chat_token_counts(raw), (12, 34, 46))

    def test_missing_keys(self):
        self.assertEqual(ollama_chat_token_counts({}), (0, 0, 0))

    def test_negative_clamped(self):
        self.assertEqual(ollama_chat_token_counts({'prompt_eval_count': -1, 'eval_count': 5}), (0, 5, 5))

    def test_string_numbers(self):
        self.assertEqual(ollama_chat_token_counts({'prompt_eval_count': '3', 'eval_count': '4'}), (3, 4, 7))


if __name__ == '__main__':
    unittest.main()

"""Unit tests for worker.text_chunking.chunk_plain_text."""

from __future__ import annotations

import unittest

from worker.text_chunking import (
    DEFAULT_CHUNK_OVERLAP,
    DEFAULT_CHUNK_SIZE,
    chunk_plain_text,
)


class TestChunkPlainText(unittest.TestCase):
    def test_empty_input_returns_single_empty_chunk(self):
        self.assertEqual(chunk_plain_text(''), [''])
        self.assertEqual(chunk_plain_text('   \n\t   '), [''])

    def test_short_text_fits_in_one_chunk(self):
        out = chunk_plain_text('hello world', size=100, overlap=10)
        self.assertEqual(out, ['hello world'])

    def test_chunks_overlap_correctly(self):
        text = 'a' * 250
        out = chunk_plain_text(text, size=100, overlap=20)
        self.assertEqual(len(out), 4)
        # step = size - overlap = 80; offsets 0, 80, 160, 240
        self.assertEqual(out[0], 'a' * 100)
        self.assertEqual(out[3], 'a' * 10)

    def test_whitespace_is_collapsed(self):
        text = 'foo\n\nbar\t\tbaz'
        out = chunk_plain_text(text, size=100, overlap=0)
        self.assertEqual(out, ['foo bar baz'])

    def test_overlap_clamped_below_size(self):
        out = chunk_plain_text('abcdefghij', size=4, overlap=100)
        # overlap clamped to size-1 = 3; step = 1
        self.assertGreater(len(out), 1)
        # First chunk is first 4 chars
        self.assertEqual(out[0], 'abcd')

    def test_defaults_are_sane(self):
        self.assertGreater(DEFAULT_CHUNK_SIZE, DEFAULT_CHUNK_OVERLAP)
        self.assertGreaterEqual(DEFAULT_CHUNK_OVERLAP, 0)


if __name__ == '__main__':
    unittest.main()

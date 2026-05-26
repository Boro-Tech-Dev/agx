"""Shared plain-text chunker (mirrors ingestion-worker chunk_plain_text)."""

from __future__ import annotations

import re

DEFAULT_CHUNK_SIZE = 1200
DEFAULT_CHUNK_OVERLAP = 150


def chunk_plain_text(
    text: str,
    size: int = DEFAULT_CHUNK_SIZE,
    overlap: int = DEFAULT_CHUNK_OVERLAP,
) -> list[str]:
    text = re.sub(r'\s+', ' ', text or '').strip()
    if not text:
        return ['']
    size = max(1, int(size))
    overlap = max(0, min(int(overlap), size - 1))
    step = max(1, size - overlap)
    chunks: list[str] = []
    i = 0
    while i < len(text):
        chunks.append(text[i : i + size])
        i += step
    return chunks if chunks else ['']

"""Pure ranking helpers (no DB deps) for retrieval_v2."""

from __future__ import annotations

from typing import Any


def rrf_merge(lists: list[list[dict[str, Any]]], k: int = 60, rrf_k: int = 60) -> list[dict[str, Any]]:
    scores: dict[str, float] = {}
    rows_by_id: dict[str, dict[str, Any]] = {}
    for lst in lists:
        for rank, row in enumerate(lst):
            rid = str(row.get('id') or '')
            if not rid:
                continue
            scores[rid] = scores.get(rid, 0.0) + 1.0 / (rrf_k + rank + 1)
            rows_by_id[rid] = row
    ordered = sorted(scores.keys(), key=lambda x: scores[x], reverse=True)
    out = []
    for rid in ordered[:k]:
        row = dict(rows_by_id[rid])
        row['rrf_score'] = scores[rid]
        out.append(row)
    return out

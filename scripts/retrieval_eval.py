#!/usr/bin/env python3
"""Run retrieval eval matrix: embedder x reranker via agent-api memory search."""

from __future__ import annotations

import json
import os
import sys
import time
from datetime import datetime, timezone
from pathlib import Path
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parents[1]
FIXTURE = Path(os.getenv('RETRIEVAL_EVAL_FIXTURE', ROOT / 'fixtures' / 'retrieval' / 'queries.jsonl'))
API = os.getenv('AGENT_API_URL', 'http://localhost:8080').rstrip('/')
OUT_DIR = ROOT / 'artifacts' / 'retrieval_eval'

EMBEDDERS = ['nomic-embed-text', 'embeddinggemma', 'mxbai-embed-large', 'bge-m3']
RERANKERS = ['off', 'colbert_gte_modern', 'colbert_jina_v2']
AGENT = 'forge'


def _post(path: str, body: dict) -> dict:
    data = json.dumps(body).encode()
    req = Request(f'{API}{path}', data=data, headers={'Content-Type': 'application/json'}, method='POST')
    with urlopen(req, timeout=120) as res:
        return json.loads(res.read().decode())


def _mrr(gold: set[str], ranked: list[str]) -> float:
    for i, rid in enumerate(ranked, start=1):
        if rid in gold:
            return 1.0 / i
    return 0.0


def _p_at_k(gold: set[str], ranked: list[str], k: int = 5) -> float:
    top = ranked[:k]
    if not gold:
        return 0.0
    return len([x for x in top if x in gold]) / min(k, len(gold)) if gold else 0.0


def main() -> int:
    if not FIXTURE.is_file():
        print(f'Fixture missing: {FIXTURE}', file=sys.stderr)
        return 1
    queries = []
    for line in FIXTURE.read_text().splitlines():
        line = line.strip()
        if line:
            queries.append(json.loads(line))

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    ts = datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ')
    results: list[dict] = []

    for embedder in EMBEDDERS:
        for reranker in RERANKERS:
            mrrs: list[float] = []
            p5s: list[float] = []
            latencies: list[float] = []
            for q in queries:
                t0 = time.monotonic()
                try:
                    resp = _post(
                        '/api/memory/search',
                        {
                            'query': q['query'],
                            'workspace_key': q.get('workspace_key'),
                            'project_key': q.get('project_key'),
                            'limit': 10,
                            'agent': AGENT,
                            'embedder_override': embedder,
                            'reranker_override': reranker,
                        },
                    )
                    rows = resp.get('results') or []
                    ranked = [str(r.get('id')) for r in rows]
                    gold = set(str(x) for x in (q.get('gold_ids') or []))
                    mrrs.append(_mrr(gold, ranked))
                    p5s.append(_p_at_k(gold, ranked, 5))
                except Exception as e:
                    mrrs.append(0.0)
                    p5s.append(0.0)
                    print(f'warn {embedder}/{reranker}: {e}', file=sys.stderr)
                latencies.append((time.monotonic() - t0) * 1000)

            row = {
                'embedder': embedder,
                'reranker': reranker,
                'mrr_at_10': sum(mrrs) / len(mrrs) if mrrs else 0,
                'p_at_5': sum(p5s) / len(p5s) if p5s else 0,
                'median_latency_ms': sorted(latencies)[len(latencies) // 2] if latencies else 0,
                'queries': len(queries),
            }
            results.append(row)
            print(row)

    out_json = OUT_DIR / f'{ts}.json'
    out_json.write_text(json.dumps(results, indent=2), encoding='utf-8')
    md_lines = [
        f'# Retrieval eval {ts}',
        '',
        '| Embedder | Reranker | MRR@10 | P@5 | Median ms |',
        '|----------|----------|--------|-----|-----------|',
    ]
    for r in results:
        md_lines.append(
            f"| {r['embedder']} | {r['reranker']} | {r['mrr_at_10']:.3f} | {r['p_at_5']:.3f} | {r['median_latency_ms']:.0f} |"
        )
    md_path = OUT_DIR / f'{ts}.md'
    md_path.write_text('\n'.join(md_lines) + '\n', encoding='utf-8')
    print(f'Wrote {out_json} and {md_path}')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())

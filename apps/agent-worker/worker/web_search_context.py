"""SearXNG pre-fetch: build ## Web_search_facts blocks for agent prompts.

Two modes:

* ``WEB_DEEPFETCH_ENABLED=0`` (default): top-N SearXNG snippets are optionally
  reranked and emitted via :func:`format_web_search_block` (one ``[Sn]`` per
  result; title + URL + ~400-char snippet).
* ``WEB_DEEPFETCH_ENABLED=1``: top-N URLs are fetched through ``browser-runner``,
  chunked, reranked via ``model-router /v1/rerank``, and emitted via
  :func:`format_web_search_chunks_block` (one ``[Sn]`` per *chunk*, with
  per-source URL). On any failure, falls back to the snippet path so the run
  is never strictly worse than today.
"""

from __future__ import annotations

import os
from typing import Any

import httpx

from worker.text_chunking import chunk_plain_text
from worker.web_deepfetch import (
    FetchedPage,
    deepfetch_enabled,
    deepfetch_top_urls,
    deepfetch_urls,
)
from worker.workflows.common import event

SEARCH_RUNNER_URL = os.getenv('SEARCH_RUNNER_URL', 'http://search-runner:8092').strip().rstrip('/') or 'http://search-runner:8092'
MODEL_ROUTER_URL = os.getenv('MODEL_ROUTER_URL', 'http://model-router:8085').strip().rstrip('/') or 'http://model-router:8085'
RETRIEVAL_V2_ENABLED = os.getenv('RETRIEVAL_V2_ENABLED', '1').strip().lower() not in ('0', 'false', 'no')


def _deepfetch_top_chunks() -> int:
    raw = (os.getenv('WEB_DEEPFETCH_TOP_CHUNKS', '') or '').strip()
    try:
        v = int(raw) if raw else 8
    except ValueError:
        v = 8
    return max(1, min(40, v))


def _deepfetch_chunk_size() -> int:
    raw = (os.getenv('WEB_DEEPFETCH_CHUNK_SIZE', '') or '').strip()
    try:
        v = int(raw) if raw else 1200
    except ValueError:
        v = 1200
    return max(200, min(4000, v))


def _deepfetch_chunk_overlap() -> int:
    raw = (os.getenv('WEB_DEEPFETCH_CHUNK_OVERLAP', '') or '').strip()
    try:
        v = int(raw) if raw else 150
    except ValueError:
        v = 150
    return max(0, min(_deepfetch_chunk_size() - 1, v))


def _deepfetch_block_max_chars() -> int:
    raw = (os.getenv('WEB_DEEPFETCH_BLOCK_MAX_CHARS', '') or '').strip()
    try:
        v = int(raw) if raw else 5000
    except ValueError:
        v = 5000
    return max(500, v)


def _deepfetch_reranker_id() -> str:
    raw = (os.getenv('WEB_DEEPFETCH_RERANKER_ID', '') or '').strip()
    return raw or 'colbert_gte_modern'


def web_search_enabled() -> bool:
    return os.getenv('WEB_SEARCH_ENABLED', '1').strip().lower() not in ('0', 'false', 'no', 'off')


def _input_bool(inp: dict | None, key: str) -> bool | None:
    if not isinstance(inp, dict):
        return None
    v = inp.get(key)
    if v is None:
        return None
    if isinstance(v, bool):
        return v
    s = str(v).strip().lower()
    if s in ('1', 'true', 'yes'):
        return True
    if s in ('0', 'false', 'no'):
        return False
    return None


def should_attach_web_search(agent: str, inp: dict | None) -> bool:
    if not web_search_enabled():
        return False
    explicit = _input_bool(inp, 'web_search')
    if explicit is not None:
        return explicit
    # Forge and Canon default ON once lanes exist; keep import lazy to avoid cycles.
    try:
        from worker.agent_lanes import default_web_search_for_agent

        return default_web_search_for_agent(agent)
    except ImportError:
        return agent in ('forge', 'canon')


def format_web_search_block(results: list[dict[str, Any]]) -> str:
    if not results:
        return ''
    lines = ['## Web_search_facts', '', 'App-supplied web search snippets (cite as [S1], [S2], …):', '']
    for i, r in enumerate(results, start=1):
        title = (r.get('title') or 'Untitled').strip()
        url = (r.get('url') or '').strip()
        snippet = (r.get('snippet') or '').strip()[:400]
        lines.append(f'[S{i}] {title}')
        if url:
            lines.append(f'    URL: {url}')
        if snippet:
            lines.append(f'    {snippet}')
        lines.append('')
    lines.append(
        'When using this block: cite only URLs listed above; do not invent sources. '
        'If nothing here is relevant, say so in open_questions or summary.'
    )
    return '\n'.join(lines).strip()


def format_web_search_chunks_block(chunks: list[dict[str, Any]], *, per_chunk_chars: int = 500) -> str:
    """Render reranked page chunks as ``## Web_search_facts``.

    Each ``[Sn]`` is one *chunk* (with its source URL) rather than one search
    result. The header text is identical to :func:`format_web_search_block` so
    prompts that already mention "## Web_search_facts" / "cite as [Sn]" still
    work unchanged.
    """
    if not chunks:
        return ''
    lines = [
        '## Web_search_facts',
        '',
        'App-fetched web page excerpts (cite as [S1], [S2], …):',
        '',
    ]
    for i, c in enumerate(chunks, start=1):
        title = (c.get('title') or 'Untitled').strip()
        url = (c.get('url') or '').strip()
        text = (c.get('text') or '').strip()[:per_chunk_chars]
        lines.append(f'[S{i}] {title}')
        if url:
            lines.append(f'    URL: {url}')
        if text:
            lines.append(f'    {text}')
        lines.append('')
    lines.append(
        'When using this block: cite only URLs listed above; do not invent sources. '
        'If nothing here is relevant, say so in open_questions or summary.'
    )
    return '\n'.join(lines).strip()


def should_rerank_web_search(agent: str | None) -> bool:
    if not RETRIEVAL_V2_ENABLED or not agent:
        return False
    try:
        from worker.agent_lanes import agent_lane

        return agent_lane(agent).get('lane') == 'tool_capable'
    except ImportError:
        return agent in ('pm', 'builder', 'forge', 'canon')


async def _rerank_snippets(
    query: str,
    rows: list[dict[str, Any]],
    *,
    agent: str | None,
    run_id: str | None,
    reranker_override: str | None = None,
) -> list[dict[str, Any]]:
    if not should_rerank_web_search(agent) or not rows:
        return rows
    reranker_id = reranker_override
    if not reranker_id:
        try:
            import httpx

            api = os.getenv('AGENT_API_URL', 'http://agent-api:8080').strip().rstrip('/')
            async with httpx.AsyncClient(timeout=10) as client:
                cfg = (await client.get(f'{api}/api/admin/retrieval/agents')).json()
                for a in cfg.get('agents') or []:
                    if a.get('agent') == agent:
                        reranker_id = a.get('reranker_id')
                        break
        except Exception:
            reranker_id = 'colbert_gte_modern'
    if not reranker_id or reranker_id == 'off':
        return rows
    docs = []
    for r in rows:
        title = (r.get('title') or '').strip()
        snippet = (r.get('snippet') or '').strip()
        docs.append(f'{title}\n{snippet}'.strip() or snippet)
    if run_id:
        event(run_id, 'web.search.rerank.start', 'Reranking web snippets', {'reranker_id': reranker_id, 'n': len(docs)})
    try:
        import httpx

        async with httpx.AsyncClient(timeout=45) as client:
            data = (
                await client.post(
                    f'{MODEL_ROUTER_URL}/v1/rerank',
                    json={'query': query, 'documents': docs, 'reranker_id': reranker_id},
                )
            ).json()
        ranked = data.get('ranked') or []
        reordered = []
        for item in ranked:
            idx = int(item.get('index', 0))
            if 0 <= idx < len(rows):
                reordered.append(rows[idx])
        if run_id:
            event(
                run_id,
                'web.search.rerank.completed',
                'Web snippet rerank done',
                {'backend': data.get('backend_used'), 'latency_ms': data.get('latency_ms'), 'kept': len(reordered)},
            )
        return reordered or rows
    except Exception as e:
        if run_id:
            event(run_id, 'web.search.rerank.failed', 'Rerank failed', {'error': str(e)[:400]})
        return rows


async def _rerank_chunks_via_router(
    query: str,
    chunk_texts: list[str],
    *,
    reranker_id: str,
    run_id: str | None,
) -> list[tuple[int, float]]:
    """POST chunk texts to model-router /v1/rerank. Returns [(index, score), ...]
    in rank order. On any failure returns identity order with score 0.
    """
    if not chunk_texts:
        return []
    if not reranker_id or reranker_id == 'off':
        return [(i, 0.0) for i in range(len(chunk_texts))]
    try:
        async with httpx.AsyncClient(timeout=45.0) as client:
            res = await client.post(
                f'{MODEL_ROUTER_URL}/v1/rerank',
                json={'query': query, 'documents': chunk_texts, 'reranker_id': reranker_id},
            )
            res.raise_for_status()
            data = res.json() if res.content else {}
    except Exception as e:
        if run_id:
            event(
                run_id,
                'web.deepfetch.rerank.failed',
                'Chunk rerank failed; keeping fetch order',
                {'error': str(e)[:400]},
            )
        return [(i, 0.0) for i in range(len(chunk_texts))]
    ranked = data.get('ranked') or []
    out: list[tuple[int, float]] = []
    seen: set[int] = set()
    for item in ranked:
        try:
            idx = int(item.get('index'))
        except (TypeError, ValueError):
            continue
        if 0 <= idx < len(chunk_texts) and idx not in seen:
            seen.add(idx)
            out.append((idx, float(item.get('score') or 0.0)))
    # Append any indices the reranker didn't return, preserving fetch order.
    for i in range(len(chunk_texts)):
        if i not in seen:
            out.append((i, 0.0))
    if run_id:
        event(
            run_id,
            'web.deepfetch.reranked',
            'Reranked deep-fetched chunks',
            {
                'reranker_id': reranker_id,
                'backend': data.get('backend_used'),
                'latency_ms': data.get('latency_ms'),
                'n_chunks': len(chunk_texts),
            },
        )
    return out


async def _deepfetch_search_block(
    query: str,
    raw_results: list[dict[str, Any]],
    *,
    top_urls: int,
    run_id: str | None,
    reranker_override: str | None,
) -> str:
    """Best-effort deep-fetch pipeline. Returns '' if it can't produce a block;
    callers should then fall back to :func:`format_web_search_block`.
    """
    urls: list[str] = []
    title_by_url: dict[str, str] = {}
    snippet_by_url: dict[str, str] = {}
    for r in raw_results[:top_urls]:
        if not isinstance(r, dict):
            continue
        u = (r.get('url') or '').strip()
        if not u:
            continue
        urls.append(u)
        title_by_url[u] = (r.get('title') or '').strip()
        snippet_by_url[u] = (r.get('snippet') or '').strip()
    if not urls:
        return ''

    if run_id:
        event(run_id, 'web.deepfetch.request', 'Fetching pages for SearXNG results', {'urls': len(urls)})

    pages: list[FetchedPage] = await deepfetch_urls(urls)
    usable = [p for p in pages if p.source != 'skipped' and (p.text or '').strip()]
    if run_id:
        event(
            run_id,
            'web.deepfetch.fetched',
            'Deep-fetch completed',
            {
                'fetched_total': len(pages),
                'usable': len(usable),
                'cache_hits': sum(1 for p in pages if p.source == 'cache'),
                'live': sum(1 for p in pages if p.source == 'live'),
                'skipped': sum(1 for p in pages if p.source == 'skipped'),
            },
        )
    if not usable:
        return ''

    size = _deepfetch_chunk_size()
    overlap = _deepfetch_chunk_overlap()
    flat: list[dict[str, Any]] = []
    for p in usable:
        for piece in chunk_plain_text(p.text, size=size, overlap=overlap):
            piece = (piece or '').strip()
            if not piece:
                continue
            flat.append(
                {
                    'title': p.title or title_by_url.get(p.url) or 'Untitled',
                    'url': p.final_url or p.url,
                    'text': piece,
                }
            )
    if not flat:
        return ''

    ranked = await _rerank_chunks_via_router(
        query,
        [c['text'] for c in flat],
        reranker_id=(reranker_override or _deepfetch_reranker_id()),
        run_id=run_id,
    )
    top_chunks_n = _deepfetch_top_chunks()
    top_chunks = [flat[i] for i, _s in ranked[:top_chunks_n]]
    if not top_chunks:
        return ''

    block = format_web_search_chunks_block(top_chunks)
    max_chars = _deepfetch_block_max_chars()
    if len(block) > max_chars:
        # Drop chunks from the tail until under the cap.
        trimmed = list(top_chunks)
        while trimmed and len(format_web_search_chunks_block(trimmed)) > max_chars:
            trimmed.pop()
        block = format_web_search_chunks_block(trimmed) if trimmed else ''
    if run_id and block:
        event(
            run_id,
            'web.deepfetch.attached',
            'Deep-fetch chunks attached to prompt',
            {'n_chunks': len(top_chunks), 'block_chars': len(block)},
        )
    return block


async def search_context(
    query: str,
    *,
    n: int = 5,
    run_id: str | None = None,
    language: str = 'all',
    time_range: str | None = None,
    agent: str | None = None,
    reranker_override: str | None = None,
) -> tuple[str, list[dict[str, Any]]]:
    """Returns (markdown block, raw result rows). Empty block on skip/error."""
    q = (query or '').strip()
    if not q or not web_search_enabled():
        return '', []

    payload: dict[str, Any] = {'query': q[:500], 'max_results': max(1, min(10, n)), 'language': language}
    if time_range in ('day', 'month', 'year'):
        payload['time_range'] = time_range

    if run_id:
        event(run_id, 'web.search.request', 'POST search-runner /tools/web/search', {'query_chars': len(q), 'n': n})

    try:
        async with httpx.AsyncClient(timeout=20.0) as client:
            res = await client.post(f'{SEARCH_RUNNER_URL}/tools/web/search', json=payload)
            res.raise_for_status()
            data = res.json()
    except Exception as e:
        if run_id:
            event(run_id, 'web.search.failed', 'Web search request failed', {'error': str(e)[:800]})
        return '', []

    rows = data.get('results') if isinstance(data, dict) else []
    if not isinstance(rows, list):
        rows = []

    if deepfetch_enabled():
        top_urls = deepfetch_top_urls()
        try:
            deep_block = await _deepfetch_search_block(
                q,
                rows[: max(top_urls, n)],
                top_urls=top_urls,
                run_id=run_id,
                reranker_override=reranker_override,
            )
        except Exception as e:
            if run_id:
                event(run_id, 'web.deepfetch.failed', 'Deep-fetch pipeline error', {'error': str(e)[:400]})
            deep_block = ''
        if deep_block:
            if run_id:
                event(
                    run_id,
                    'web.search.completed',
                    'Web search results attached (deep-fetch)',
                    {'count': len(rows), 'block_chars': len(deep_block), 'mode': 'deepfetch'},
                )
            return deep_block, rows
        if run_id:
            event(
                run_id,
                'web.deepfetch.fallback',
                'Deep-fetch produced no chunks; falling back to snippet block',
                {'rows': len(rows)},
            )

    rows = await _rerank_snippets(
        q,
        rows[: max(n, 10)],
        agent=agent,
        run_id=run_id,
        reranker_override=reranker_override,
    )
    block = format_web_search_block(rows[:n])
    if run_id:
        event(
            run_id,
            'web.search.completed',
            'Web search results attached',
            {'count': len(rows), 'block_chars': len(block), 'mode': 'snippets'},
        )
    return block, rows

"""HTTP (+ optional MCP) tool registry for /v1/route_with_tools."""

from __future__ import annotations

import json
import logging
import os
import time
from typing import Any

import httpx

log = logging.getLogger(__name__)

SEARCH_RUNNER_URL = (
    os.getenv('SEARCH_RUNNER_URL', 'http://search-runner:8092').strip().rstrip('/') or 'http://search-runner:8092'
)
BROWSER_RUNNER_URL = (
    os.getenv('BROWSER_RUNNER_URL', 'http://browser-runner:8094').strip().rstrip('/') or 'http://browser-runner:8094'
)
TOOL_RUNNER_URL = os.getenv('TOOL_RUNNER_URL', 'http://tool-runner:8090').strip().rstrip('/') or 'http://tool-runner:8090'

TOOL_TIMEOUT_SEARCH = float(os.getenv('TOOL_TIMEOUT_SEARCH_SEC', '15') or '15')
TOOL_TIMEOUT_EXTRACT = float(os.getenv('TOOL_TIMEOUT_EXTRACT_SEC', '120') or '120')
TOOL_TIMEOUT_CRAWL = float(os.getenv('TOOL_TIMEOUT_CRAWL_SEC', '600') or '600')
TOOL_TIMEOUT_REPO = float(os.getenv('TOOL_TIMEOUT_REPO_SEC', '60') or '60')


def mcp_bridge_enabled() -> bool:
    return os.getenv('MCP_BRIDGE_ENABLED', '0').strip().lower() in ('1', 'true', 'yes')


def ollama_tool_definitions(allowlist: list[str] | None = None) -> list[dict[str, Any]]:
    """Ollama-compatible OpenAI-style tool schemas."""
    all_tools = {
        'searxng_web_search': {
            'type': 'function',
            'function': {
                'name': 'searxng_web_search',
                'description': (
                    'Search the web via private SearXNG. Parameter MUST be named query (not q or prompt).'
                ),
                'parameters': {
                    'type': 'object',
                    'properties': {
                        'query': {'type': 'string', 'description': 'Search query string'},
                        'pageno': {'type': 'integer', 'description': 'Page number starting at 1'},
                        'time_range': {
                            'type': 'string',
                            'enum': ['day', 'month', 'year'],
                            'description': 'Optional time filter',
                        },
                        'language': {'type': 'string', 'description': "Language code or 'all'"},
                        'safesearch': {
                            'type': 'integer',
                            'enum': [0, 1, 2],
                            'description': 'Safe search level',
                        },
                    },
                    'required': ['query'],
                },
            },
        },
        'web_url_read': {
            'type': 'function',
            'function': {
                'name': 'web_url_read',
                'description': 'Fetch URL and return article text (markdown-oriented extraction).',
                'parameters': {
                    'type': 'object',
                    'properties': {
                        'url': {'type': 'string'},
                        'maxLength': {'type': 'integer'},
                    },
                    'required': ['url'],
                },
            },
        },
        'web_extract': {
            'type': 'function',
            'function': {
                'name': 'web_extract',
                'description': 'Extract readable text from a public HTTP(S) URL.',
                'parameters': {
                    'type': 'object',
                    'properties': {
                        'url': {'type': 'string'},
                        'render_js': {'type': 'boolean'},
                    },
                    'required': ['url'],
                },
            },
        },
        'web_screenshot': {
            'type': 'function',
            'function': {
                'name': 'web_screenshot',
                'description': 'Capture a PNG screenshot of a URL (returns metadata, not image bytes in tool text).',
                'parameters': {
                    'type': 'object',
                    'properties': {'url': {'type': 'string'}},
                    'required': ['url'],
                },
            },
        },
        'web_crawl': {
            'type': 'function',
            'function': {
                'name': 'web_crawl',
                'description': 'Shallow same-site crawl from seed URL; returns page excerpts.',
                'parameters': {
                    'type': 'object',
                    'properties': {
                        'url': {'type': 'string'},
                        'max_pages': {'type': 'integer'},
                        'max_depth': {'type': 'integer'},
                    },
                    'required': ['url'],
                },
            },
        },
        'repo_search': {
            'type': 'function',
            'function': {
                'name': 'repo_search',
                'description': 'Search workspace repo files for a substring.',
                'parameters': {
                    'type': 'object',
                    'properties': {
                        'query': {'type': 'string'},
                        'path': {'type': 'string'},
                    },
                    'required': ['query'],
                },
            },
        },
        'repo_read': {
            'type': 'function',
            'function': {
                'name': 'repo_read',
                'description': 'Read a file from the workspace repo.',
                'parameters': {
                    'type': 'object',
                    'properties': {
                        'path': {'type': 'string'},
                        'max_chars': {'type': 'integer'},
                    },
                    'required': ['path'],
                },
            },
        },
        'repo_summarize': {
            'type': 'function',
            'function': {
                'name': 'repo_summarize',
                'description': 'Summarize repo manifests and file listing for a path.',
                'parameters': {
                    'type': 'object',
                    'properties': {'path': {'type': 'string'}},
                },
            },
        },
    }
    if allowlist:
        return [all_tools[n] for n in allowlist if n in all_tools]
    return list(all_tools.values())


def _parse_tool_args(raw: Any) -> dict[str, Any]:
    if isinstance(raw, dict):
        return raw
    if isinstance(raw, str):
        try:
            parsed = json.loads(raw)
            return parsed if isinstance(parsed, dict) else {}
        except json.JSONDecodeError:
            return {}
    return {}


async def dispatch_tool(name: str, arguments: Any) -> dict[str, Any]:
    """Execute a tool; returns {ok, text, error?, latency_ms}."""
    args = _parse_tool_args(arguments)
    t0 = time.monotonic()
    try:
        text = await _dispatch_tool_inner(name, args)
        return {
            'ok': True,
            'text': text[:12000],
            'latency_ms': int((time.monotonic() - t0) * 1000),
        }
    except Exception as e:
        log.warning('tool_dispatch_failed name=%s err=%s', name, e, exc_info=True)
        return {
            'ok': False,
            'text': '',
            'error': str(e)[:800],
            'latency_ms': int((time.monotonic() - t0) * 1000),
        }


async def _dispatch_tool_inner(name: str, args: dict[str, Any]) -> str:
    if name == 'searxng_web_search':
        return await _tool_searxng_search(args)
    if name in ('web_url_read', 'web_extract'):
        return await _tool_web_extract(args, render_js=name == 'web_url_read')
    if name == 'web_screenshot':
        return await _tool_web_screenshot(args)
    if name == 'web_crawl':
        return await _tool_web_crawl(args)
    if name == 'repo_search':
        return await _tool_repo_post('/tools/repo/search', args, TOOL_TIMEOUT_REPO)
    if name == 'repo_read':
        return await _tool_repo_post('/tools/repo/read', args, TOOL_TIMEOUT_REPO)
    if name == 'repo_summarize':
        return await _tool_repo_post('/tools/repo/summarize', args, TOOL_TIMEOUT_REPO)
    if name.startswith('mcp__') and mcp_bridge_enabled():
        from router.mcp_bridge import dispatch_mcp_tool

        return await dispatch_mcp_tool(name.removeprefix('mcp__'), args)
    raise ValueError(f'unknown tool: {name}')


async def _tool_searxng_search(args: dict[str, Any]) -> str:
    query = (args.get('query') or args.get('q') or '').strip()
    if not query:
        raise ValueError('query is required')
    payload: dict[str, Any] = {'query': query[:500]}
    for k in ('pageno', 'time_range', 'language', 'safesearch', 'max_results'):
        if args.get(k) is not None:
            payload[k] = args[k]
    async with httpx.AsyncClient(timeout=TOOL_TIMEOUT_SEARCH) as client:
        res = await client.post(f'{SEARCH_RUNNER_URL}/tools/web/search', json=payload)
        res.raise_for_status()
        data = res.json()
    rows = data.get('results') or []
    if not rows:
        return f'No results for: {query}'
    parts = []
    for i, r in enumerate(rows, 1):
        if not isinstance(r, dict):
            continue
        parts.append(
            f'[{i}] {r.get("title","")}\nURL: {r.get("url","")}\n{r.get("snippet","")[:400]}'
        )
    return '\n\n'.join(parts)


async def _tool_web_extract(args: dict[str, Any], *, render_js: bool) -> str:
    url = (args.get('url') or '').strip()
    if not url:
        raise ValueError('url is required')
    payload = {'url': url, 'render_js': render_js if 'render_js' in args else render_js}
    if args.get('maxLength'):
        payload['max_chars'] = args['maxLength']
    async with httpx.AsyncClient(timeout=TOOL_TIMEOUT_EXTRACT) as client:
        res = await client.post(f'{BROWSER_RUNNER_URL}/tools/web/extract', json=payload)
        res.raise_for_status()
        data = res.json()
    title = data.get('title') or ''
    text = (data.get('text') or '')[:8000]
    return f'Title: {title}\nURL: {data.get("final_url") or url}\n\n{text}'


async def _tool_web_screenshot(args: dict[str, Any]) -> str:
    url = (args.get('url') or '').strip()
    if not url:
        raise ValueError('url is required')
    async with httpx.AsyncClient(timeout=TOOL_TIMEOUT_EXTRACT) as client:
        res = await client.post(f'{BROWSER_RUNNER_URL}/tools/web/screenshot', json={'url': url})
        res.raise_for_status()
        data = res.json()
    b64_len = len(data.get('image_base64') or '')
    return (
        f'Screenshot captured for {data.get("final_url") or url}; '
        f'png_base64_chars={b64_len} (image not inlined in tool result).'
    )


async def _tool_web_crawl(args: dict[str, Any]) -> str:
    url = (args.get('url') or '').strip()
    if not url:
        raise ValueError('url is required')
    payload: dict[str, Any] = {'url': url}
    if args.get('max_pages') is not None:
        payload['max_pages'] = args['max_pages']
    if args.get('max_depth') is not None:
        payload['max_depth'] = args['max_depth']
    async with httpx.AsyncClient(timeout=TOOL_TIMEOUT_CRAWL) as client:
        res = await client.post(f'{BROWSER_RUNNER_URL}/tools/web/crawl', json=payload)
        res.raise_for_status()
        data = res.json()
    pages = data.get('pages') or []
    lines = [f'Crawl seed: {data.get("seed") or url}', f'Pages: {len(pages)}']
    for i, p in enumerate(pages[:12]):
        if not isinstance(p, dict):
            continue
        lines.append(f'--- Page {i+1}: {p.get("title") or p.get("url")}')
        lines.append((p.get('excerpt') or p.get('text') or '')[:1200])
    return '\n'.join(lines)


async def _tool_repo_post(path: str, args: dict[str, Any], timeout: float) -> str:
    async with httpx.AsyncClient(timeout=timeout) as client:
        res = await client.post(f'{TOOL_RUNNER_URL}{path}', json=args)
        res.raise_for_status()
        return json.dumps(res.json(), indent=2, default=str)[:10000]

"""Optional MCP HTTP bridge (Streamable HTTP) to mcp-searxng and other targets."""

from __future__ import annotations

import json
import logging
import os
from typing import Any
from urllib.parse import urlparse

import httpx

log = logging.getLogger(__name__)


def _parse_targets() -> dict[str, str]:
    """MCP_BRIDGE_TARGETS=mcp-searxng=http://mcp-searxng:3030,other=http://host:port"""
    raw = (os.getenv('MCP_BRIDGE_TARGETS', '') or '').strip()
    out: dict[str, str] = {}
    for part in raw.split(','):
        part = part.strip()
        if not part or '=' not in part:
            continue
        name, url = part.split('=', 1)
        out[name.strip()] = url.strip().rstrip('/')
    return out


def _auth_header() -> dict[str, str]:
    token = (os.getenv('MCP_HTTP_AUTH_TOKEN', '') or os.getenv('MCP_AUTH_TOKEN', '') or '').strip()
    if not token:
        return {}
    return {'Authorization': f'Bearer {token}'}


async def _mcp_session_post(base_url: str, body: dict[str, Any], session_id: str | None = None) -> tuple[dict[str, Any], str | None]:
    headers = {
        'Content-Type': 'application/json',
        'Accept': 'application/json, text/event-stream',
        **_auth_header(),
    }
    if session_id:
        headers['mcp-session-id'] = session_id
    async with httpx.AsyncClient(timeout=60.0) as client:
        res = await client.post(f'{base_url}/mcp', json=body, headers=headers)
        res.raise_for_status()
        sid = res.headers.get('mcp-session-id') or session_id
        try:
            data = res.json()
        except Exception:
            data = {'raw': (res.text or '')[:4000]}
        return data, sid


async def dispatch_mcp_tool(tool_name: str, args: dict[str, Any]) -> str:
    """
    Call tools/call on the first configured MCP target (typically mcp-searxng).
    Falls back to HTTP search-runner for searxng_web_search on failure.
    """
    targets = _parse_targets()
    if not targets:
        raise RuntimeError('MCP_BRIDGE_ENABLED but MCP_BRIDGE_TARGETS is empty')
    base = next(iter(targets.values()))

    init_body = {
        'jsonrpc': '2.0',
        'id': 1,
        'method': 'initialize',
        'params': {
            'protocolVersion': '2024-11-05',
            'capabilities': {},
            'clientInfo': {'name': 'agent-x-model-router', 'version': '0.6.0'},
        },
    }
    _, session_id = await _mcp_session_post(base, init_body)

    call_body = {
        'jsonrpc': '2.0',
        'id': 2,
        'method': 'tools/call',
        'params': {'name': tool_name, 'arguments': args},
    }
    data, _ = await _mcp_session_post(base, call_body, session_id=session_id)

    if tool_name == 'searxng_web_search' and isinstance(data, dict) and data.get('error'):
        from router.tool_registry import _tool_searxng_search

        log.warning('mcp searxng_web_search failed, falling back to HTTP: %s', data.get('error'))
        return await _tool_searxng_search(args)

    if isinstance(data, dict):
        result = data.get('result') or data
        if isinstance(result, dict):
            content = result.get('content')
            if isinstance(content, list):
                texts = [c.get('text', '') for c in content if isinstance(c, dict)]
                return '\n'.join(t for t in texts if t)[:12000]
        return json.dumps(data, indent=2, default=str)[:12000]
    return str(data)[:12000]

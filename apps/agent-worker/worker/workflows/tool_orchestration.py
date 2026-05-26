"""Tool-loop routing via model-router /v1/route_with_tools."""

from __future__ import annotations

import json
import os
import re
import time
from typing import Any
from urllib.parse import urlparse

import httpx

from worker.agent_lanes import should_use_tool_loop, tool_allowlist_for_agent
from worker.workflows.common import event
from worker.workflows.schema_route_key import router_schema_key
from worker.workflows.schemas import SCHEMAS

MODEL_ROUTER_URL = os.getenv('MODEL_ROUTER_URL', 'http://model-router:8085')


def _model_router_http_timeout() -> float:
    raw = (os.getenv('MODEL_ROUTER_HTTP_TIMEOUT_SEC', '') or '').strip()
    if raw:
        try:
            return max(90.0, float(raw))
        except ValueError:
            pass
    try:
        return float(os.getenv('OLLAMA_HTTP_TIMEOUT', '300')) + 120.0
    except ValueError:
        return 420.0


def _extract_urls_from_tool_events(tool_calls: list[dict[str, Any]]) -> set[str]:
    urls: set[str] = set()
    for ev in tool_calls or []:
        if not isinstance(ev, dict):
            continue
        preview = str(ev.get('arguments_preview') or '')
        for m in re.finditer(r'https?://[^\s\]\)\"\'<>]+', preview):
            urls.add(m.group(0).rstrip('.,;'))
    return urls


def _extract_urls_from_text(text: str) -> set[str]:
    out: set[str] = set()
    for m in re.finditer(r'https?://[^\s\]\)\"\'<>]+', text or ''):
        out.add(m.group(0).rstrip('.,;'))
    return out


def allowed_urls_from_router(routed: dict[str, Any]) -> set[str]:
    urls: set[str] = set()
    for ev in routed.get('tool_calls') or []:
        if isinstance(ev, dict):
            urls |= _extract_urls_from_tool_events([ev])
            urls |= _extract_urls_from_text(str(ev.get('result_preview') or ''))
    return urls


def validate_citations_in_output(out: dict[str, Any], allowed_urls: set[str]) -> dict[str, Any]:
    """Drop [Sn] references when output cites URLs not seen in tool results."""
    if not isinstance(out, dict) or not allowed_urls:
        return out
    blob = json.dumps(out, default=str)
    cited = _extract_urls_from_text(blob)
    dropped = [u for u in cited if u not in allowed_urls]
    if dropped:
        out = dict(out)
        out.setdefault('citation_validation', {})
        if isinstance(out['citation_validation'], dict):
            out['citation_validation']['dropped_urls'] = dropped[:20]
    return out


async def route_model_with_tools(
    agent: str,
    workflow: str,
    messages: list,
    schema=None,
    *,
    run_id: str | None = None,
    inp: dict | None = None,
) -> dict[str, Any]:
    sch = schema if schema is not None else SCHEMAS[agent]
    use_schema_key = os.getenv('MODEL_ROUTER_SCHEMA_KEY', '').strip().lower() in ('1', 'true', 'yes')
    sk = router_schema_key(agent, sch) if use_schema_key else None
    allowlist = tool_allowlist_for_agent(agent)
    payload: dict[str, Any] = {
        'agent': agent,
        'task_type': workflow,
        'messages': messages,
        'tools': allowlist,
    }
    if sk:
        payload['schema_key'] = sk
    else:
        payload['schema'] = sch
    if run_id:
        event(
            run_id,
            'model.router.tools.request',
            'POST /v1/route_with_tools',
            {'agent': agent, 'tools': allowlist, 'schema_key': sk},
        )
    t0 = time.monotonic()
    timeout = _model_router_http_timeout()
    async with httpx.AsyncClient(timeout=timeout) as client:
        try:
            res = await client.post(f'{MODEL_ROUTER_URL}/v1/route_with_tools', json=payload)
            res.raise_for_status()
            data = res.json()
        except Exception as e:
            elapsed = int((time.monotonic() - t0) * 1000)
            if run_id:
                event(run_id, 'model.router.tools.failed', 'tool-loop request failed', {'elapsed_ms': elapsed, 'error': str(e)[:800]})
            return {
                'agent': agent,
                'model_used': None,
                'content': '',
                'parsed': None,
                'parse_failed': False,
                'error': f'model-router tools request failed: {e}',
            }
    elapsed = int((time.monotonic() - t0) * 1000)
    if not isinstance(data, dict):
        data = {}
    data.setdefault('agent', agent)
    tool_calls = data.get('tool_calls') if isinstance(data.get('tool_calls'), list) else []
    if run_id:
        for ev in tool_calls:
            if isinstance(ev, dict) and ev.get('type') == 'tool.call.completed':
                event(run_id, 'tool.call.completed', f"Tool {ev.get('tool')}", ev)
            elif isinstance(ev, dict) and ev.get('type') == 'tool.call.requested':
                event(run_id, 'tool.call.requested', f"Tool {ev.get('tool')}", ev)
        event(
            run_id,
            'model.router.tools.completed',
            'Tool-loop route finished',
            {'elapsed_ms': elapsed, 'tool_events': len(tool_calls), 'parse_failed': data.get('parse_failed')},
        )
    return data


def maybe_route(
    agent: str,
    workflow: str,
    messages: list,
    schema=None,
    *,
    run_id: str | None = None,
    inp: dict | None = None,
    route_model_fn,
):
    """Use tool loop when lane + input allow; else delegate to single-shot route_model."""
    if should_use_tool_loop(agent, inp):
        return route_model_with_tools(agent, workflow, messages, schema, run_id=run_id, inp=inp)
    return route_model_fn(agent, workflow, messages, schema=schema, run_id=run_id)

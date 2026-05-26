"""Two-phase agent routing: tool loop (unconstrained) + JSON schema final pass."""

from __future__ import annotations

import json
import logging
import os
import time
from typing import Any

from router.hybrid import OllamaConfig, chat_completion, chat_completion_with_tools
from router.json_recovery import recover_json
from router.schema_registry import SCHEMA_BY_KEY
from router.tool_registry import dispatch_tool, ollama_tool_definitions

log = logging.getLogger(__name__)

MAX_TOOL_ITERS = int(os.getenv('TOOL_LOOP_MAX_ITERS', '4') or '4')
MAX_TOOL_CALLS = int(os.getenv('TOOL_LOOP_MAX_CALLS', '6') or '6')
TOOL_LOOP_WALL_SEC = float(os.getenv('TOOL_LOOP_WALL_SEC', '300') or '300')


def _effective_schema(schema: dict[str, Any] | None, schema_key: str | None) -> dict[str, Any] | None:
    if schema is not None:
        return schema
    if schema_key:
        return SCHEMA_BY_KEY.get(schema_key)
    return None


def _normalize_messages(messages: list[Any]) -> list[dict[str, Any]]:
    out: list[dict[str, Any]] = []
    for m in messages:
        if hasattr(m, 'model_dump'):
            out.append(m.model_dump())
        elif isinstance(m, dict):
            out.append(dict(m))
    return out


async def route_with_tools_handler(
    *,
    agent: str,
    task_type: str,
    messages: list[Any],
    schema: dict[str, Any] | None,
    schema_key: str | None,
    model: str,
    temperature: float,
    tool_allowlist: list[str] | None,
    max_iters: int | None,
    ollama_cfg: OllamaConfig,
) -> dict[str, Any]:
    eff_schema = _effective_schema(schema, schema_key)
    if schema_key and eff_schema is None:
        return {
            'model_used': model,
            'agent': agent,
            'content': '',
            'parsed': None,
            'parse_failed': False,
            'error': f'Unknown schema_key: {schema_key!r}',
            'tool_calls': [],
            'prompt_tokens': 0,
            'completion_tokens': 0,
            'total_tokens': 0,
        }

    msgs = _normalize_messages(messages)
    tools = ollama_tool_definitions(tool_allowlist)
    iters_cap = max(1, min(8, max_iters or MAX_TOOL_ITERS))
    tool_events: list[dict[str, Any]] = []
    tp = tc = tt = 0
    t_wall = time.monotonic()
    total_tool_calls = 0
    iterations_used = 0

    for iteration in range(iters_cap):
        iterations_used = iteration + 1
        if time.monotonic() - t_wall > TOOL_LOOP_WALL_SEC:
            tool_events.append({'type': 'tool.loop.timeout', 'iteration': iteration})
            break
        out = await chat_completion_with_tools(
            model=model,
            messages=msgs,
            tools=tools,
            temperature=temperature,
            ollama=ollama_cfg,
        )
        tp += int(out.get('prompt_tokens') or 0)
        tc += int(out.get('completion_tokens') or 0)
        tt += int(out.get('total_tokens') or 0)
        if out.get('error'):
            return {
                'model_used': model,
                'agent': agent,
                'content': out.get('content') or '',
                'parsed': None,
                'parse_failed': False,
                'error': out['error'],
                'tool_calls': tool_events,
                'prompt_tokens': tp,
                'completion_tokens': tc,
                'total_tokens': tt,
            }

        raw_calls = out.get('tool_calls') or []
        assistant_msg: dict[str, Any] = {'role': 'assistant', 'content': out.get('content') or ''}
        if raw_calls:
            assistant_msg['tool_calls'] = raw_calls
        msgs.append(assistant_msg)

        if not raw_calls:
            break

        for tc_item in raw_calls:
            if total_tool_calls >= MAX_TOOL_CALLS:
                tool_events.append({'type': 'tool.loop.budget_exceeded'})
                break
            if not isinstance(tc_item, dict):
                continue
            fn = tc_item.get('function') if isinstance(tc_item.get('function'), dict) else {}
            name = fn.get('name') or tc_item.get('name') or ''
            args_raw = fn.get('arguments') or tc_item.get('arguments') or {}
            tool_events.append(
                {
                    'type': 'tool.call.requested',
                    'tool': name,
                    'arguments_preview': str(args_raw)[:400],
                    'iteration': iteration,
                }
            )
            result = await dispatch_tool(name, args_raw)
            total_tool_calls += 1
            tool_events.append(
                {
                    'type': 'tool.call.completed',
                    'tool': name,
                    'ok': result.get('ok'),
                    'latency_ms': result.get('latency_ms'),
                    'result_chars': len(result.get('text') or ''),
                    'error': result.get('error'),
                }
            )
            tool_content = result.get('text') or result.get('error') or ''
            msgs.append({'role': 'tool', 'content': tool_content[:12000]})
        if total_tool_calls >= MAX_TOOL_CALLS:
            break

    # Phase B: final JSON schema pass
    final = await chat_completion(
        model=model,
        messages=msgs,
        temperature=temperature,
        schema=eff_schema,
        ollama=ollama_cfg,
    )
    tp += int(final.get('prompt_tokens') or 0)
    tc += int(final.get('completion_tokens') or 0)
    tt += int(final.get('total_tokens') or 0)
    content = final.get('content') or ''
    parsed = recover_json(content) if eff_schema else None
    error = final.get('error')
    parse_failed = bool(eff_schema and parsed is None)
    if eff_schema and parsed is None and not error:
        error = 'schema_parse_failed'

    return {
        'model_used': model,
        'agent': agent,
        'content': content,
        'parsed': parsed,
        'parse_failed': parse_failed,
        'error': error,
        'tool_calls': tool_events,
        'tool_loop_iters': iterations_used,
        'raw': final.get('raw'),
        'prompt_tokens': tp,
        'completion_tokens': tc,
        'total_tokens': tt,
    }

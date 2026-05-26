"""Agent capability lanes — single source for worker routing and dashboard labels."""

from __future__ import annotations

from typing import Any, Literal, TypedDict

AgentLane = Literal['tool_capable', 'prefetch_only', 'reasoning_no_tools']

LANE_LABELS: dict[AgentLane, str] = {
    'tool_capable': 'Tool-capable',
    'prefetch_only': 'Pre-fetch only',
    'reasoning_no_tools': 'Reasoning (no tools)',
}

LANE_DESCRIPTIONS: dict[AgentLane, str] = {
    'tool_capable': (
        'Uses a larger local model that can run an autonomous tool loop (web search, URL read, repo tools). '
        'Final output is still strict JSON from a second formatting pass.'
    ),
    'prefetch_only': (
        'Uses a compact model. Web search and other tools run only when the worker pre-fetches context '
        'before the model call — the model does not invoke tools itself.'
    ),
    'reasoning_no_tools': (
        'Uses a reasoning-oriented model without tool calling. Best for deliberation; '
        'enable optional pre-fetch web search per run if needed.'
    ),
}


class AgentLaneSpec(TypedDict, total=False):
    lane: AgentLane
    default_model: str
    tool_model: str
    tool_allowlist: list[str]
    default_web_search: bool
    default_use_tools: bool


AGENT_LANES: dict[str, AgentLaneSpec] = {
    'pm': {
        'lane': 'tool_capable',
        'default_model': 'llama3.1:8b',
        'tool_model': 'llama3.1:8b',
        'tool_allowlist': ['searxng_web_search', 'web_url_read', 'web_extract'],
        'default_web_search': False,
        'default_use_tools': False,
    },
    'builder': {
        'lane': 'tool_capable',
        'default_model': 'qwen2.5:7b',
        'tool_model': 'qwen2.5:7b',
        'tool_allowlist': [
            'searxng_web_search',
            'web_url_read',
            'web_extract',
            'repo_search',
            'repo_read',
            'repo_summarize',
        ],
        'default_web_search': False,
        'default_use_tools': False,
    },
    'forge': {
        'lane': 'tool_capable',
        'default_model': 'llama3.2:3b',
        'tool_model': 'llama3.2:3b',
        'tool_allowlist': ['searxng_web_search', 'web_url_read', 'web_extract'],
        'default_web_search': True,
        'default_use_tools': False,
    },
    'canon': {
        'lane': 'tool_capable',
        'default_model': 'llama3.2:3b',
        'tool_model': 'llama3.2:3b',
        'tool_allowlist': ['searxng_web_search', 'web_url_read', 'web_extract'],
        'default_web_search': True,
        'default_use_tools': False,
    },
    'synergy': {
        'lane': 'prefetch_only',
        'default_model': 'llama3.2:3b',
        'default_web_search': False,
        'default_use_tools': False,
    },
    'clinic': {
        'lane': 'prefetch_only',
        'default_model': 'llama3.2:3b',
        'default_web_search': False,
        'default_use_tools': False,
    },
    'kitt': {
        'lane': 'prefetch_only',
        'default_model': 'gemma3:270m',
        'default_web_search': False,
        'default_use_tools': False,
    },
    'bubs': {
        'lane': 'prefetch_only',
        'default_model': 'tinyllama:1.1b',
        'default_web_search': False,
        'default_use_tools': False,
    },
    'eddie': {
        'lane': 'reasoning_no_tools',
        'default_model': 'deepseek-r1:1.5b',
        'default_web_search': False,
        'default_use_tools': False,
    },
}


def get_lane_spec(agent: str) -> AgentLaneSpec | None:
    return AGENT_LANES.get(agent)


def agent_lane(agent: str) -> AgentLane | None:
    spec = get_lane_spec(agent)
    return spec['lane'] if spec else None


def default_web_search_for_agent(agent: str) -> bool:
    spec = get_lane_spec(agent)
    return bool(spec and spec.get('default_web_search'))


def default_use_tools_for_agent(agent: str) -> bool:
    spec = get_lane_spec(agent)
    return bool(spec and spec.get('default_use_tools'))


def tool_allowlist_for_agent(agent: str) -> list[str]:
    spec = get_lane_spec(agent)
    if not spec:
        return []
    return list(spec.get('tool_allowlist') or [])


def is_tool_capable(agent: str) -> bool:
    return agent_lane(agent) == 'tool_capable'


def should_use_tool_loop(agent: str, inp: dict | None) -> bool:
    if not is_tool_capable(agent):
        return False
    if inp and isinstance(inp.get('use_tools'), bool):
        return bool(inp['use_tools'])
    if inp and str(inp.get('use_tools', '')).strip().lower() in ('1', 'true', 'yes'):
        return True
    if inp and str(inp.get('use_tools', '')).strip().lower() in ('0', 'false', 'no'):
        return False
    return default_use_tools_for_agent(agent)


def lanes_public_catalog() -> list[dict[str, Any]]:
    out: list[dict[str, Any]] = []
    for key, spec in sorted(AGENT_LANES.items()):
        lane = spec['lane']
        out.append(
            {
                'agent_key': key,
                'lane': lane,
                'lane_label': LANE_LABELS[lane],
                'lane_description': LANE_DESCRIPTIONS[lane],
                'default_model': spec.get('default_model'),
                'tool_model': spec.get('tool_model'),
                'tool_allowlist': spec.get('tool_allowlist') or [],
                'default_web_search': spec.get('default_web_search', False),
                'default_use_tools': spec.get('default_use_tools', False),
            }
        )
    return out

"""Mirror of agent-worker lane metadata for model-router tool allowlists."""

from __future__ import annotations

AGENT_TOOL_ALLOWLIST: dict[str, list[str]] = {
    'pm': ['searxng_web_search', 'web_url_read', 'web_extract'],
    'builder': [
        'searxng_web_search',
        'web_url_read',
        'web_extract',
        'repo_search',
        'repo_read',
        'repo_summarize',
    ],
    'forge': ['searxng_web_search', 'web_url_read', 'web_extract'],
    'canon': ['searxng_web_search', 'web_url_read', 'web_extract'],
}

def tool_allowlist_for_agent(agent: str) -> list[str]:
    return list(AGENT_TOOL_ALLOWLIST.get(agent, []))


def tool_model_for_agent(agent: str, default: str) -> str:
    """Tool loops use MODEL_MAP (from .env); no hardcoded override."""
    return default

import pytest

from router.tool_registry import ollama_tool_definitions, _parse_tool_args


def test_ollama_tool_defs_allowlist():
    tools = ollama_tool_definitions(['searxng_web_search', 'repo_search'])
    names = [t['function']['name'] for t in tools]
    assert names == ['searxng_web_search', 'repo_search']


def test_parse_tool_args_json_string():
    assert _parse_tool_args('{"query": "x"}') == {'query': 'x'}

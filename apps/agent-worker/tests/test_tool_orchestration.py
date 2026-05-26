from worker.agent_lanes import should_use_tool_loop, agent_lane, default_web_search_for_agent


def format_web_search_block(results):
    """Inline copy for unit test without DB deps."""
    if not results:
        return ''
    lines = ['## Web_search_facts', '', 'App-supplied web search snippets (cite as [S1], [S2], …):', '']
    for i, r in enumerate(results, start=1):
        lines.append(f'[S{i}] {r.get("title", "")}')
        if r.get('url'):
            lines.append(f'    URL: {r["url"]}')
    return '\n'.join(lines)


def test_kitt_not_tool_loop():
    assert should_use_tool_loop('kitt', {}) is False
    assert agent_lane('kitt') == 'prefetch_only'


def test_forge_tool_loop_opt_in():
    assert should_use_tool_loop('forge', {'use_tools': True}) is True
    assert should_use_tool_loop('forge', {}) is False


def test_forge_default_web_search():
    assert default_web_search_for_agent('forge') is True


def test_format_web_search_block():
    block = format_web_search_block(
        [{'title': 'T', 'url': 'https://ex.com', 'snippet': 'hi'}]
    )
    assert '## Web_search_facts' in block
    assert '[S1]' in block
    assert 'https://ex.com' in block

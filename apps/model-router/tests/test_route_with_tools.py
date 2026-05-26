from router.agent_lanes import tool_allowlist_for_agent, tool_model_for_agent


def test_pm_allowlist_has_search():
    assert 'searxng_web_search' in tool_allowlist_for_agent('pm')


def test_builder_has_repo_tools():
    al = tool_allowlist_for_agent('builder')
    assert 'repo_search' in al
    assert 'searxng_web_search' in al


def test_tool_model_uses_model_map_default():
    assert tool_model_for_agent('pm', 'llama3.1:8b') == 'llama3.1:8b'

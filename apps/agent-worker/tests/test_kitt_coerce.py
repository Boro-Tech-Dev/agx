"""KITT shape coercion before PM sanitization (string lists, summary JSON blobs)."""

from worker.workflows.kitt_router_shape import kitt_coerce_router_shape
from worker.workflows.pm_structured_cleanup import sanitize_pm_placeholder_rows


def test_coerce_string_tasks_survives_sanitize():
    out = {
        'summary': 'Short summary.',
        'tasks': ['Do the thing', 'Ship v1'],
        'risks': [],
        'costs': [],
        'anomalies': [],
        'recommended_next_actions': [],
    }
    assert kitt_coerce_router_shape(out)
    sanitize_pm_placeholder_rows(out)
    assert len(out['tasks']) == 2
    assert out['tasks'][0]['title'] == 'Do the thing'
    assert out['tasks'][1]['title'] == 'Ship v1'


def test_coerce_string_risks_survives_sanitize():
    out = {
        'summary': 'x',
        'tasks': [],
        'risks': ['Slip risk'],
        'costs': [],
        'anomalies': [],
        'recommended_next_actions': [],
    }
    assert kitt_coerce_router_shape(out)
    sanitize_pm_placeholder_rows(out)
    assert len(out['risks']) == 1
    assert out['risks'][0]['risk'] == 'Slip risk'


def test_pop_registry_echo_keys():
    out = {
        'summary': 's',
        'project_registry_facts': {'foo': 1},
        'tasks': [{'title': 't', 'description': None}],
        'risks': [],
        'costs': [],
        'anomalies': [],
        'recommended_next_actions': [],
    }
    assert kitt_coerce_router_shape(out)
    assert 'project_registry_facts' not in out


def test_summary_fence_extracts_and_merges_lists():
    inner = (
        '{"summary": "Real summary text.", "tasks": ["A", "B"], '
        '"risks": ["R1"], "recommended_next_actions": ["Next"]}'
    )
    blob = f'```json\n{inner}\n```'
    out = {
        'summary': blob,
        'tasks': [],
        'risks': [],
        'costs': [],
        'anomalies': [],
        'recommended_next_actions': [],
    }
    assert kitt_coerce_router_shape(out)
    assert out['summary'] == 'Real summary text.'
    assert [t['title'] for t in out['tasks']] == ['A', 'B']
    assert out['risks'][0]['risk'] == 'R1'
    assert out['recommended_next_actions'] == ['Next']
    sanitize_pm_placeholder_rows(out)
    assert len(out['tasks']) == 2


def test_summary_fence_fallback_when_inner_summary_missing():
    inner = '{"tasks": ["Only task"], "risks": []}'
    blob = f'```json\n{inner}\n```'
    out = {
        'summary': blob,
        'tasks': [],
        'risks': [],
        'costs': [],
        'anomalies': [],
        'recommended_next_actions': [],
    }
    assert kitt_coerce_router_shape(out)
    assert not out['summary'].strip().startswith('```')
    assert [t['title'] for t in out['tasks']] == ['Only task']

from .common import context_messages, route_model, fallback, event
from .schemas import PM_SCHEMA_PERSONAL


async def run(run_id, workflow, content, project_key, inp, mems):
    event(
        run_id,
        'workflow.bubs',
        'Bubs personal-mode run',
        {'mode': 'personal', 'project_key': project_key},
    )
    schema = PM_SCHEMA_PERSONAL
    routed = await route_model(
        'bubs',
        workflow,
        context_messages('bubs', content, mems, None),
        schema=schema,
        run_id=run_id,
    )
    if routed.get('parse_failed') and not routed.get('error'):
        routed['error'] = 'Schema parse failed: model-router could not parse JSON output.'
    return routed.get('parsed') or (
        fallback('bubs', content, {}, mems)
        if routed.get('error')
        else {
            'summary': routed.get('content', ''),
            'tasks': [],
            'risks': [],
            'costs': [],
            'anomalies': [],
            'recommended_next_actions': [],
        }
    ), routed

from .common import context_messages, route_model, fallback, event
from .schemas import CLINIC_SCHEMA


async def run(run_id, workflow, content, project_key, inp, mems):
    event(
        run_id,
        'workflow.clinic',
        'H.E.L.P.eR health-record organizing run',
        {'project_key': project_key},
    )
    schema = CLINIC_SCHEMA
    routed = await route_model(
        'clinic',
        workflow,
        context_messages('clinic', content, mems, None),
        schema=schema,
        run_id=run_id,
    )
    if routed.get('parse_failed') and not routed.get('error'):
        routed['error'] = 'Schema parse failed: model-router could not parse JSON output.'
    return routed.get('parsed') or (
        fallback('clinic', content, {}, mems)
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

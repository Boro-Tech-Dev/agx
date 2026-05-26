from .common import context_messages, route_model, fallback
from .tool_orchestration import maybe_route

async def run(run_id, workflow, content, project_key, inp, mems):
    routed = await maybe_route(
        'forge',
        workflow,
        context_messages('forge', content, mems),
        run_id=run_id,
        inp=inp,
        route_model_fn=route_model,
    )
    return routed.get('parsed') or (fallback('forge', content, {}, mems) if routed.get('error') else {'portfolio_summary':routed.get('content',''),'opportunities':[],'recommended_next_actions':[]}), routed

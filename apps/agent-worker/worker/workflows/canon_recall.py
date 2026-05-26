from .common import context_messages, route_model, fallback
from .tool_orchestration import maybe_route

async def run(run_id, workflow, content, project_key, inp, mems):
    routed = await maybe_route(
        'canon',
        workflow,
        context_messages('canon', content, mems),
        run_id=run_id,
        inp=inp,
        route_model_fn=route_model,
    )
    return routed.get('parsed') or (fallback('canon', content, {}, mems) if routed.get('error') else {'answer':routed.get('content',''),'confidence':'low','supporting_memories':[],'related_decisions':[],'contradictions_or_uncertainties':['model did not return schema JSON'],'recommended_updates_to_canon':[]}), routed

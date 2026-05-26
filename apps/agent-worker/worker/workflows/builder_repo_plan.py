from .common import context_messages, route_model, fallback, repo_context
from .tool_orchestration import maybe_route

async def run(run_id, workflow, content, project_key, inp, mems):
    repo={}
    try: repo=await repo_context(inp)
    except Exception as e: repo={'tool_error':str(e)}
    routed = await maybe_route(
        'builder',
        workflow,
        context_messages('builder', content, mems, repo),
        run_id=run_id,
        inp=inp,
        route_model_fn=route_model,
    )
    out=routed.get('parsed') or (fallback('builder', content, repo, mems) if routed.get('error') else {'intent':content,'repo_summary':repo,'implementation_plan':[],'files_to_create':[],'files_to_modify':[],'patches':[],'risks':['model did not return schema JSON'],'validation_commands':[],'rollback_notes':['No repo changes applied.']})
    if isinstance(out,dict): out.setdefault('repo_summary', repo)
    return out, routed

from fastapi import FastAPI
from prometheus_fastapi_instrumentator import Instrumentator
import os, json, asyncio, redis, traceback, time, socket
from worker.db import execute, insert_run_events_many, j
from worker.continuation import compose_user_content
from worker.project_registry import (
    REGISTRY_AGENTS,
    build_registry_attachment_async,
    normalize_focus_id_for_retrieval,
)
from worker.project_policy import persist_items_allowed
from worker.web_search_context import should_attach_web_search, search_context
from worker.workflows.common import (
    event,
    hybrid_memory_context,
    hydrate_supporting_memories,
    is_cancelled,
    make_artifact,
    persist_items,
    workspace_key_for_project_worker,
)
from worker.workflows.pm_structured_cleanup import (
    clamp_pm_structured_to_schema_caps,
    dedupe_pm_structured_lists,
    prune_pm_cross_list_duplicates,
    promote_non_question_open_questions_to_tasks,
    sanitize_pm_duplicate_em_dash_phrases,
)
from worker.workflows.router_output_envelope import attach_router_envelope
from worker.workflows import (
    pm_breakdown,
    synergy_breakdown,
    clinic_breakdown,
    builder_repo_plan,
    canon_recall,
    forge_opportunity,
    kitt_breakdown,
    eddie_opportunity,
    bubs_breakdown,
)

app=FastAPI(title='DD Agent Worker', version='0.6.0')
REDIS_URL=os.getenv('REDIS_URL','redis://redis:6379/0')
RUN_QUEUE=os.getenv('RUN_QUEUE','agent.runs')
PROCESSING_QUEUE=os.getenv('PROCESSING_QUEUE','agent.runs.processing')
DEAD_QUEUE=os.getenv('DEAD_QUEUE','agent.runs.dead')
STALE_RUNNING_MINUTES=int(os.getenv('STALE_RUNNING_MINUTES','90'))
MAX_ATTEMPTS=int(os.getenv('RUN_MAX_ATTEMPTS','2'))
stats={'processed':0,'failed':0,'cancelled':0,'active':False,'last_run_id':None,'retried':0,'dead_lettered':0}
WORKFLOWS={
    'pm': pm_breakdown.run,
    'synergy': synergy_breakdown.run,
    'clinic': clinic_breakdown.run,
    'builder': builder_repo_plan.run,
    'canon': canon_recall.run,
    'forge': forge_opportunity.run,
    'kitt': kitt_breakdown.run,
    'eddie': eddie_opportunity.run,
    'bubs': bubs_breakdown.run,
}

def rconn(): return redis.Redis.from_url(REDIS_URL, decode_responses=True)


def _input_bool(inp: dict | None, key: str) -> bool | None:
    """Parse optional tri-state from run input (API may send bool or string)."""
    if not isinstance(inp, dict):
        return None
    v = inp.get(key)
    if v is None:
        return None
    if isinstance(v, bool):
        return v
    s = str(v).strip().lower()
    if s in ('1', 'true', 'yes'):
        return True
    if s in ('0', 'false', 'no'):
        return False
    return None

def recover_stale_runs():
    execute("""update agent_runs set status='failed', error_message='Recovered stale running run after worker restart', completed_at=now()
      where status='running' and started_at < now() - (%s || ' minutes')::interval""", (STALE_RUNNING_MINUTES,))

async def process(payload):
    rid=payload['run_id']; agent=payload['agent_key']; workflow=payload.get('workflow','general'); project_key=payload.get('project_key'); inp=payload.get('input') or {}
    stats.update(active=True,last_run_id=rid)
    if is_cancelled(rid):
        stats['cancelled']+=1; stats['active']=False; return
    wk = workspace_key_for_project_worker(project_key) if project_key else None
    execute('update agent_runs set status=%s,started_at=coalesce(started_at,now()),error_message=null where id=%s and status<>%s',('running',rid,'cancelled'))
    event(rid,'run.started','Worker started run',payload)
    content=compose_user_content(inp)
    focus_raw = inp.get('focus_project_item_id') if isinstance(inp, dict) else None
    registry_block = ''
    parent_rid = inp.get('parent_run_id') if isinstance(inp, dict) else None
    # First PM pass: minimal registry by default — project profile + optional focus only.
    # Timeline rows and open project_items (tasks, risks, prior PM output) add tokens and can bury the user's request.
    # Continuations (parent_run_id) default to full registry; optional input.* overrides for any agent.
    pm_first = agent in ('pm', 'kitt') and not parent_rid
    it_override = _input_bool(inp if isinstance(inp, dict) else None, 'include_registry_timeline')
    if it_override is not None:
        include_timeline = it_override
    else:
        include_timeline = not pm_first
    io_override = _input_bool(inp if isinstance(inp, dict) else None, 'include_registry_open_items')
    if io_override is not None:
        include_open_items = io_override
    else:
        include_open_items = False if pm_first else True
    if project_key and agent in REGISTRY_AGENTS:
        registry_block = await build_registry_attachment_async(
            project_key,
            agent,
            focus_raw,
            include_timeline=include_timeline,
            include_open_items=include_open_items,
        )
        if registry_block:
            content = registry_block + '\n\n' + content
            event(
                rid,
                'project.registry.attached',
                'Project registry snapshot prepended to run content',
                {
                    'chars': len(registry_block),
                    'has_focus': bool(normalize_focus_id_for_retrieval(focus_raw)),
                    'include_timeline': include_timeline,
                    'include_open_items': include_open_items,
                },
            )
    if should_attach_web_search(agent, inp if isinstance(inp, dict) else None):
        ws_query = compose_user_content(inp) or content[:500]
        rer_ov = None
        emb_ov = None
        if isinstance(inp, dict):
            rer_ov = inp.get('reranker_override')
            emb_ov = inp.get('embedder_override')
        ws_block, _ws_rows = await search_context(
            ws_query, n=5, run_id=rid, agent=agent, reranker_override=rer_ov
        )
        if ws_block:
            content = ws_block + '\n\n' + content
            event(rid, 'web.search.attached', 'Web search facts prepended to run content', {'chars': len(ws_block)})
    retrieval_query = content
    if normalize_focus_id_for_retrieval(focus_raw) and include_timeline:
        retrieval_query = (
            content
            + '\nproject timeline owner due date deadline kickoff schedule milestone'
        )
    chunk_exclude: tuple[str, ...] = ()
    if not include_timeline:
        chunk_exclude = ('timeline',)
    skip_mem_embed = _input_bool(inp if isinstance(inp, dict) else None, 'skip_memory_embed') is True
    emb_ov = inp.get('embedder_override') if isinstance(inp, dict) else None
    rer_ov = inp.get('reranker_override') if isinstance(inp, dict) else None
    mems = await hybrid_memory_context(
        retrieval_query,
        project_key,
        12,
        exclude_document_kinds=chunk_exclude,
        run_id=rid,
        skip_memory_embed=skip_mem_embed,
        workspace_key=wk,
        agent=agent,
        embedder_override=emb_ov,
        reranker_override=rer_ov,
    )
    event(rid,'memory.context','Retrieved hybrid memory context',{'count':len(mems),'mode':'keyword+vector_when_available'})
    if is_cancelled(rid):
        event(rid,'run.cancelled','Run cancelled before model request',{})
        stats['cancelled']+=1; stats['active']=False; return
    runner=WORKFLOWS.get(agent)
    if not runner: raise RuntimeError(f'No workflow runner for {agent}')
    event(rid,'workflow.selected',f'Selected {agent} workflow runner',{'workflow':workflow})
    out,routed=await runner(rid,workflow,content,project_key,inp,mems)
    if isinstance(out, dict):
        if isinstance(routed, dict) and routed.get('tool_calls'):
            from worker.workflows.tool_orchestration import allowed_urls_from_router, validate_citations_in_output

            out = validate_citations_in_output(out, allowed_urls_from_router(routed))
        hydrate_supporting_memories(out, mems)
        dedupe_stats = dedupe_pm_structured_lists(out)
        if dedupe_stats.get('removed_total', 0) > 0:
            event(
                rid,
                'workflow.pm.dedupe',
                'Removed duplicate structured list rows before persist',
                j(dedupe_stats),
            )
        promo_stats = promote_non_question_open_questions_to_tasks(out)
        if promo_stats.get('promoted', 0) > 0:
            event(
                rid,
                'workflow.pm.promote_open_questions',
                'Moved non-question open_questions into tasks when tasks were empty',
                j(promo_stats),
            )
            dedupe_after_promo = dedupe_pm_structured_lists(out)
            if dedupe_after_promo.get('removed_total', 0) > 0:
                event(
                    rid,
                    'workflow.pm.dedupe',
                    'Removed duplicate structured list rows after open_question promotion',
                    j(dedupe_after_promo),
                )
        emdash_stats = sanitize_pm_duplicate_em_dash_phrases(out)
        if emdash_stats.get('changed'):
            event(
                rid,
                'workflow.pm.emdash_dedupe',
                'Collapsed duplicated em-dash phrases in string fields',
                j(emdash_stats),
            )
        cross_stats = prune_pm_cross_list_duplicates(out)
        if cross_stats.get('removed_total', 0) > 0:
            event(
                rid,
                'workflow.pm.cross_prune',
                'Removed recommended_next_actions matching task headlines',
                j(cross_stats),
            )
        clamp_stats = clamp_pm_structured_to_schema_caps(out)
        if clamp_stats.get('changed'):
            event(
                rid,
                'workflow.pm.clamp',
                'Clamped structured lists/strings to schema caps before persist',
                j(clamp_stats),
            )
    if is_cancelled(rid):
        event(rid,'run.cancelled','Run cancelled after model response; output discarded',{})
        stats['cancelled']+=1; stats['active']=False; return
    if isinstance(out, dict):
        fb_used = bool(out.pop('_fallback_scaffold', False))
        loose_u = bool(out.pop('_loose_unparsed_marker', False))
        attach_router_envelope(
            out,
            routed if isinstance(routed, dict) else None,
            fallback_used=fb_used,
            loose_unparsed=loose_u,
        )
    err = routed.get('error') if isinstance(routed, dict) else None
    usable_out = out is not None and (not isinstance(out, dict) or bool(out))
    if err and not usable_out:
        status = 'failed'
    elif err and usable_out:
        status = 'degraded'
    else:
        status = 'completed'
    execute('update agent_runs set status=%s,output=%s::jsonb,model_used=%s,completed_at=now(),error_message=%s where id=%s',(status,j(out),routed.get('model_used'),err,rid))
    final_status = status
    closing_events: list[tuple] = []
    if status in ('completed', 'degraded'):
        art = make_artifact(rid, agent, workflow, out, project_key, workspace_key=wk)
        closing_events.append(
            (
                rid,
                'artifact.created',
                'Markdown artifact created',
                j({'artifact_id': art['id'], 'title': art['title']}),
            )
        )
        if persist_items_allowed(project_key):
            persist_failed = persist_items(project_key, rid, out)
            if persist_failed:
                closing_events.append(
                    (
                        rid,
                        'persist_items.partial_failure',
                        f'{persist_failed} project item row(s) failed to persist',
                        j({'failed_count': persist_failed}),
                    )
                )
        else:
            closing_events.append(
                (
                    rid,
                    'persist_items.skipped_log_only_project',
                    'Skipped persisting structured project_items (log-only project or policy)',
                    j({'project_key': project_key}),
                )
            )
        if agent=='builder' and isinstance(out,dict) and out.get('patches'):
            patch_payload={'patches':out.get('patches'),'rollback_notes':out.get('rollback_notes',[]),'validation_commands':out.get('validation_commands',[])}
            patch_art=make_artifact(rid,'builder',workflow+'-patches',patch_payload,project_key,workspace_key=wk)
            approval=execute('insert into approvals(run_id,approval_type,status,requested_action) values(%s,%s,%s,%s::jsonb) returning *',(rid,'builder_patch_bundle','pending',j({'type':'stage_builder_patch_bundle','workflow':workflow,'patch_artifact_id':str(patch_art['id']),'patches':out.get('patches',[]),'validation_commands':out.get('validation_commands',[])})))
            execute('update agent_runs set status=%s,error_message=%s where id=%s',('needs_approval','Builder generated patches; approve to stage an approved patch bundle.',rid))
            closing_events.append(
                (
                    rid,
                    'approval.requested',
                    'Builder patch bundle requires approval',
                    j({'approval_id': str(approval['id']), 'patch_artifact_id': str(patch_art['id'])}),
                )
            )
            final_status = 'needs_approval'
    if final_status == 'needs_approval':
        closing_events.append(
            (rid, 'run.needs_approval', 'Run awaiting builder patch approval', j({'model_used': routed.get('model_used')}))
        )
    elif final_status == 'completed':
        closing_events.append(
            (rid, 'run.completed', 'Run completed', j({'model_used': routed.get('model_used')}))
        )
    elif final_status == 'degraded':
        closing_events.append(
            (
                rid,
                'run.degraded',
                'Run finished with model/router error; output may be fallback or partial',
                j({'model_used': routed.get('model_used'), 'error': err}),
            )
        )
    else:
        closing_events.append(
            (rid, 'run.failed', f'Run {final_status}', j({'model_used': routed.get('model_used')}))
        )
    if closing_events:
        insert_run_events_many(closing_events)
    stats['processed']+=1; stats['active']=False

async def worker_loop():
    # Postgres may not accept connections the instant the container starts; if we fail here
    # the asyncio task exits and no jobs are ever consumed (health still returns 200).
    while True:
        try:
            recover_stale_runs()
            break
        except Exception as e:
            print(f'agent-worker: database not ready ({e}); retrying in 2s…', flush=True)
            await asyncio.sleep(2)
    r = rconn()
    while True:
        raw=None; payload={}
        try:
            raw=await asyncio.to_thread(r.brpoplpush,RUN_QUEUE,PROCESSING_QUEUE,5)
            if not raw:
                await asyncio.sleep(.1); continue
            payload=json.loads(raw)
            await process(payload)
            await asyncio.to_thread(r.lrem, PROCESSING_QUEUE, 1, raw)
        except Exception as e:
            stats['failed']+=1; stats['active']=False
            rid=payload.get('run_id') if isinstance(payload,dict) else None
            attempt=int(payload.get('attempt',1)) if isinstance(payload,dict) else 1
            ev_rows = []
            if rid:
                ev_rows.append(
                    (
                        rid,
                        'worker.error',
                        'Worker failed run',
                        j({'error': str(e), 'attempt': attempt, 'traceback': traceback.format_exc()[-4000:]}),
                    )
                )
            if raw:
                await asyncio.to_thread(r.lrem, PROCESSING_QUEUE, 1, raw)
            if payload and attempt < MAX_ATTEMPTS:
                payload['attempt']=attempt+1; payload['retried_at']=time.time()
                await asyncio.to_thread(r.lpush, RUN_QUEUE, json.dumps(payload,default=str))
                stats['retried']+=1
                if rid:
                    ev_rows.append(
                        (rid, 'worker.retry', 'Run requeued after worker error', j({'next_attempt': attempt + 1}))
                    )
            if ev_rows:
                insert_run_events_many(ev_rows)
            else:
                if raw: await asyncio.to_thread(r.lpush, DEAD_QUEUE, raw)
                stats['dead_lettered']+=1
                if rid:
                    execute('update agent_runs set status=%s,error_message=%s,completed_at=now() where id=%s',('failed',str(e),rid))
            await asyncio.sleep(2)

@app.on_event('startup')
async def start_worker():
    asyncio.create_task(worker_loop())

@app.post('/scenario/compute-scenario-steps')
def post_compute_scenario_steps(body: dict):
    """Forward planner (parity with web-dashboard scenarioPlanner). camelCase JSON body."""
    from worker.scenario_planning import run_scenario_engine_compute

    if not isinstance(body, dict):
        return {'ok': False, 'error': 'JSON body must be an object'}
    return run_scenario_engine_compute(body)


@app.post('/scenario/find-latest-kickoff-for-deadline')
def post_find_latest_kickoff_for_deadline(body: dict):
    """Reverse planner: latest kickoff such that milestone end is on or before deadline."""
    from worker.scenario_planning import run_scenario_engine_find_latest_kickoff

    if not isinstance(body, dict):
        return {'ok': False, 'error': 'JSON body must be an object'}
    return run_scenario_engine_find_latest_kickoff(body)


@app.get('/health')
def health():
    return {
        'ok': True,
        'queue': RUN_QUEUE,
        'processing_queue': PROCESSING_QUEUE,
        'dead_queue': DEAD_QUEUE,
        'stats': stats,
        'version': '0.6.0',
        'hostname': socket.gethostname(),
        'pid': os.getpid(),
    }


Instrumentator(
    should_group_status_codes=True,
    should_instrument_requests_inprogress=True,
).instrument(app).expose(app, include_in_schema=False)

import asyncio
import datetime
import hashlib
import json
import logging
import os
import re
import time

import httpx
from pathlib import Path

from worker.db import (
    count_embedded_document_chunks_for_project_cached,
    execute,
    execute_many,
    fetch,
    insert_run_events_many,
    j,
)

from .prompts import SYSTEMS, system_prompt_pm
from .schemas import SCHEMAS
from .schema_route_key import router_schema_key

log = logging.getLogger(__name__)

# Sentinel: caller did not pass workspace_key (resolve from project_key in DB).
_WK_UNSET = object()

MODEL_ROUTER_URL=os.getenv('MODEL_ROUTER_URL','http://model-router:8085')
TOOL_RUNNER_URL=os.getenv('TOOL_RUNNER_URL','http://tool-runner:8090')
ARTIFACT_ROOT=Path(os.getenv('ARTIFACT_ROOT','/artifacts'))
# Single budget: Ollama chat/embed timeout in model-router; worker waits longer for JSON + retries.
def _llm_chat_timeout_sec() -> float:
    raw = (os.getenv('LLM_CHAT_TIMEOUT_SECONDS', '') or '').strip()
    if raw:
        try:
            v = float(raw)
            return v if v >= 30.0 else 180.0
        except ValueError:
            pass
    try:
        return float(os.getenv('OLLAMA_HTTP_TIMEOUT', '240'))
    except ValueError:
        return 240.0


def _model_router_http_timeout_sec() -> float:
    margin = (os.getenv('MODEL_ROUTER_HTTP_TIMEOUT_MARGIN_SEC', '') or '').strip()
    try:
        m = float(margin) if margin else 60.0
    except ValueError:
        m = 60.0
    override = (os.getenv('MODEL_ROUTER_HTTP_TIMEOUT_SEC', '') or '').strip()
    if override:
        try:
            return max(60.0, float(override))
        except ValueError:
            pass
    return max(90.0, _llm_chat_timeout_sec() + m)


def _hybrid_memory_embed_enabled() -> bool:
    return os.getenv('HYBRID_MEMORY_EMBED', '1').strip().lower() not in ('0', 'false', 'no', 'off')


def _embed_cache_ttl_sec() -> int:
    try:
        return max(0, int(os.getenv('EMBED_CACHE_TTL_SEC', '120')))
    except ValueError:
        return 120


def _embed_cache_enabled() -> bool:
    return os.getenv('EMBED_CACHE_ENABLED', '1').strip().lower() not in ('0', 'false', 'no', 'off')


_redis_cache = None
_redis_cache_failed = False


def _redis_embed_cache():
    """Lazy sync Redis client for embedding cache (optional)."""
    global _redis_cache, _redis_cache_failed
    if _redis_cache_failed:
        return None
    if _redis_cache is not None:
        return _redis_cache
    url = (os.getenv('REDIS_URL', '') or '').strip()
    if not url:
        _redis_cache_failed = True
        return None
    try:
        import redis as redis_mod

        r = redis_mod.Redis.from_url(url, decode_responses=True)
        r.ping()
        _redis_cache = r
        return r
    except Exception:
        log.warning('embed_cache: Redis unavailable, cache disabled', exc_info=True)
        _redis_cache_failed = True
        _redis_cache = None
        return None


def _embed_cache_key(text: str, project_key: str | None) -> str:
    norm = (text or '')[:6000].strip()
    h = hashlib.sha256(norm.encode('utf-8', errors='replace')).hexdigest()[:32]
    pk = (project_key or '_none')[:200]
    dim = int(os.getenv('EMBEDDING_DIM', '768'))
    return f'agentx:emb:{dim}:{pk}:{h}'


def _messages_char_count(messages: list | None) -> int:
    if not messages:
        return 0
    n = 0
    for m in messages:
        if isinstance(m, dict):
            n += len(str(m.get('content') or ''))
    return min(n, 2_000_000)

def event(run_id,event_type,message,payload=None):
    execute('insert into run_events(run_id,event_type,message,payload) values(%s,%s,%s,%s::jsonb)',(run_id,event_type,message,j(payload or {})))

def is_cancelled(run_id):
    rows=fetch('select status from agent_runs where id=%s',(run_id,))
    return bool(rows and rows[0]['status']=='cancelled')

def workspace_key_for_project_worker(project_key):
    if not project_key:
        return None
    rows=fetch(
        """SELECT w.key AS workspace_key FROM projects p
           JOIN brands b ON p.brand_id = b.id
           JOIN clients c ON b.client_id = c.id
           JOIN workspaces w ON c.workspace_id = w.id
           WHERE p.key = %s""",
        (project_key,),
    )
    return rows[0]['workspace_key'] if rows else None

def memory_context(
    query,
    project_key=None,
    limit=12,
    *,
    exclude_document_kinds: tuple[str, ...] = (),
    workspace_key=_WK_UNSET,
):
    q=f'%{(query or "")[:300]}%'
    rows=[]
    if project_key:
        if workspace_key is _WK_UNSET:
            W = workspace_key_for_project_worker(project_key)
        else:
            W = workspace_key
        if W:
            rows=fetch(
                """SELECT id::text,title,body,memory_type,confidence,workspace_key,project_key,'memory' AS source_kind FROM memories
                   WHERE status='active' AND workspace_key=%s
                   AND (project_key IS NULL OR project_key=%s)
                   AND (title ILIKE %s OR body ILIKE %s)
                   ORDER BY updated_at DESC LIMIT %s::int""",
                (W,project_key,q,q,limit),
            )
    try:
        lim_chunks = max(3, limit // 2)
        if project_key:
            excl_sql = ''
            excl_params: list[str] = []
            if exclude_document_kinds:
                excl_sql = ' AND sd.document_kind NOT IN (' + ','.join(['%s'] * len(exclude_document_kinds)) + ')'
                excl_params = list(exclude_document_kinds)
            rows.extend(
                fetch(
                    """SELECT dc.id::text,sd.title,dc.content AS body,'source_chunk' AS memory_type,'medium' AS confidence,NULL AS workspace_key,NULL AS project_key,'document_chunk' AS source_kind
                   FROM document_chunks dc JOIN source_documents sd ON sd.id=dc.document_id
                   WHERE sd.project_key = %s AND dc.content ILIKE %s"""
                    + excl_sql
                    + """ ORDER BY dc.created_at DESC LIMIT %s::int""",
                    (project_key, q, *excl_params, lim_chunks),
                )
            )
        else:
            rows.extend(
                fetch(
                    """SELECT dc.id::text,sd.title,dc.content AS body,'source_chunk' AS memory_type,'medium' AS confidence,NULL AS workspace_key,NULL AS project_key,'document_chunk' AS source_kind
               FROM document_chunks dc JOIN source_documents sd ON sd.id=dc.document_id WHERE dc.content ILIKE %s ORDER BY dc.created_at DESC LIMIT %s""",
                    (q, lim_chunks),
                )
            )
    except Exception as e:
        log.warning('memory_context document_chunk extend failed: %s', e, exc_info=True)
    return rows[:limit]

async def route_model(agent, workflow, messages, schema=None, *, run_id=None):
    sch = schema if schema is not None else SCHEMAS[agent]
    chars = _messages_char_count(messages if isinstance(messages, list) else None)
    t0 = time.monotonic()
    use_schema_key = os.getenv('MODEL_ROUTER_SCHEMA_KEY', '').strip().lower() in ('1', 'true', 'yes')
    sk = router_schema_key(agent, sch) if use_schema_key else None
    route_payload: dict = {'agent': agent, 'task_type': workflow, 'messages': messages}
    if sk:
        route_payload['schema_key'] = sk
    else:
        route_payload['schema'] = sch
    if run_id:
        event(
            run_id,
            'model.router.request',
            'POST /v1/route (model-router)',
            {
                'agent': agent,
                'workflow': workflow,
                'chars_messages': chars,
                'schema_key': sk,
                'schema_inline': bool(sch) and not sk,
            },
        )
    timeout = _model_router_http_timeout_sec()
    async with httpx.AsyncClient(timeout=timeout) as client:
        try:
            res = await client.post(
                f'{MODEL_ROUTER_URL}/v1/route',
                json=route_payload,
            )
            res.raise_for_status()
        except httpx.HTTPStatusError as e:
            body = (e.response.text or '')[:4000]
            elapsed_ms = int((time.monotonic() - t0) * 1000)
            if run_id:
                event(
                    run_id,
                    'model.router.failed',
                    'model-router HTTP error',
                    {'elapsed_ms': elapsed_ms, 'http_status': e.response.status_code, 'body_prefix': body[:800]},
                )
            return {
                'agent': agent,
                'model_used': None,
                'content': '',
                'parsed': None,
                'parse_failed': False,
                'error': f'model-router HTTP {e.response.status_code}: {body}',
            }
        except Exception as e:
            elapsed_ms = int((time.monotonic() - t0) * 1000)
            if run_id:
                event(
                    run_id,
                    'model.router.failed',
                    'model-router request failed',
                    {'elapsed_ms': elapsed_ms, 'error': str(e)[:800]},
                )
            return {
                'agent': agent,
                'model_used': None,
                'content': '',
                'parsed': None,
                'parse_failed': False,
                'error': f'model-router request failed: {e}',
            }

        try:
            data = res.json()
        except Exception as e:
            snippet = (res.text or '')[:4000]
            elapsed_ms = int((time.monotonic() - t0) * 1000)
            if run_id:
                event(
                    run_id,
                    'model.router.failed',
                    'model-router invalid JSON',
                    {'elapsed_ms': elapsed_ms, 'body_prefix': snippet[:800]},
                )
            return {
                'agent': agent,
                'model_used': None,
                'content': '',
                'parsed': None,
                'parse_failed': False,
                'error': f'model-router returned invalid JSON: {e}; body={snippet}',
            }

        if not isinstance(data, dict):
            elapsed_ms = int((time.monotonic() - t0) * 1000)
            if run_id:
                event(run_id, 'model.router.failed', 'model-router non-object JSON', {'elapsed_ms': elapsed_ms})
            return {
                'agent': agent,
                'model_used': None,
                'content': '',
                'parsed': None,
                'parse_failed': False,
                'error': f'model-router returned non-object JSON: {type(data).__name__}',
            }

        # Normalize: ensure required keys exist so downstream workflow logic is deterministic.
        data.setdefault('agent', agent)
        data.setdefault('model_used', None)
        data.setdefault('content', '')
        data.setdefault('parsed', None)
        data.setdefault('parse_failed', False)
        elapsed_ms = int((time.monotonic() - t0) * 1000)
        content_s = data.get('content') if isinstance(data.get('content'), str) else ''
        content_sha256_full = hashlib.sha256(content_s.encode('utf-8', errors='replace')).hexdigest()

        def _tok_int(v):
            try:
                return max(0, int(v))
            except (TypeError, ValueError):
                return 0

        if run_id:
            payload = {
                'elapsed_ms': elapsed_ms,
                'model_used': data.get('model_used'),
                'parse_failed': bool(data.get('parse_failed')),
                'router_error': (data.get('error') or '')[:600] or None,
                'ollama_status': data.get('ollama_status'),
                'ollama_error_excerpt': (data.get('ollama_error_excerpt') or '')[:600] or None,
                'schema_fallback_used': bool(data.get('schema_fallback_used')),
                'grammar_failure_fallback_used': bool(data.get('grammar_failure_fallback_used')),
                'content_chars': len(content_s),
                'content_sha256_preview': content_sha256_full[:16],
                'router_warning_prefix': ((data.get('warning') or '')[:600] or None),
                'prompt_tokens': _tok_int(data.get('prompt_tokens')),
                'completion_tokens': _tok_int(data.get('completion_tokens')),
                'total_tokens': _tok_int(data.get('total_tokens')),
            }
            event(run_id, 'model.router.completed', 'model-router response received', payload)
        return data

async def repo_context(payload):
    rp=payload.get('repo_path') or payload.get('workspace_path') or ''
    if not rp: return {}
    async with httpx.AsyncClient(timeout=60) as client:
        return (await client.post(f'{TOOL_RUNNER_URL}/tools/repo/summarize',json={'path':rp,'max_files':900})).json()

def _fallback_synergy_personal(compact: str):
    return {
        'summary': compact,
        'project_context': 'Fallback: model unavailable; personal-mode scaffold.',
        'assumptions': ['Human review suggested when the model is back.'],
        'open_questions': ['What do you want to capture or decide next?'],
        'decisions': [],
        'tasks': [
            {
                'title': 'Re-run when the model is available',
                'description': 'Retry for a full structured pass.',
                'priority': 'medium',
                'status': 'not_started',
                'owner': None,
                'due_date': None,
                'dependencies': [],
                'acceptance_criteria': ['Run completes'],
            }
        ],
        'risks': [
            {
                'risk': 'Incomplete output while offline',
                'impact': 'medium',
                'likelihood': 'high',
                'mitigation': 'Start local model and rerun.',
            }
        ],
        'costs': [],
        'anomalies': [],
        'reflections': ['Offline fallback only—no qualitative depth yet.'],
        'recommended_next_actions': ['Start Ollama models', 'Rerun workflow'],
    }


def _fallback_clinic(compact: str):
    return {
        'summary': compact,
        'project_context': 'Fallback: model unavailable; informational scaffold only—not clinical advice.',
        'assumptions': ['Local model offline; structured pass unavailable.'],
        'open_questions': ['What should you verify with your licensed clinician when the tool is back online?'],
        'decisions': [],
        'tasks': [
            {
                'title': 'Re-run H.E.L.P.eR when the model is available',
                'description': 'Retry for a full structured organization pass over your records.',
                'priority': 'medium',
                'status': 'not_started',
                'owner': None,
                'due_date': None,
                'dependencies': [],
                'acceptance_criteria': ['Run completes'],
            }
        ],
        'risks': [
            {
                'risk': 'Incomplete record review while offline',
                'impact': 'medium',
                'likelihood': 'high',
                'mitigation': 'Start local Ollama model and rerun; rely on clinicians for decisions.',
            }
        ],
        'costs': [],
        'anomalies': [],
        'reflections': ['Offline fallback—do not use for treatment decisions.'],
        'recommended_next_actions': ['Start Ollama models', 'Rerun workflow', 'Discuss any concerns with your care team'],
    }


def _pm_kitt_diagnostics_first_fallback() -> bool:
    """When true (default), PM/KITT error path uses a minimal scaffold plus ``output['_router']`` preview."""
    return os.getenv('PM_KITT_DIAGNOSTICS_FIRST_FALLBACK', '1').strip().lower() not in ('0', 'false', 'no')


# Router ``error`` codes where we still have model text but strict JSON extraction failed (grammar retry, etc.).
PM_SCHEMA_PARSE_RECOVERY_ERRORS = frozenset(
    {
        'schema_parse_failed',
        'schema_parse_failed_after_fallback',
        'schema_parse_failed_after_grammar_fallback',
    }
)


def pm_like_should_recover_loose_from_parse_failure(routed: dict) -> bool:
    """True when we should show raw model text in a PM-shaped shell instead of the generic offline scaffold."""
    if not isinstance(routed, dict):
        return False
    if not routed.get('parse_failed'):
        return False
    raw = routed.get('content')
    if not (isinstance(raw, str) and raw.strip()):
        return False
    err = routed.get('error')
    return err is None or err in PM_SCHEMA_PARSE_RECOVERY_ERRORS


def pm_like_loose_shell_from_router_content(
    run_id,
    routed: dict,
    raw_content: str,
    user_only: str,
    *,
    workflow_evt_prefix: str,
    loose_unparsed_hint: str,
    post_normalize_pre_sanitize=None,
) -> dict:
    """PM-shaped dict from unparsed router body (normalize, backfill lists, prose merge).

    ``post_normalize_pre_sanitize`` is an optional ``(loose: dict) -> None`` hook (e.g. KITT string→object
    coercion) that runs after :func:`normalize_pm_router_payload` and before
    :func:`sanitize_pm_placeholder_rows`.
    """
    from .pm_prose_sections import merge_prose_sections_into_pm_if_lists_empty
    from .pm_structured_cleanup import (
        attach_parse_warning_if_substantive_summary_empty_core_lists,
        normalize_pm_router_payload,
        pm_lists_effectively_empty,
        sanitize_pm_placeholder_rows,
    )
    from .pm_user_backfill import backfill_pm_lists_from_user_text

    loose = {
        'summary': routed.get('content', ''),
        'tasks': [],
        'risks': [],
        'costs': [],
        'anomalies': [],
        'recommended_next_actions': [],
    }
    normalize_pm_router_payload(loose, raw_content)
    if post_normalize_pre_sanitize is not None:
        post_normalize_pre_sanitize(loose)
    sanitize_pm_placeholder_rows(loose)
    if backfill_pm_lists_from_user_text(loose, user_only):
        event(
            run_id,
            f'{workflow_evt_prefix}.backfill',
            'Structured lists were empty; filled from Update/Cost/Impact lines (unparsed model output)',
            {'user_chars': len(user_only)},
        )
    if merge_prose_sections_into_pm_if_lists_empty(loose):
        event(
            run_id,
            f'{workflow_evt_prefix}.prose_sections',
            'Filled structured lists from markdown sections in model prose',
            {},
        )
    attach_parse_warning_if_substantive_summary_empty_core_lists(loose)
    if pm_lists_effectively_empty(loose):
        if not loose.get('parse_warning'):
            loose['parse_warning'] = loose_unparsed_hint
        loose['_loose_unparsed_marker'] = True
    return loose


def _pm_kitt_fallback_scaffold(compact: str, router_error: str | None) -> dict:
    """PM/KITT error-path scaffold; messaging matches router_error (parse vs transport vs generic).

    Callers must pass **user-only** text for ``compact`` (not worker ``content`` with registry prepended),
    otherwise the summary looks like prompt injection / registry headers.

    Sets ``_fallback_scaffold`` for ``main.process`` / ``attach_router_envelope`` (stripped before persist display paths).
    """
    err_l = (router_error or '').lower()
    parse_like = any(
        x in err_l
        for x in (
            'schema_parse',
            'parse_failed',
            'grammar',
            'could not parse',
            'invalid json',
            'json parse',
            'parse error',
        )
    )
    transport_like = any(
        x in err_l
        for x in (
            'http ',
            'connection',
            'timeout',
            'request failed',
            'refused',
            'unreachable',
            'connecterror',
        )
    )
    ollama_like = 'ollama' in err_l

    if parse_like:
        ctx = (
            'Fallback scaffold: the model returned text that could not be parsed into the required '
            'PM JSON schema (see run error_message).'
        )
        rec = [
            'Retry with a shorter request or less registry context if the parse error repeats',
            'Use a routing profile / model with stronger JSON-schema adherence',
            'Inspect model-router logs for this run_id',
        ]
        risk_note = 'Structured JSON parse failed; output below is a generic scaffold—not model reasoning.'
        mit = 'Adjust prompts or routing; check model-router logs for grammar/schema fallback details.'
    elif transport_like or ollama_like:
        ctx = 'Fallback output because the model endpoint was unreachable or failed before a valid structured reply.'
        rec = ['Start or pull local models', 'Rerun workflow', 'Check model-router and upstream LLM health']
        risk_note = 'Model endpoint unavailable; fallback scaffold only.'
        mit = 'Restore model connectivity, then rerun.'
    else:
        ctx = (
            'Fallback scaffold: the router reported an error and structured PM output was not available '
            '(see run error_message).'
        )
        rec = ['Retry the run', 'Check model-router logs for this run_id', 'Simplify the request if errors repeat']
        risk_note = 'Primary model run did not yield usable structured JSON; scaffold only.'
        mit = 'Review error_message and router configuration, then retry.'

    summary_line = compact or 'No request supplied.'
    marker = {'_fallback_scaffold': True}

    if _pm_kitt_diagnostics_first_fallback():
        return {
            'summary': summary_line,
            'parse_warning': (
                'Router reported an error; structured PM JSON was not produced. '
                'Expand **Model/router diagnostics** below for raw model text (truncated) and hashes.'
            ),
            'project_context': ctx,
            'assumptions': [],
            'open_questions': [],
            'decisions': [],
            'tasks': [],
            'risks': [],
            'costs': [],
            'anomalies': [],
            'recommended_next_actions': rec[:2],
            **marker,
        }

    return {
        'summary': summary_line,
        'project_context': ctx,
        'assumptions': ['Human review required.'],
        'open_questions': ['Who owns this and what is the due date?'],
        'decisions': [],
        'tasks': [
            {
                'title': 'Clarify scope',
                'description': 'Confirm requested outcome, constraints, owner, and deadline.',
                'priority': 'high',
                'status': 'not_started',
                'owner': None,
                'due_date': None,
                'dependencies': [],
                'acceptance_criteria': ['Scope is explicit'],
            }
        ],
        'risks': [
            {
                'risk': risk_note,
                'impact': 'medium',
                'likelihood': 'medium',
                'mitigation': mit,
            }
        ],
        'costs': [],
        'anomalies': [],
        'recommended_next_actions': rec,
        **marker,
    }


def fallback(agent, content, repo, mems, pm_kind='business', *, router_error: str | None = None):
    compact = ' '.join((content or '').split()[:90]) or 'No request supplied.'
    if agent in ('synergy', 'bubs'):
        return _fallback_synergy_personal(compact)
    if agent == 'clinic':
        return _fallback_clinic(compact)
    if agent in ('pm', 'kitt'):
        return _pm_kitt_fallback_scaffold(compact, router_error)
    if agent=='builder': return {'intent':compact,'repo_summary':repo or {'detected_stack':[]},'implementation_plan':[{'phase':'Safe implementation pass','goal':'Generate artifacts before repo writes.','steps':['Inspect repo','Create file map','Draft patch artifact','Validate with allowlisted commands'],'files_to_modify':[],'files_to_create':['docs/generated-implementation-plan.md'],'tests':['docker compose config']}],'files_to_create':['artifacts/generated-builder-plan.md'],'files_to_modify':[],'validation_commands':['docker compose config'],'patches':[{'path':'docs/generated-implementation-plan.md','action':'create','content_or_diff':'Generated plan placeholder; rerun with Ollama available for full patch content.'}],'risks':['No model response available.'],'rollback_notes':['No repo changes applied.']}
    if agent=='canon': return {'answer':'Fallback recall for: '+compact,'confidence':'low','supporting_memories':[{'memory_id':m.get('id'),'title':m.get('title'),'excerpt':(m.get('body') or '')[:300],'source_type':m.get('memory_type')} for m in mems[:5]],'related_decisions':[],'contradictions_or_uncertainties':['Model unavailable.'],'recommended_updates_to_canon':['Rerun after Ollama is available.']}
    if agent in ('forge', 'eddie'):
        return {'portfolio_summary':'Fallback opportunity scan.','opportunities':[{'opportunity_name':'Local Agent Platform Stabilizer','category':'internal_tool','problem':compact,'target_user':'operator','why_now':'The platform needs hardening before expansion.','proposed_solution':'Add worker durability, safe tools, approvals, citations, and patch artifacts.','mvp_scope':['queue','events','artifacts','approvals'],'differentiators':['local-first','operator-focused'],'dependencies':['Ollama','Redis','Postgres'],'risks':['limited reasoning without model'],'score':{'pain_level':8,'ease_to_build':8,'revenue_potential':4,'strategic_fit':9,'reuse_of_existing_assets':8,'market_crowding_risk':2,'total':35},'recommended_next_actions':['Pull models and rerun']}],'recommended_next_actions':['Pull local models']}
    return {'portfolio_summary':'Fallback (unknown agent).','opportunities':[],'recommended_next_actions':['Pull models and rerun']}

def md(title,out):
    s=[f'# {title}','','Generated: '+datetime.datetime.now().isoformat(),'']
    if isinstance(out,dict):
        for k in ['summary','answer','portfolio_summary','intent']:
            if out.get(k): s += [f'## {k.replace("_"," ").title()}',str(out[k]),'']
        for k in [
            'tasks',
            'risks',
            'costs',
            'anomalies',
            'reflections',
            'implementation_plan',
            'opportunities',
            'recommended_next_actions',
            'open_questions',
            'files_to_create',
            'files_to_modify',
            'validation_commands',
            'rollback_notes',
            'patches',
            'supporting_memories',
        ]:
            if out.get(k):
                s.append('## '+k.replace('_',' ').title())
                for item in out[k]: s.append('- '+(json.dumps(item,default=str) if isinstance(item,dict) else str(item)))
                s.append('')
    s += ['## Raw JSON','```json',json.dumps(out,indent=2,default=str),'```','']
    return '\n'.join(s)

def make_artifact(run_id, agent, workflow, out, project_key=None, *, workspace_key=_WK_UNSET):
    ARTIFACT_ROOT.mkdir(parents=True,exist_ok=True); slug=re.sub(r'[^a-zA-Z0-9_-]+','-',workflow)[:48] or 'run'; fn=f"{datetime.datetime.now().strftime('%Y-%m-%d_%H%M%S')}__{agent}__{slug}.md"; path=ARTIFACT_ROOT/fn
    body=md(f'{agent.upper()} / {workflow}',out); path.write_text(body)
    art=execute('insert into artifacts(run_id,title,artifact_type,storage_bucket,storage_key,mime_type,metadata) values(%s,%s,%s,%s,%s,%s,%s::jsonb) returning *',(run_id,fn,'markdown','local-artifacts',str(path),'text/markdown',j({'agent_key':agent,'workflow':workflow,'project_key':project_key})))
    if workspace_key is _WK_UNSET:
        wk = workspace_key_for_project_worker(project_key) if project_key else None
    else:
        wk = workspace_key
    if wk:
        execute(
            'INSERT INTO memories(memory_type,title,body,confidence,workspace_key,project_key,source_run_id,metadata) VALUES(%s,%s,%s,%s,%s,%s,%s,%s::jsonb)',
            ('artifact',f'{agent.upper()} / {workflow}',body[:6000],'medium',wk,project_key,run_id,j({'artifact_id':art['id']})),
        )
    return art

def _persist_item_title(list_key, item):
    """Avoid storing list keys ('tasks','risks') as titles when the model omits explicit titles."""
    if isinstance(item, str):
        s = item.strip()
        return (s or list_key.replace('_', ' ').title())[:240]
    if not isinstance(item, dict):
        return (str(item) if item is not None else list_key)[:240]
    for k in ('title', 'risk', 'cost', 'decision', 'opportunity_name', 'question', 'name', 'note', 'anomaly'):
        v = item.get(k)
        if v and str(v).strip():
            return str(v).strip()[:240]
    desc = item.get('description') or item.get('mitigation') or item.get('problem') or item.get('proposed_solution')
    if isinstance(desc, list) and desc:
        desc = '; '.join(str(x) for x in desc[:5] if x is not None)
    if desc and str(desc).strip():
        return str(desc).strip().split('\n')[0][:240]
    ac = item.get('acceptance_criteria')
    if isinstance(ac, list) and ac:
        frag = '; '.join(str(x) for x in ac[:4] if x is not None)
        if frag.strip():
            return frag.strip()[:240]
    for v in item.values():
        if isinstance(v, str) and len(v.strip()) > 12:
            return v.strip().split('\n')[0][:240]
    return f'{typ_label(list_key)} (see body)'[:240]


def typ_label(list_key):
    return {
        'tasks': 'Task',
        'risks': 'Risk',
        'costs': 'Cost',
        'anomalies': 'Anomaly',
        'decisions': 'Decision',
        'open_questions': 'Open question',
        'opportunities': 'Opportunity',
    }.get(list_key, list_key.replace('_', ' ').title())


def persist_items(project_key, run_id, out):
    """Persist structured list items; returns count of insert failures."""
    failed = 0
    if not project_key or not isinstance(out, dict):
        return failed
    sql = (
        'insert into project_items(project_key,item_type,title,body,priority,due_date,owner,source_run_id,metadata) '
        'values(%s,%s,%s,%s,%s,%s,%s,%s,%s::jsonb)'
    )
    batch: list[tuple] = []
    for key, typ in [
        ('tasks', 'task'),
        ('risks', 'risk'),
        ('costs', 'cost'),
        ('anomalies', 'anomaly'),
        ('decisions', 'decision'),
        ('open_questions', 'open_question'),
        ('opportunities', 'idea'),
    ]:
        for item in out.get(key, []) or []:
            title = _persist_item_title(key, item)
            body = json.dumps(item, indent=2, default=str) if isinstance(item, dict) else str(item)
            priority = (item.get('priority') or item.get('impact') or 'medium') if isinstance(item, dict) else 'medium'
            owner = item.get('owner') if isinstance(item, dict) else None
            due = item.get('due_date') if isinstance(item, dict) else None
            batch.append(
                (project_key, typ, title[:240], body, priority, due, owner, run_id, j({'source_key': key})),
            )
    chunk_size = 80
    for i in range(0, len(batch), chunk_size):
        chunk = batch[i : i + chunk_size]
        try:
            execute_many(sql, chunk)
        except Exception as e:
            log.warning(
                'persist_items batch insert failed run_id=%s chunk=%s: %s; falling back to row-by-row',
                run_id,
                len(chunk),
                e,
                exc_info=True,
            )
            for row in chunk:
                try:
                    execute(sql, row)
                except Exception as row_e:
                    failed += 1
                    log.warning(
                        'persist_items insert failed run_id=%s project_key=%s title=%r: %s',
                        run_id,
                        project_key,
                        str(row[2])[:80] if len(row) > 2 else '',
                        row_e,
                        exc_info=True,
                    )
    return failed


def hydrate_supporting_memories(out, mems):
    """Attach title/body from hybrid retrieval when the model only cites memory_id (or sparse fields)."""
    if not isinstance(out, dict):
        return out
    items = out.get('supporting_memories')
    if not isinstance(items, list) or not items:
        return out
    by_id = {str(m['id']): m for m in (mems or []) if m.get('id') is not None}
    for item in items:
        if not isinstance(item, dict):
            continue
        mid = item.get('memory_id') or item.get('id')
        if mid is None:
            continue
        src = by_id.get(str(mid))
        if not src:
            continue
        body = (src.get('body') or '').strip()
        title = (src.get('title') or '').strip()
        cur_title = (item.get('title') or '').strip()
        if not cur_title or cur_title.lower() == 'memory':
            item['title'] = title or cur_title or 'Referenced memory'
        if body:
            item['body'] = body
            if not (item.get('excerpt') or '').strip():
                item['excerpt'] = body
        if not (item.get('source_type') or item.get('memory_type') or item.get('source_kind')):
            item['source_type'] = src.get('memory_type') or src.get('source_kind')
    return out


def context_messages(agent, content, mems, repo=None, pm_kind='business'):
    ctx = '\n\n'.join(
        [f"MEMORY {m['id']} [{m['memory_type']}]: {m['title']}\n{(m.get('body') or '')[:1600]}" for m in mems]
    )
    rb = '\n\nREPO_CONTEXT:\n' + json.dumps(repo, indent=2)[:14000] if repo else ''
    if agent == 'pm':
        system = system_prompt_pm(pm_kind)
    elif agent == 'synergy':
        system = SYSTEMS['synergy']
    elif agent == 'clinic':
        system = SYSTEMS['clinic']
    else:
        system = SYSTEMS[agent]
    return [
        {'role': 'system', 'content': system},
        {'role': 'user', 'content': f'Relevant memory/context:\n{ctx}{rb}\n\nUser request:\n{content}'},
    ]

# Phase 06: hybrid memory retrieval shared by worker workflows.
EMBEDDING_DIM=int(os.getenv('EMBEDDING_DIM','768'))
def vstr(v): return '['+','.join(str(float(x)) for x in v)+']'


async def embedding_for(text, *, run_id=None, project_key=None):
    if not _hybrid_memory_embed_enabled():
        if run_id:
            event(run_id, 'memory.embed.skipped', 'HYBRID_MEMORY_EMBED disabled; keyword memory only', {})
        return None
    snippet = (text or '')[:6000]
    cache_key = _embed_cache_key(snippet, project_key)
    ttl = _embed_cache_ttl_sec()
    r = _redis_embed_cache() if _embed_cache_enabled() and ttl > 0 else None
    if r is not None:
        try:

            def _get():
                return r.get(cache_key)

            cached = await asyncio.to_thread(_get)
            if cached:
                try:
                    emb = json.loads(cached)
                    if isinstance(emb, list) and emb and len(emb) == EMBEDDING_DIM:
                        if run_id:
                            event(
                                run_id,
                                'memory.embed.cache_hit',
                                'Embedding served from Redis cache',
                                {'dim': len(emb)},
                            )
                        return emb
                except (json.JSONDecodeError, TypeError):
                    pass
        except Exception:
            log.warning('embed_cache: get failed', exc_info=True)

    t0 = time.monotonic()
    qchars = len(snippet)
    if run_id:
        event(
            run_id,
            'memory.embed.request',
            'POST /v1/embed (model-router)',
            {'query_chars': qchars},
        )
    try:
        emb_timeout = max(30.0, min(_model_router_http_timeout_sec(), 120.0))
        async with httpx.AsyncClient(timeout=emb_timeout) as client:
            res = await client.post(f'{MODEL_ROUTER_URL}/v1/embed', json={'input': snippet})
            res.raise_for_status()
            data = res.json()
        emb = (data.get('embeddings') or [[]])[0]
        ok = isinstance(emb, list) and bool(emb)
        elapsed_ms = int((time.monotonic() - t0) * 1000)
        if run_id:
            err = (data.get('error') or '')[:500] if isinstance(data, dict) else None
            event(
                run_id,
                'memory.embed.completed',
                'Embedding response received',
                {'elapsed_ms': elapsed_ms, 'dim': len(emb) if ok else 0, 'ok': ok, 'router_error': err},
            )
        if ok and r is not None and ttl > 0:
            try:

                def _set():
                    r.setex(cache_key, ttl, json.dumps(emb))

                await asyncio.to_thread(_set)
            except Exception:
                log.warning('embed_cache: set failed', exc_info=True)
        return emb if ok else None
    except Exception as e:
        elapsed_ms = int((time.monotonic() - t0) * 1000)
        if run_id:
            event(
                run_id,
                'memory.embed.failed',
                'Embedding request failed',
                {'elapsed_ms': elapsed_ms, 'error': str(e)[:800]},
            )
        log.warning('embedding_for failed: %s', e, exc_info=True)
        return None


async def hybrid_memory_context(
    query,
    project_key=None,
    limit=12,
    *,
    exclude_document_kinds: tuple[str, ...] = (),
    run_id=None,
    skip_memory_embed: bool = False,
    workspace_key=_WK_UNSET,
    agent: str | None = None,
    embedder_override: str | None = None,
    reranker_override: str | None = None,
):
    if (
        os.getenv('RETRIEVAL_V2_ENABLED', '1').strip().lower() not in ('0', 'false', 'no')
        and agent
        and agent in ('pm', 'builder', 'forge', 'canon')
    ):
        api = os.getenv('AGENT_API_URL', 'http://agent-api:8080').strip().rstrip('/')
        wk_val = None if workspace_key is _WK_UNSET else workspace_key
        payload = {
            'query': query or '',
            'project_key': project_key,
            'workspace_key': wk_val,
            'limit': limit,
            'agent': agent,
            'embedder_override': embedder_override,
            'reranker_override': reranker_override,
        }
        if not project_key and not wk_val:
            pass
        else:
            try:
                async with httpx.AsyncClient(timeout=60) as client:
                    data = (await client.post(f'{api}/api/memory/search', json=payload)).json()
                rows = data.get('results') or []
                if run_id:
                    event(
                        run_id,
                        'memory.context',
                        'Retrieved memory via retrieval_v2 API',
                        {'count': len(rows), 'agent': agent, 'warnings': data.get('warnings')},
                    )
                return rows[:limit]
            except Exception as e:
                log.warning('hybrid_memory_context API fallback: %s', e, exc_info=True)
    rows = memory_context(
        query,
        project_key,
        limit,
        exclude_document_kinds=exclude_document_kinds,
        workspace_key=workspace_key,
    )
    emb = None
    if not _hybrid_memory_embed_enabled():
        emb = await embedding_for(query or '', run_id=run_id, project_key=project_key)
    else:
        skip_vector = False
        skip_reason = None
        if skip_memory_embed:
            skip_vector = True
            skip_reason = 'skip_memory_embed'
        elif project_key:
            n_chunk = count_embedded_document_chunks_for_project_cached(project_key)
            if n_chunk == 0:
                skip_vector = True
                skip_reason = 'no_embedded_chunks'
        if skip_vector:
            if run_id:
                event(
                    run_id,
                    'memory.embed.skipped',
                    'Hybrid memory skipped vector embed',
                    {'reason': skip_reason},
                )
        else:
            emb = await embedding_for(query or '', run_id=run_id, project_key=project_key)
    if emb and len(emb)==EMBEDDING_DIM:
        try:
            vec=vstr(emb)
            if project_key:
                excl_sql = ''
                excl_params: list[str] = []
                if exclude_document_kinds:
                    excl_sql = ' AND sd.document_kind NOT IN (' + ','.join(['%s'] * len(exclude_document_kinds)) + ')'
                    excl_params = list(exclude_document_kinds)
                vr=fetch(
                    """select dc.id::text,sd.title,dc.content as body,'source_chunk' as memory_type,'medium' as confidence,null as workspace_key,null as project_key,'vector_chunk' as source_kind,(dc.embedding <=> %s::vector) as distance
              from document_chunks dc join source_documents sd on sd.id=dc.document_id
              where dc.embedding is not null and sd.project_key = %s"""
                    + excl_sql
                    + """ order by dc.embedding <=> %s::vector limit %s::int""",
                    (vec, project_key, *excl_params, vec, limit),
                )
            else:
                vr=fetch("""select dc.id::text,sd.title,dc.content as body,'source_chunk' as memory_type,'medium' as confidence,null as workspace_key,null as project_key,'vector_chunk' as source_kind,(dc.embedding <=> %s::vector) as distance
              from document_chunks dc join source_documents sd on sd.id=dc.document_id where dc.embedding is not null order by dc.embedding <=> %s::vector limit %s::int""",(vec,vec,limit))
            seen={r['id'] for r in rows}
            rows.extend([r for r in vr if r['id'] not in seen])
        except Exception as e:
            log.warning('hybrid_memory_context vector extend failed: %s', e, exc_info=True)
    # When the retrieval_v2 API call failed (above) but rerank should apply, rerank locally
    # so Phase 2 rerankers (BGE / Jina / ColBERT) still get exercised on partial outages.
    rows = await _rerank_rows_local(
        query or '',
        rows[:limit],
        agent=agent,
        reranker_override=reranker_override,
        run_id=run_id,
    )
    return rows[:limit]


_TOOL_CAPABLE_AGENTS_LOCAL = frozenset({'pm', 'builder', 'forge', 'canon'})


async def _rerank_rows_local(
    query: str,
    rows: list,
    *,
    agent: str | None,
    reranker_override: str | None,
    run_id: str | None,
) -> list:
    """Local rerank fallback when agent-api /api/memory/search is unreachable.

    Skipped when the agent is not tool-capable or RETRIEVAL_V2_ENABLED is off.
    Network failure leaves the original row order unchanged.
    """
    if not rows or not agent or agent not in _TOOL_CAPABLE_AGENTS_LOCAL:
        return rows
    if os.getenv('RETRIEVAL_V2_ENABLED', '1').strip().lower() in ('0', 'false', 'no'):
        return rows
    reranker_id = (reranker_override or '').strip()
    if not reranker_id:
        try:
            api = os.getenv('AGENT_API_URL', 'http://agent-api:8080').strip().rstrip('/')
            async with httpx.AsyncClient(timeout=5) as client:
                cfg = (await client.get(f'{api}/api/admin/retrieval/agents')).json()
            for a in cfg.get('agents') or []:
                if a.get('agent') == agent:
                    reranker_id = a.get('reranker_id') or ''
                    break
        except Exception:
            reranker_id = 'colbert_gte_modern'
    if not reranker_id or reranker_id == 'off':
        return rows
    docs = []
    for r in rows:
        title = (r.get('title') or '').strip()
        body = (r.get('body') or '')[:2000]
        docs.append(f'{title}\n{body}'.strip() or body)
    try:
        api_url = os.getenv('MODEL_ROUTER_URL', 'http://model-router:8085').strip().rstrip('/')
        async with httpx.AsyncClient(timeout=45) as client:
            data = (
                await client.post(
                    f'{api_url}/v1/rerank',
                    json={'query': query, 'documents': docs, 'reranker_id': reranker_id},
                )
            ).json()
        ranked = data.get('ranked') or []
        reordered = []
        seen: set[int] = set()
        for item in ranked:
            try:
                idx = int(item.get('index'))
            except (TypeError, ValueError):
                continue
            if 0 <= idx < len(rows) and idx not in seen:
                seen.add(idx)
                reordered.append(rows[idx])
        for i in range(len(rows)):
            if i not in seen:
                reordered.append(rows[i])
        if run_id:
            event(
                run_id,
                'memory.rerank.local',
                'Hybrid memory rerank applied locally (API fallback path)',
                {'reranker_id': reranker_id, 'backend': data.get('backend_used'), 'n': len(rows)},
            )
        return reordered or rows
    except Exception as e:
        if run_id:
            event(
                run_id,
                'memory.rerank.local.failed',
                'Local rerank fallback failed; keeping merge order',
                {'error': str(e)[:400]},
            )
        return rows

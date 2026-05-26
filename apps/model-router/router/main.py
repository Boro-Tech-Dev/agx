import asyncio
import json
import logging
import os
import time
from typing import Any, Literal

import httpx
from fastapi import FastAPI, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, ConfigDict, Field
from prometheus_fastapi_instrumentator import Instrumentator

from router.embedder_catalog import list_embedders, resolve_embedder
from router.hybrid import OllamaConfig, chat_completion, embeddings
from router.json_recovery import recover_json
from router.rerank import rerank as rerank_documents
from router.reranker_catalog import list_rerankers
from router.schema_registry import SCHEMA_BY_KEY

log = logging.getLogger(__name__)

app = FastAPI(title='DD Model Router', version='0.6.0')

class Message(BaseModel):
    role: Literal['system','user','assistant']
    content: str
class RouteRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    agent: Literal['pm','synergy','clinic','builder','canon','forge','kitt','eddie','bubs']='pm'
    task_type: str='general'
    messages: list[Message]
    schema_: dict[str, Any] | None = Field(default=None, alias='schema')
    schema_key: str | None = None
    model_override: str | None = None
    temperature_override: float | None = None
class RouteWithToolsRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    agent: Literal['pm', 'synergy', 'clinic', 'builder', 'canon', 'forge', 'kitt', 'eddie', 'bubs'] = 'pm'
    task_type: str = 'general'
    messages: list[Message]
    schema_: dict[str, Any] | None = Field(default=None, alias='schema')
    schema_key: str | None = None
    model_override: str | None = None
    temperature_override: float | None = None
    tools: list[str] | None = None
    max_iters: int | None = Field(default=None, ge=1, le=8)


class EmbedRequest(BaseModel):
    input: str|list[str]
    model_override: str|None=None
    embedder_id: str|None=None


class RerankRequest(BaseModel):
    query: str = Field(..., min_length=1, max_length=2000)
    documents: list[str] = Field(default_factory=list, max_length=100)
    reranker_id: str = 'colbert_gte_modern'


class OllamaPullRequest(BaseModel):
    model: str = Field(..., min_length=1, max_length=220)

def _builder_model() -> str:
    # Bot the Builder → Ollama Qwen 2.5 instruct by default; override with DEFAULT_BUILDER_MODEL.
    # DEFAULT_CODE_MODEL remains a legacy fallback when DEFAULT_BUILDER_MODEL is unset.
    return (os.getenv('DEFAULT_BUILDER_MODEL') or os.getenv('DEFAULT_CODE_MODEL') or 'qwen2.5:7b').strip() or 'qwen2.5:7b'


MODEL_MAP={
    # Builder: DEFAULT_BUILDER_MODEL, else DEFAULT_CODE_MODEL, else qwen2.5:7b (see _builder_model).
    'pm': os.getenv('DEFAULT_PM_MODEL', 'llama3.1:8b'),
    'synergy': os.getenv('DEFAULT_SYNERGY_MODEL', 'llama3.2:3b'),
    'clinic': os.getenv('DEFAULT_CLINIC_MODEL', 'llama3.2:3b'),
    'builder': _builder_model(),
    'canon': os.getenv('DEFAULT_CANON_MODEL', 'llama3.2:3b'),
    'forge': os.getenv('DEFAULT_FORGE_MODEL', 'llama3.2:3b'),
    'kitt': os.getenv('DEFAULT_KITT_MODEL', 'gemma3:270m'),
    'eddie': os.getenv('DEFAULT_EDDIE_MODEL', 'deepseek-r1:1.5b'),
    'bubs': os.getenv('DEFAULT_BUBS_MODEL', 'tinyllama:1.1b'),
}
TEMP_MAP={
    'pm': 0.2,
    'synergy': 0.25,
    'clinic': 0.2,
    'builder': 0.1,
    'canon': 0.1,
    'forge': 0.4,
    'kitt': 0.2,
    'eddie': 0.4,
    'bubs': 0.25,
}
OLLAMA=os.getenv('OLLAMA_BASE_URL','http://ollama:11434').rstrip('/')
EMBED_MODEL=os.getenv('DEFAULT_EMBED_MODEL','nomic-embed-text')
OLLAMA_PULL_ENABLED=os.getenv('OLLAMA_PULL_ENABLED', 'true').strip().lower() not in ('0', 'false', 'no')

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


OLLAMA_HTTP_TIMEOUT = _llm_chat_timeout_sec()

PM_SCHEMA_FALLBACK = os.getenv('PM_SCHEMA_FALLBACK', '').strip().lower() in ('1', 'true', 'yes')
GRAMMAR_FAILURE_FALLBACK = os.getenv('OLLAMA_GRAMMAR_FAILURE_FALLBACK', '1').strip().lower() not in (
    '0',
    'false',
    'no',
)


def _grammar_fallback_candidate(first_out: dict) -> bool:
    """True when an unstructured retry may bypass a flaky grammar/constrained decode path."""
    if not first_out.get('error'):
        return False
    status = int(first_out.get('ollama_status') or 0)
    if first_out.get('ollama_http_error') and status >= 500:
        return True
    # Transport errors and exhausted retries: error set, no HTTP body / content from Ollama.
    if not first_out.get('ollama_http_error'):
        content = (first_out.get('content') or '').strip()
        if not content:
            return True
    return False
EMBEDDING_DIM=int(os.getenv('EMBEDDING_DIM','0') or '0')
# GET /v1/models runnable probes (chat/embed ping to Ollama). Separate from OLLAMA_HTTP_TIMEOUT used by /v1/route.
OLLAMA_PROBE_TIMEOUT=float(os.getenv('OLLAMA_PROBE_TIMEOUT','90'))
OLLAMA_PROBE_CACHE_TTL_SEC=float(os.getenv('OLLAMA_PROBE_CACHE_TTL_SEC','90'))
OLLAMA_PROBE_CACHE_TTL_FAILED_SEC=float(os.getenv('OLLAMA_PROBE_CACHE_TTL_FAILED_SEC','8'))
OLLAMA_PROBE_CHAT_ENABLED=os.getenv('OLLAMA_PROBE_CHAT','1').strip().lower() not in ('0','false','no')
_OLLAMA_PROBE_CACHE: dict[str, tuple[float, str | None]] = {}
_PROBE_LOCK = asyncio.Lock()

def _ollama_num_ctx() -> int:
    raw = (os.getenv('OLLAMA_NUM_CTX', '') or '').strip()
    try:
        v = int(raw) if raw else 2048
        return v if v > 0 else 2048
    except Exception:
        return 2048

def _installed_covers(required: str, installed: list[str]) -> bool:
    """Match Ollama tag names (e.g. nomic-embed-text:latest)."""
    if required in installed:
        return True
    for name in installed:
        if name.startswith(required + ':'):
            return True
    return False

@app.get('/health')
def health():
    mcp_raw = (os.getenv('MCP_BRIDGE_TARGETS', '') or '').strip()
    mcp_names = [p.split('=', 1)[0].strip() for p in mcp_raw.split(',') if '=' in p]
    return {
        'ok': True,
        'models': MODEL_MAP,
        'temps': TEMP_MAP,
        'ollama': OLLAMA,
        'embed_model': EMBED_MODEL,
        'features': {
            'ollama_pull_enabled': OLLAMA_PULL_ENABLED,
            'ollama_probe_chat': OLLAMA_PROBE_CHAT_ENABLED,
            'ollama_grammar_failure_fallback': GRAMMAR_FAILURE_FALLBACK,
            'pm_schema_fallback': PM_SCHEMA_FALLBACK,
            'kitt_router_grammar_mode': _kitt_router_grammar_mode(),
            'default_embed_model': EMBED_MODEL,
            'embedding_dim': EMBEDDING_DIM,
            'mcp_bridge_enabled': os.getenv('MCP_BRIDGE_ENABLED', '0').strip().lower() in ('1', 'true', 'yes'),
            'mcp_targets': mcp_names,
        },
    }

def _effective_schema(req: RouteRequest) -> dict[str, Any] | None:
    if req.schema_ is not None:
        return req.schema_
    if req.schema_key:
        return SCHEMA_BY_KEY.get(req.schema_key)
    return None


def _ollama_json_schema_format_unreliable(model: str) -> bool:
    """True when Ollama often rejects ``format`` (JSON schema) for this tag.

    Gemma 3 locally returns HTTP 500 ``failed to load model vocabulary required for format``;
    grammar fallback then doubles latency and small models may return sparse JSON. Skip grammar
    for these tags and rely on prompt + :func:`recover_json` instead.
    """
    m = (model or '').lower()
    return 'gemma' in m


def _kitt_router_grammar_mode() -> str:
    """``KITT_ROUTER_GRAMMAR_MODE``: ``never`` (default), ``auto``, or ``always``.

    Controls whether Ollama receives JSON-schema ``format`` for agent ``kitt`` only.
    ``never`` matches Gemma-class triage (unstructured completion + ``recover_json``).
    """
    raw = (os.getenv('KITT_ROUTER_GRAMMAR_MODE', '') or '').strip().lower()
    if raw in ('never', 'auto', 'always'):
        return raw
    return 'never'


def _schema_for_ollama(req: RouteRequest, eff_schema: dict[str, Any] | None, model: str) -> dict[str, Any] | None:
    """JSON schema sent to Ollama ``format``, or None for unstructured completion."""
    if not eff_schema:
        return None
    if req.agent == 'kitt':
        mode = _kitt_router_grammar_mode()
        if mode == 'never':
            return None
        if mode == 'always':
            return eff_schema
        # auto: same as legacy Gemma heuristic
        if _ollama_json_schema_format_unreliable(model):
            return None
        return eff_schema
    if _ollama_json_schema_format_unreliable(model):
        return None
    return eff_schema


def _kitt_route_extras(req: RouteRequest) -> dict[str, Any]:
    if req.agent != 'kitt':
        return {}
    return {'kitt_grammar_mode': _kitt_router_grammar_mode()}


def _route_accum_add(tp: int, tc: int, tt: int, out: dict[str, Any]) -> tuple[int, int, int]:
    return (
        tp + int(out.get('prompt_tokens') or 0),
        tc + int(out.get('completion_tokens') or 0),
        tt + int(out.get('total_tokens') or 0),
    )


def _route_token_fields(tp: int, tc: int, tt: int) -> dict[str, int]:
    return {'prompt_tokens': tp, 'completion_tokens': tc, 'total_tokens': tt}


@app.post('/v1/route')
async def route(req: RouteRequest):
    model = req.model_override or MODEL_MAP[req.agent]
    temp = req.temperature_override if req.temperature_override is not None else TEMP_MAP[req.agent]
    ollama_cfg = OllamaConfig(base_url=OLLAMA, http_timeout=OLLAMA_HTTP_TIMEOUT)
    eff_schema = _effective_schema(req)
    if req.schema_key and eff_schema is None:
        return {
            'model_used': model,
            'agent': req.agent,
            'content': '',
            'parsed': None,
            'parse_failed': False,
            'error': f'Unknown schema_key: {req.schema_key!r} (vendor schemas missing or invalid key)',
            **_route_token_fields(0, 0, 0),
        }
    tp = tc = tt = 0
    extras = _kitt_route_extras(req)
    schema_for_ollama = _schema_for_ollama(req, eff_schema, model)
    first_used_format = bool(schema_for_ollama)
    try:
        out = await chat_completion(
            model=model,
            messages=[m.model_dump() for m in req.messages],
            temperature=temp,
            schema=schema_for_ollama,
            ollama=ollama_cfg,
        )
        tp, tc, tt = _route_accum_add(tp, tc, tt, out)
        if out.get('error'):
            if (
                GRAMMAR_FAILURE_FALLBACK
                and eff_schema
                and first_used_format
                and _grammar_fallback_candidate(out)
            ):
                warn_excerpt = (out.get('error') or '')[:600]
                log.info(
                    'OLLAMA_GRAMMAR_FAILURE_FALLBACK: retrying chat without JSON format agent=%s err_prefix=%r',
                    req.agent,
                    warn_excerpt[:160],
                )
                out2 = await chat_completion(
                    model=model,
                    messages=[m.model_dump() for m in req.messages],
                    temperature=temp,
                    schema=None,
                    ollama=ollama_cfg,
                )
                tp, tc, tt = _route_accum_add(tp, tc, tt, out2)
                if not out2.get('error'):
                    content2 = out2.get('content', '')
                    parsed2 = recover_json(content2) if eff_schema else None
                    if eff_schema.get('type') == 'object' and isinstance(parsed2, dict):
                        return {
                            'model_used': model,
                            'agent': req.agent,
                            'content': content2,
                            'parsed': parsed2,
                            'parse_failed': False,
                            'raw': out2.get('raw'),
                            'grammar_failure_fallback_used': True,
                            **({'warning': warn_excerpt} if warn_excerpt else {}),
                            **extras,
                            **_route_token_fields(tp, tc, tt),
                        }
                    return {
                        'model_used': model,
                        'agent': req.agent,
                        'content': content2,
                        'parsed': parsed2,
                        'parse_failed': bool(eff_schema and parsed2 is None),
                        'raw': out2.get('raw'),
                        'grammar_failure_fallback_used': True,
                        **({'warning': warn_excerpt} if warn_excerpt else {}),
                        **(
                            {'error': 'schema_parse_failed_after_grammar_fallback'}
                            if eff_schema and parsed2 is None
                            else {}
                        ),
                        **extras,
                        **_route_token_fields(tp, tc, tt),
                    }
                log.warning(
                    'OLLAMA_GRAMMAR_FAILURE_FALLBACK: unstructured retry also failed agent=%s second_err=%r',
                    req.agent,
                    (out2.get('error') or '')[:240],
                )
            return {
                'model_used': model,
                'agent': req.agent,
                'content': out.get('content', '') or '',
                'parsed': None,
                'parse_failed': False,
                'error': out['error'],
                'ollama_status': out.get('ollama_status'),
                'ollama_error_excerpt': out.get('ollama_error_excerpt'),
                **extras,
                **_route_token_fields(tp, tc, tt),
            }
        content = out.get('content', '')
        parsed = recover_json(content) if eff_schema else None
        error: str | None = None
        if eff_schema:
            if not (isinstance(content, str) and content.strip()):
                parsed = None
                error = 'empty_model_content'
            elif eff_schema.get('type') == 'object' and parsed is not None and not isinstance(parsed, dict):
                parsed = None
                error = 'schema_type_mismatch'
            elif parsed is None:
                error = 'schema_parse_failed'
        parse_failed = bool(eff_schema and parsed is None)

        if (
            PM_SCHEMA_FALLBACK
            and eff_schema
            and parse_failed
            and isinstance(content, str)
            and content.strip()
            and first_used_format
        ):
            log.info('PM_SCHEMA_FALLBACK: retrying chat without JSON format agent=%s', req.agent)
            out2 = await chat_completion(
                model=model,
                messages=[m.model_dump() for m in req.messages],
                temperature=temp,
                schema=None,
                ollama=ollama_cfg,
            )
            tp, tc, tt = _route_accum_add(tp, tc, tt, out2)
            if not out2.get('error'):
                content2 = out2.get('content', '')
                parsed2 = recover_json(content2) if eff_schema else None
                if eff_schema.get('type') == 'object' and isinstance(parsed2, dict):
                    return {
                        'model_used': model,
                        'agent': req.agent,
                        'content': content2,
                        'parsed': parsed2,
                        'parse_failed': False,
                        'raw': out2.get('raw'),
                        'schema_fallback_used': True,
                        **extras,
                        **_route_token_fields(tp, tc, tt),
                    }
                return {
                    'model_used': model,
                    'agent': req.agent,
                    'content': content2,
                    'parsed': parsed2,
                    'parse_failed': bool(eff_schema and parsed2 is None),
                    'raw': out2.get('raw'),
                    'schema_fallback_used': True,
                    **({'error': 'schema_parse_failed_after_fallback'} if eff_schema and parsed2 is None else {}),
                    **extras,
                    **_route_token_fields(tp, tc, tt),
                }

        return {
            'model_used': model,
            'agent': req.agent,
            'content': content,
            'parsed': parsed,
            'parse_failed': parse_failed,
            'raw': out.get('raw'),
            **({'error': error} if error else {}),
            **extras,
            **_route_token_fields(tp, tc, tt),
        }
    except Exception as e:
        log.exception('route: unexpected error agent=%s', req.agent)
        return {
            'model_used': model,
            'agent': req.agent,
            'content': '',
            'parsed': None,
            'parse_failed': False,
            'error': str(e),
            **extras,
            **_route_token_fields(tp, tc, tt),
        }

@app.post('/v1/route_with_tools')
async def route_with_tools(req: RouteWithToolsRequest):
    from router.agent_lanes import tool_allowlist_for_agent, tool_model_for_agent
    from router.route_with_tools import route_with_tools_handler

    allowlist = req.tools if req.tools is not None else tool_allowlist_for_agent(req.agent)
    model = req.model_override or MODEL_MAP[req.agent]
    if not req.model_override:
        model = tool_model_for_agent(req.agent, model)
    temp = req.temperature_override if req.temperature_override is not None else TEMP_MAP[req.agent]
    ollama_cfg = OllamaConfig(base_url=OLLAMA, http_timeout=OLLAMA_HTTP_TIMEOUT)
    return await route_with_tools_handler(
        agent=req.agent,
        task_type=req.task_type,
        messages=req.messages,
        schema=req.schema_,
        schema_key=req.schema_key,
        model=model,
        temperature=temp,
        tool_allowlist=allowlist,
        max_iters=req.max_iters,
        ollama_cfg=ollama_cfg,
    )


@app.post('/v1/embed')
async def embed(req:EmbedRequest):
    spec = resolve_embedder(req.embedder_id, req.model_override)
    model = spec.ollama_tag
    inputs = req.input if isinstance(req.input, list) else [req.input]
    expected_dim = EMBEDDING_DIM if EMBEDDING_DIM > 0 else spec.dim
    try:
        out = await embeddings(
            model=model,
            inputs=[str(x or '')[:6000] for x in inputs],
            ollama=OllamaConfig(base_url=OLLAMA, http_timeout=OLLAMA_HTTP_TIMEOUT),
        )
        if expected_dim > 0:
            bad = next((v for v in out if not isinstance(v, list) or len(v) != expected_dim), None)
            if bad is not None:
                got = len(bad) if isinstance(bad, list) else None
                return {
                    'model_used': model,
                    'embedder_id': spec.embedder_id,
                    'dim': spec.dim,
                    'embeddings': [],
                    'error': f'Embedding dim mismatch: expected {expected_dim}, got {got}',
                    'expected_dim': expected_dim,
                    'actual_dim': got,
                }
        return {
            'model_used': model,
            'embedder_id': spec.embedder_id,
            'dim': spec.dim,
            'embeddings': out,
        }
    except Exception as e:
        return {
            'model_used': model,
            'embedder_id': spec.embedder_id,
            'dim': spec.dim,
            'embeddings': [],
            'error': str(e),
        }


@app.post('/v1/rerank')
async def rerank_endpoint(req: RerankRequest):
    docs = [str(d or '')[:4000] for d in (req.documents or [])[:100]]
    ollama_cfg = OllamaConfig(base_url=OLLAMA, http_timeout=OLLAMA_HTTP_TIMEOUT)
    return await rerank_documents(req.query, docs, req.reranker_id, ollama=ollama_cfg)


@app.get('/v1/retrieval/catalog')
def retrieval_catalog():
    return {'embedders': list_embedders(), 'rerankers': list_rerankers()}

@app.get('/v1/models')
async def models():
    required_models = sorted(set(list(MODEL_MAP.values()) + [EMBED_MODEL]))
    needed_ollama = required_models

    backends: dict[str, Any] = {
        'ollama': {
            'reachable': None,
            'base_url': OLLAMA,
            'installed': [],
        },
    }

    async def _probe_ollama() -> tuple[list[str], str | None]:
        if not needed_ollama:
            return [], None
        try:
            async with httpx.AsyncClient(timeout=20) as client:
                res = await client.get(f'{OLLAMA}/api/tags')
                res.raise_for_status()
                data = res.json()
            installed = [m.get('name') for m in (data.get('models', []) or []) if m.get('name')]
            return [x for x in installed if isinstance(x, str) and x], None
        except Exception as e:
            return [], str(e)

    ollama_installed, ollama_err = await _probe_ollama()

    backends['ollama']['installed'] = ollama_installed
    backends['ollama']['reachable'] = (ollama_err is None) if needed_ollama else True
    if ollama_err:
        backends['ollama']['error'] = ollama_err

    # Runnable probes: confirm the model can actually serve requests (not just be present in /api/tags).
    async def _ollama_probe(mid: str) -> str | None:
        try:
            async with httpx.AsyncClient(timeout=OLLAMA_PROBE_TIMEOUT) as client:
                if mid == EMBED_MODEL:
                    res = await client.post(f'{OLLAMA}/api/embeddings', json={'model': mid, 'prompt': 'ping'})
                else:
                    res = await client.post(
                        f'{OLLAMA}/api/chat',
                        json={
                            'model': mid,
                            'stream': False,
                            'messages': [{'role': 'user', 'content': 'OK'}],
                            'options': {'temperature': 0.0, 'num_ctx': _ollama_num_ctx()},
                        },
                    )
                res.raise_for_status()
                _ = res.json()
            return None
        except Exception as e:
            return str(e)

    async def _ollama_probe_cached(mid: str) -> str | None:
        now = time.monotonic()
        cached = _OLLAMA_PROBE_CACHE.get(mid)
        if cached is not None:
            exp, err = cached
            if now < exp:
                return err
        async with _PROBE_LOCK:
            now = time.monotonic()
            cached = _OLLAMA_PROBE_CACHE.get(mid)
            if cached is not None:
                exp, err = cached
                if now < exp:
                    return err
            err = await _ollama_probe(mid)
            ttl = OLLAMA_PROBE_CACHE_TTL_SEC if err is None else OLLAMA_PROBE_CACHE_TTL_FAILED_SEC
            _OLLAMA_PROBE_CACHE[mid] = (now + ttl, err)
            return err

    runnable_errors: dict[str, str | None] = {}
    if needed_ollama and (ollama_err is None) and OLLAMA_PROBE_CHAT_ENABLED:
        for m in needed_ollama:
            runnable_errors[m] = await _ollama_probe_cached(m)

    required_rows: list[dict[str, Any]] = []
    all_ok = True
    all_runnable = True
    for mid in required_models:
        satisfied = _installed_covers(mid, ollama_installed)
        run_err = runnable_errors.get(mid)
        runnable = (run_err is None) if satisfied else False
        row: dict[str, Any] = {'id': mid, 'backend': 'ollama', 'satisfied': satisfied, 'runnable': runnable}
        if not satisfied:
            all_ok = False
        if satisfied and run_err:
            all_runnable = False
            row['run_error'] = run_err
        required_rows.append(row)

    ok = True
    if needed_ollama and ollama_err:
        ok = False

    return {
        'ok': ok,
        'models_ready': all_ok,
        'models_runnable': all_runnable if needed_ollama else True,
        'required': required_rows,
        'backends': backends,
        'routes': MODEL_MAP,
        'embed_model': EMBED_MODEL,
        'features': {'ollama_pull_enabled': OLLAMA_PULL_ENABLED},
    }


@app.post('/v1/ollama/pull')
async def ollama_pull(req: OllamaPullRequest):
    if not OLLAMA_PULL_ENABLED:
        raise HTTPException(status_code=403, detail='Ollama pull is disabled (OLLAMA_PULL_ENABLED).')
    name = (req.model or '').strip()
    if not name:
        raise HTTPException(status_code=400, detail='model is required')

    timeout = httpx.Timeout(connect=30.0, read=None, write=60.0, pool=30.0)
    client = httpx.AsyncClient(timeout=timeout)
    try:
        request = client.build_request(
            'POST',
            f'{OLLAMA}/api/pull',
            json={'name': name, 'stream': True},
        )
        res = await client.send(request, stream=True)
        if res.status_code >= 400:
            body = (await res.aread()).decode('utf-8', errors='replace')[:4000]
            await res.aclose()
            await client.aclose()
            raise HTTPException(status_code=res.status_code, detail=body)

        async def gen():
            try:
                async for chunk in res.aiter_bytes():
                    yield chunk
            finally:
                await res.aclose()
                await client.aclose()

        return StreamingResponse(gen(), media_type='application/x-ndjson')
    except HTTPException:
        raise
    except Exception as e:
        try:
            await client.aclose()
        except Exception:
            pass
        raise HTTPException(status_code=502, detail=str(e)) from e


Instrumentator(
    should_group_status_codes=True,
    should_instrument_requests_inprogress=True,
).instrument(app).expose(app, include_in_schema=False)

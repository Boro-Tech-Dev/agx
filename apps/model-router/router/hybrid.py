from __future__ import annotations

import asyncio
import logging
import os
from dataclasses import dataclass
from typing import Any

import httpx

log = logging.getLogger(__name__)

LOG_FULL_MESSAGES = os.getenv("MODEL_ROUTER_LOG_FULL_MESSAGES", "").strip().lower() in (
    "1",
    "true",
    "yes",
    "debug",
)

OLLAMA_CHAT_RETRIES = int(os.getenv("OLLAMA_CHAT_RETRIES", "0") or "0")
if OLLAMA_CHAT_RETRIES < 0:
    OLLAMA_CHAT_RETRIES = 0
if OLLAMA_CHAT_RETRIES > 3:
    OLLAMA_CHAT_RETRIES = 3


@dataclass(frozen=True)
class OllamaConfig:
    base_url: str
    http_timeout: float


def _ollama_num_predict_when_schema() -> int | None:
    """Optional cap on completion tokens when using JSON schema `format`.

    **Default unset:** we do not send ``num_predict`` (matches model-router behavior
    before this knob existed). Forcing ``num_predict`` can change Ollama's sampling
    path; on some platforms (e.g. arm64) that has been observed to correlate with
    runner SIGSEGVs during grammar/constrained decoding.

    Set ``OLLAMA_NUM_PREDICT_SCHEMA`` to a positive integer (e.g. ``3072``) to enable.
    """
    raw = (os.getenv("OLLAMA_NUM_PREDICT_SCHEMA", "") or "").strip()
    if not raw:
        return None
    if raw.lower() in ("0", "-1", "none", "off"):
        return None
    try:
        v = int(raw)
        return v if v > 0 else None
    except ValueError:
        log.warning("OLLAMA_NUM_PREDICT_SCHEMA invalid %r; omitting num_predict", raw)
        return None


def _ollama_num_ctx() -> int | None:
    """
    Cap context size to avoid large KV-cache memory spikes in constrained Docker setups.
    If unset/invalid, default to a conservative value suitable for local Docker.
    """
    raw = (os.getenv("OLLAMA_NUM_CTX", "") or "").strip()
    if not raw:
        return 2048
    try:
        v = int(raw)
        return v if v > 0 else 2048
    except Exception:
        return 2048


def _nonneg_int(v: Any) -> int:
    try:
        if v is None:
            return 0
        n = int(v)
        return n if n > 0 else 0
    except (TypeError, ValueError):
        return 0


def ollama_chat_token_counts(raw: Any) -> tuple[int, int, int]:
    """Ollama /api/chat non-streaming body: prompt_eval_count, eval_count (completion)."""
    if not isinstance(raw, dict):
        return (0, 0, 0)
    prompt = _nonneg_int(raw.get('prompt_eval_count'))
    completion = _nonneg_int(raw.get('eval_count'))
    return (prompt, completion, prompt + completion)


def _log_chat_payload_meta(model: str, messages: list[dict[str, str]], schema: bool) -> None:
    if LOG_FULL_MESSAGES:
        log.debug("ollama_chat_request model=%s schema=%s messages=%s", model, schema, messages)
        return
    total = sum(len(str(m.get("content") or "")) for m in messages)
    log.debug(
        "ollama_chat_request model=%s schema=%s message_count=%s total_chars=%s",
        model,
        schema,
        len(messages),
        total,
    )


async def _post_chat_once(
    *,
    model: str,
    messages: list[dict[str, str]],
    temperature: float,
    schema: dict[str, Any] | None,
    ollama: OllamaConfig,
) -> dict[str, Any]:
    options: dict[str, Any] = {"temperature": temperature}
    num_ctx = _ollama_num_ctx()
    if num_ctx is not None:
        options["num_ctx"] = num_ctx
    if schema:
        np = _ollama_num_predict_when_schema()
        if np is not None:
            options["num_predict"] = np

    payload: dict[str, Any] = {
        "model": model,
        "messages": messages,
        "stream": False,
        "options": options,
    }
    if schema:
        payload["format"] = schema
    _log_chat_payload_meta(model, messages, bool(schema))
    async with httpx.AsyncClient(timeout=ollama.http_timeout) as client:
        res = await client.post(f"{ollama.base_url}/api/chat", json=payload)
    if res.status_code >= 400:
        snippet = (res.text or "")[:800]
        log.warning(
            "ollama_api_chat_http_error model=%s status=%s body_prefix=%r",
            model,
            res.status_code,
            snippet[:500],
        )
        return {
            "content": "",
            "raw": None,
            "ollama_http_error": True,
            "ollama_status": res.status_code,
            "ollama_error_excerpt": snippet[:600],
            "error": f"Ollama HTTP {res.status_code}: {snippet[:400]}",
            "prompt_tokens": 0,
            "completion_tokens": 0,
            "total_tokens": 0,
        }
    try:
        data = res.json()
    except Exception as e:
        snippet = (res.text or "")[:800]
        log.warning(
            "ollama_api_chat_invalid_json model=%s err=%s body_prefix=%r",
            model,
            e,
            snippet[:400],
        )
        return {
            "content": "",
            "raw": None,
            "ollama_http_error": True,
            "ollama_status": res.status_code,
            "ollama_error_excerpt": snippet[:600],
            "error": f"Ollama returned non-JSON: {e}",
            "prompt_tokens": 0,
            "completion_tokens": 0,
            "total_tokens": 0,
        }
    content = (data.get("message") or {}).get("content", "")
    pt, ct, tt = ollama_chat_token_counts(data)
    return {
        "content": content if isinstance(content, str) else "",
        "raw": data,
        "prompt_tokens": pt,
        "completion_tokens": ct,
        "total_tokens": tt,
    }


async def chat_completion(
    *,
    model: str,
    messages: list[dict[str, str]],
    temperature: float,
    schema: dict[str, Any] | None,
    ollama: OllamaConfig,
) -> dict[str, Any]:
    attempts = 1 + OLLAMA_CHAT_RETRIES
    for attempt in range(attempts):
        try:
            last = await _post_chat_once(
                model=model,
                messages=messages,
                temperature=temperature,
                schema=schema,
                ollama=ollama,
            )
        except httpx.RequestError as e:
            log.warning(
                "ollama_chat_transport_error model=%s attempt=%s/%s err=%s",
                model,
                attempt + 1,
                attempts,
                e,
            )
            if attempt + 1 >= attempts:
                return {
                    "content": "",
                    "raw": None,
                    "error": str(e),
                    "prompt_tokens": 0,
                    "completion_tokens": 0,
                    "total_tokens": 0,
                }
            await asyncio.sleep(min(2.0, 0.35 * (2**attempt)))
            continue

        if not last.get("error"):
            return last
        status = int(last.get("ollama_status") or 0)
        if last.get("ollama_http_error") and status >= 500 and attempt + 1 < attempts:
            await asyncio.sleep(min(2.0, 0.35 * (2**attempt)))
            continue
        return last
    return {
        "content": "",
        "raw": None,
        "error": "ollama chat exhausted retries",
        "prompt_tokens": 0,
        "completion_tokens": 0,
        "total_tokens": 0,
    }


async def chat_completion_with_tools(
    *,
    model: str,
    messages: list[dict[str, Any]],
    tools: list[dict[str, Any]],
    temperature: float,
    ollama: OllamaConfig,
) -> dict[str, Any]:
    """Ollama /api/chat with tools= (no JSON schema format)."""
    options: dict[str, Any] = {"temperature": temperature}
    num_ctx = _ollama_num_ctx()
    if num_ctx is not None:
        options["num_ctx"] = num_ctx
    payload: dict[str, Any] = {
        "model": model,
        "messages": messages,
        "tools": tools,
        "stream": False,
        "options": options,
    }
    async with httpx.AsyncClient(timeout=ollama.http_timeout) as client:
        res = await client.post(f"{ollama.base_url}/api/chat", json=payload)
    if res.status_code >= 400:
        snippet = (res.text or "")[:800]
        return {
            "content": "",
            "tool_calls": [],
            "raw": None,
            "error": f"Ollama HTTP {res.status_code}: {snippet[:400]}",
            "prompt_tokens": 0,
            "completion_tokens": 0,
            "total_tokens": 0,
        }
    try:
        data = res.json()
    except Exception as e:
        return {
            "content": "",
            "tool_calls": [],
            "raw": None,
            "error": f"Ollama non-JSON: {e}",
            "prompt_tokens": 0,
            "completion_tokens": 0,
            "total_tokens": 0,
        }
    msg = data.get("message") if isinstance(data, dict) else {}
    if not isinstance(msg, dict):
        msg = {}
    content = msg.get("content") if isinstance(msg.get("content"), str) else ""
    tool_calls = msg.get("tool_calls") if isinstance(msg.get("tool_calls"), list) else []
    pt, ct, tt = ollama_chat_token_counts(data)
    return {
        "content": content,
        "tool_calls": tool_calls,
        "raw": data,
        "prompt_tokens": pt,
        "completion_tokens": ct,
        "total_tokens": tt,
    }


async def embeddings(
    *,
    model: str,
    inputs: list[str],
    ollama: OllamaConfig,
) -> list[list[float]]:
    out: list[list[float]] = []
    options: dict[str, Any] = {}
    num_ctx = _ollama_num_ctx()
    if num_ctx is not None:
        options["num_ctx"] = num_ctx
    async with httpx.AsyncClient(timeout=ollama.http_timeout) as client:
        for i, text in enumerate(inputs):
            payload: dict[str, Any] = {"model": model, "prompt": text}
            if options:
                payload["options"] = options
            res = await client.post(f"{ollama.base_url}/api/embeddings", json=payload)
            if res.status_code >= 400:
                snippet = (res.text or "")[:600]
                log.warning(
                    "ollama_api_embeddings_http_error model=%s idx=%s status=%s body_prefix=%r",
                    model,
                    i,
                    res.status_code,
                    snippet[:400],
                )
            res.raise_for_status()
            emb = res.json().get("embedding", [])
            out.append([float(x) for x in emb] if isinstance(emb, list) else [])
    return out

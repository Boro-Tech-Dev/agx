from __future__ import annotations

import logging
import os
from typing import Any, Dict, List, Literal, Optional

import httpx
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

log = logging.getLogger(__name__)

router = APIRouter(prefix='/api/ask-clarifier', tags=['ask-clarifier'])

AskClarifierMode = Literal['intake', 'feedback', 'timeline', 'scope', 'handoff']
AskClarifierTone = Literal['direct', 'diplomatic', 'internal', 'client_ready']


def _model_router_url() -> str:
    v = os.getenv('MODEL_ROUTER_URL', '').strip()
    return v if v else 'http://model-router:8085'


class AskClarifierBody(BaseModel):
    request_text: str = Field(..., min_length=1, max_length=24000)
    mode: AskClarifierMode = 'intake'
    tone: AskClarifierTone = 'diplomatic'
    project_context: Optional[str] = Field(default=None, max_length=12000)
    known_scope: Optional[str] = Field(default=None, max_length=12000)
    known_timeline: Optional[str] = Field(default=None, max_length=12000)


def _schema() -> Dict[str, Any]:
    return {
        'type': 'object',
        'properties': {
            'request_type': {'type': 'string'},
            'clarity_score': {'type': 'number'},
            'overall_readiness': {'type': 'string', 'enum': ['ready_to_assign', 'needs_clarification', 'high_risk']},
            'summary': {'type': 'string'},
            'clarifying_questions': {
                'type': 'array',
                'items': {
                    'type': 'object',
                    'properties': {
                        'question': {'type': 'string'},
                        'why_it_matters': {'type': 'string'},
                        'risk_if_unanswered': {'type': 'string'},
                        'suggested_owner': {'type': 'string'},
                        'category': {'type': 'string'},
                        'priority': {'type': 'string', 'enum': ['critical', 'important', 'nice_to_have']},
                    },
                    'required': ['question', 'why_it_matters', 'risk_if_unanswered', 'suggested_owner', 'category', 'priority'],
                    'additionalProperties': False,
                },
            },
            'assumptions_to_validate': {
                'type': 'array',
                'items': {
                    'type': 'object',
                    'properties': {
                        'assumption': {'type': 'string'},
                        'confidence': {'type': 'string', 'enum': ['low', 'medium', 'high']},
                        'confirm_with': {'type': 'string'},
                    },
                    'required': ['assumption', 'confidence', 'confirm_with'],
                    'additionalProperties': False,
                },
            },
            'risks': {
                'type': 'array',
                'items': {
                    'type': 'object',
                    'properties': {
                        'risk': {'type': 'string'},
                        'severity': {'type': 'string', 'enum': ['low', 'medium', 'high']},
                        'mitigation': {'type': 'string'},
                    },
                    'required': ['risk', 'severity', 'mitigation'],
                    'additionalProperties': False,
                },
            },
            'recommended_next_step': {'type': 'string'},
            'suggested_reply': {'type': 'string'},
            'internal_handoff_note': {'type': 'string'},
            'missing_inputs': {'type': 'array', 'items': {'type': 'string'}},
        },
        'required': [
            'request_type',
            'clarity_score',
            'overall_readiness',
            'summary',
            'clarifying_questions',
            'assumptions_to_validate',
            'risks',
            'recommended_next_step',
            'suggested_reply',
            'internal_handoff_note',
            'missing_inputs',
        ],
        'additionalProperties': False,
    }


def _clamp_score(value: Any) -> int:
    try:
        n = int(round(float(value)))
    except Exception:
        return 0
    return max(0, min(100, n))


def _clean_str(value: Any, fallback: str = '') -> str:
    out = str(value if value is not None else fallback).strip()
    return out if out else fallback


def _normalize_questions(value: Any) -> List[Dict[str, str]]:
    if not isinstance(value, list):
        return []
    out: List[Dict[str, str]] = []
    for item in value:
        if not isinstance(item, dict):
            continue
        priority = _clean_str(item.get('priority'), 'important')
        if priority not in ('critical', 'important', 'nice_to_have'):
            priority = 'important'
        question = _clean_str(item.get('question'))
        if not question:
            continue
        out.append({
            'question': question,
            'why_it_matters': _clean_str(item.get('why_it_matters'), 'Clarify this before assigning the work.'),
            'risk_if_unanswered': _clean_str(item.get('risk_if_unanswered'), 'The team may make the wrong assumption and create rework.'),
            'suggested_owner': _clean_str(item.get('suggested_owner'), 'PM/Account'),
            'category': _clean_str(item.get('category'), 'intake'),
            'priority': priority,
        })
    return out


def _normalize_assumptions(value: Any) -> List[Dict[str, str]]:
    if not isinstance(value, list):
        return []
    out: List[Dict[str, str]] = []
    for item in value:
        if not isinstance(item, dict):
            continue
        assumption = _clean_str(item.get('assumption'))
        if not assumption:
            continue
        confidence = _clean_str(item.get('confidence'), 'medium')
        if confidence not in ('low', 'medium', 'high'):
            confidence = 'medium'
        out.append({
            'assumption': assumption,
            'confidence': confidence,
            'confirm_with': _clean_str(item.get('confirm_with'), 'PM/Account'),
        })
    return out


def _normalize_risks(value: Any) -> List[Dict[str, str]]:
    if not isinstance(value, list):
        return []
    out: List[Dict[str, str]] = []
    for item in value:
        if not isinstance(item, dict):
            continue
        risk = _clean_str(item.get('risk'))
        if not risk:
            continue
        severity = _clean_str(item.get('severity'), 'medium')
        if severity not in ('low', 'medium', 'high'):
            severity = 'medium'
        out.append({
            'risk': risk,
            'severity': severity,
            'mitigation': _clean_str(item.get('mitigation'), 'Clarify ownership, timing, and scope before assigning.'),
        })
    return out


def _normalize(parsed: Dict[str, Any]) -> Dict[str, Any]:
    readiness = parsed.get('overall_readiness')
    if readiness not in ('ready_to_assign', 'needs_clarification', 'high_risk'):
        readiness = 'needs_clarification'
    return {
        'request_type': _clean_str(parsed.get('request_type'), 'Unclassified request'),
        'clarity_score': _clamp_score(parsed.get('clarity_score')),
        'overall_readiness': readiness,
        'summary': _clean_str(parsed.get('summary'), 'Ask Clarifier generated a structured clarification pass.'),
        'clarifying_questions': _normalize_questions(parsed.get('clarifying_questions')),
        'assumptions_to_validate': _normalize_assumptions(parsed.get('assumptions_to_validate')),
        'risks': _normalize_risks(parsed.get('risks')),
        'recommended_next_step': _clean_str(parsed.get('recommended_next_step'), 'Confirm the missing inputs before assigning the work.'),
        'suggested_reply': _clean_str(parsed.get('suggested_reply')),
        'internal_handoff_note': _clean_str(parsed.get('internal_handoff_note'), 'Do not assign until the key assumptions are confirmed.'),
        'missing_inputs': [str(x).strip() for x in parsed.get('missing_inputs', []) if str(x).strip()] if isinstance(parsed.get('missing_inputs'), list) else [],
    }


@router.post('/analyze')
async def analyze_ask_clarifier(body: AskClarifierBody):
    context_parts: List[str] = []
    if body.project_context:
        context_parts.append(f'Project context:\n{body.project_context.strip()}')
    if body.known_scope:
        context_parts.append(f'Known scope/SOW constraints:\n{body.known_scope.strip()}')
    if body.known_timeline:
        context_parts.append(f'Known timeline constraints:\n{body.known_timeline.strip()}')
    context_block = '\n\n'.join(context_parts) if context_parts else 'No additional project context provided.'

    prompt = f'''
You are Ask Clarifier, an agency project/account management intake analyst.
Your job is to prevent bad assignments by turning vague requests into focused clarification questions.

Mode: {body.mode}
Tone for suggested reply: {body.tone}

Analyze the request as an agency PM/account lead would. Detect missing scope, timing, deliverable, owner, approval, review-round, channel, budget, audience, asset, and decision-maker inputs. Do not overcomplicate tiny asks, but do not let hidden production work slip through.

Return JSON matching the provided schema only.

Rules:
- clarity_score is 0-100 where 100 means ready to assign with almost no clarification.
- Use ready_to_assign only when the request has enough detail to assign safely.
- Use needs_clarification when work can start only after key questions are answered.
- Use high_risk when timeline, scope, approval, or deliverable ambiguity may cause rework or free labor.
- Give 5-10 clarifying questions for vague requests; fewer is fine when the request is already clear.
- Questions should be plain-language and usable in a client or internal reply.
- Suggested reply should be concise and diplomatic, not robotic.
- Internal handoff note can be more direct and should warn the PM/AM what not to assume.

{context_block}

Request to clarify:\n{body.request_text.strip()}
'''.strip()

    payload: Dict[str, Any] = {
        'agent': 'bubs',
        'task_type': 'ask_clarifier',
        'model_override': 'tinyllama:1.1b',
        'messages': [
            {'role': 'system', 'content': 'You are Bubs, a lightweight agency PM/account management intake analyst. Reply only as structured JSON via the schema.'},
            {'role': 'user', 'content': prompt},
        ],
        'schema': _schema(),
    }

    url = f'{_model_router_url().rstrip("/")}/v1/route'
    timeout = httpx.Timeout(connect=30.0, read=240.0, write=60.0, pool=60.0)
    try:
        async with httpx.AsyncClient(timeout=timeout) as client:
            res = await client.post(url, json=payload)
            data = res.json()
    except httpx.HTTPError as e:
        log.warning('ask_clarifier transport error: %s', e)
        raise HTTPException(status_code=502, detail=f'model-router unreachable: {e}') from e

    if res.status_code >= 400:
        detail = data.get('error') if isinstance(data, dict) else str(data)
        raise HTTPException(status_code=502, detail=detail or f'model-router HTTP {res.status_code}')

    parsed = data.get('parsed') if isinstance(data, dict) else None
    if not isinstance(parsed, dict):
        return {
            'request_type': 'Unparsed request',
            'clarity_score': 0,
            'overall_readiness': 'needs_clarification',
            'summary': 'Ask Clarifier could not parse the model response. Try simplifying the request or checking model-router health.',
            'clarifying_questions': [],
            'assumptions_to_validate': [],
            'risks': [],
            'recommended_next_step': 'Retry with a shorter request and any known scope or timing details.',
            'suggested_reply': '',
            'internal_handoff_note': 'No safe handoff note generated because the response did not match the schema.',
            'missing_inputs': [],
            'model_used': data.get('model_used') if isinstance(data, dict) else None,
            'error': data.get('error') if isinstance(data, dict) else 'parse_failed',
            'parse_failed': True,
            'grammar_failure_fallback_used': bool(data.get('grammar_failure_fallback_used')) if isinstance(data, dict) else False,
        }

    out = _normalize(parsed)
    out['model_used'] = data.get('model_used') if isinstance(data, dict) else None
    out['error'] = data.get('error') if isinstance(data, dict) else None
    out['parse_failed'] = bool(data.get('parse_failed')) if isinstance(data, dict) else False
    out['grammar_failure_fallback_used'] = bool(data.get('grammar_failure_fallback_used')) if isinstance(data, dict) else False
    return out

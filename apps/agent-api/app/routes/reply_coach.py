from __future__ import annotations

import logging
import os
from typing import Any, Dict, List, Literal, Optional

import httpx
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

log = logging.getLogger(__name__)

router = APIRouter(prefix='/api/reply-coach', tags=['reply-coach'])

ReplyCoachSituation = Literal[
    'client_pushback',
    'scope_pressure',
    'timeline_pressure',
    'feedback_response',
    'internal_alignment',
    'general',
]
ReplyCoachTone = Literal['diplomatic', 'firm', 'warm', 'executive', 'internal_direct']
ReplyCoachAudience = Literal['client', 'internal', 'vendor', 'mixed']


def _model_router_url() -> str:
    v = os.getenv('MODEL_ROUTER_URL', '').strip()
    return v if v else 'http://model-router:8085'


class ReplyCoachBody(BaseModel):
    message_text: str = Field(..., min_length=1, max_length=24000)
    situation: ReplyCoachSituation = 'general'
    tone: ReplyCoachTone = 'diplomatic'
    audience: ReplyCoachAudience = 'client'
    goal: Optional[str] = Field(default=None, max_length=8000)
    project_context: Optional[str] = Field(default=None, max_length=12000)
    constraints: Optional[str] = Field(default=None, max_length=12000)


def _schema() -> Dict[str, Any]:
    return {
        'type': 'object',
        'properties': {
            'situation_summary': {'type': 'string'},
            'recommended_posture': {'type': 'string'},
            'risk_level': {'type': 'string', 'enum': ['low', 'medium', 'high']},
            'primary_risk': {'type': 'string'},
            'reply_strategy': {'type': 'string'},
            'suggested_reply': {'type': 'string'},
            'short_reply': {'type': 'string'},
            'firm_reply': {'type': 'string'},
            'internal_note': {'type': 'string'},
            'do_not_say': {'type': 'array', 'items': {'type': 'string'}},
            'questions_to_ask': {'type': 'array', 'items': {'type': 'string'}},
            'commitments_to_avoid': {'type': 'array', 'items': {'type': 'string'}},
            'next_steps': {'type': 'array', 'items': {'type': 'string'}},
        },
        'required': [
            'situation_summary',
            'recommended_posture',
            'risk_level',
            'primary_risk',
            'reply_strategy',
            'suggested_reply',
            'short_reply',
            'firm_reply',
            'internal_note',
            'do_not_say',
            'questions_to_ask',
            'commitments_to_avoid',
            'next_steps',
        ],
        'additionalProperties': False,
    }


def _clean_str(value: Any, fallback: str = '') -> str:
    out = str(value if value is not None else fallback).strip()
    return out if out else fallback


def _clean_list(value: Any) -> List[str]:
    if not isinstance(value, list):
        return []
    return [str(x).strip() for x in value if str(x).strip()]


def _normalize(parsed: Dict[str, Any]) -> Dict[str, Any]:
    risk = _clean_str(parsed.get('risk_level'), 'medium')
    if risk not in ('low', 'medium', 'high'):
        risk = 'medium'
    return {
        'situation_summary': _clean_str(parsed.get('situation_summary'), 'Reply Coach generated a response strategy.'),
        'recommended_posture': _clean_str(parsed.get('recommended_posture'), 'Clear, diplomatic, and non-committal until scope and timing are confirmed.'),
        'risk_level': risk,
        'primary_risk': _clean_str(parsed.get('primary_risk'), 'The reply may accidentally commit the team to scope, timing, or quality assumptions that are not confirmed.'),
        'reply_strategy': _clean_str(parsed.get('reply_strategy'), 'Acknowledge the request, clarify what is needed, and avoid committing before team review.'),
        'suggested_reply': _clean_str(parsed.get('suggested_reply')),
        'short_reply': _clean_str(parsed.get('short_reply')),
        'firm_reply': _clean_str(parsed.get('firm_reply')),
        'internal_note': _clean_str(parsed.get('internal_note'), 'Confirm scope, timing, and owner before sending a commitment.'),
        'do_not_say': _clean_list(parsed.get('do_not_say')),
        'questions_to_ask': _clean_list(parsed.get('questions_to_ask')),
        'commitments_to_avoid': _clean_list(parsed.get('commitments_to_avoid')),
        'next_steps': _clean_list(parsed.get('next_steps')),
    }


@router.post('/draft')
async def draft_reply(body: ReplyCoachBody):
    context_parts: List[str] = []
    if body.goal:
        context_parts.append(f'Goal of the reply:\n{body.goal.strip()}')
    if body.project_context:
        context_parts.append(f'Project/account context:\n{body.project_context.strip()}')
    if body.constraints:
        context_parts.append(f'Constraints, scope, timing, politics, or approval notes:\n{body.constraints.strip()}')
    context_block = '\n\n'.join(context_parts) if context_parts else 'No additional project context provided.'

    prompt = f'''
You are Reply Coach inside RagTag. You are Bubs, a lightweight agency PM/account-management response coach.
Your job is to help PMs and Account leads answer difficult client, internal, or vendor messages without overcommitting the team, creating free work, accepting hidden scope, or sounding defensive.

Situation type: {body.situation}
Audience: {body.audience}
Tone: {body.tone}

Return JSON matching the provided schema only.

Rules:
- Write like a calm agency Account/PM lead, not like a generic AI assistant.
- Suggested reply should be ready to paste into email or Teams with minimal editing.
- Short reply should be 1-3 sentences for chat or Teams.
- Firm reply should protect scope/timing more explicitly while staying professional.
- Never promise timing, budget, approval, resource availability, or feasibility unless the user provided it as confirmed.
- Flag hidden commitments and phrases that could create scope creep.
- Include practical next steps a PM or AM can take immediately.
- Do not use pharma-specific language unless it appears in the input.

{context_block}

Message to respond to:\n{body.message_text.strip()}
'''.strip()

    payload: Dict[str, Any] = {
        'agent': 'bubs',
        'task_type': 'reply_coach',
        'model_override': 'tinyllama:1.1b',
        'messages': [
            {'role': 'system', 'content': 'You are Bubs, an agency PM/account response coach. Reply only as structured JSON via the schema.'},
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
        log.warning('reply_coach transport error: %s', e)
        raise HTTPException(status_code=502, detail=f'model-router unreachable: {e}') from e

    if res.status_code >= 400:
        detail = data.get('error') if isinstance(data, dict) else str(data)
        raise HTTPException(status_code=502, detail=detail or f'model-router HTTP {res.status_code}')

    parsed = data.get('parsed') if isinstance(data, dict) else None
    if not isinstance(parsed, dict):
        return {
            'situation_summary': 'Unparsed reply coaching request',
            'recommended_posture': 'Retry with a shorter message or confirm model-router health.',
            'risk_level': 'medium',
            'primary_risk': 'The model response did not match the structured schema.',
            'reply_strategy': 'Do not send an AI-generated reply until the output is safely parsed.',
            'suggested_reply': '',
            'short_reply': '',
            'firm_reply': '',
            'internal_note': 'No safe internal note generated because the response did not match the schema.',
            'do_not_say': [],
            'questions_to_ask': [],
            'commitments_to_avoid': [],
            'next_steps': [],
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

"""Proxy to scenario-worker (or agent-worker fallback) for planner parity with dashboard."""

from __future__ import annotations

from typing import Any

import httpx
from fastapi import APIRouter, HTTPException

from ..config import settings

router = APIRouter(prefix='/api/scenario', tags=['scenario'])


def _scenario_worker_base() -> str:
    primary = (settings.scenario_worker_url or '').strip().rstrip('/')
    if primary:
        return primary
    return settings.agent_worker_url.rstrip('/')


def _post_worker(path: str, body: dict[str, Any]) -> dict[str, Any]:
    base = _scenario_worker_base()
    url = f'{base}{path}'
    try:
        with httpx.Client(timeout=30.0) as client:
            r = client.post(url, json=body)
    except httpx.RequestError as e:
        raise HTTPException(status_code=503, detail=f'scenario worker unreachable: {e}') from e
    if r.status_code >= 400:
        raise HTTPException(status_code=502, detail=r.text or f'worker HTTP {r.status_code}')
    data = r.json()
    if not isinstance(data, dict):
        raise HTTPException(status_code=502, detail='worker returned non-object JSON')
    return data


@router.post('/compute-scenario-steps')
def compute_scenario_steps(body: dict[str, Any]) -> dict[str, Any]:
    """Forward planner; body uses camelCase keys (tactic, anchorStartIso, holidays, …)."""
    return _post_worker('/scenario/compute-scenario-steps', body)


@router.post('/find-latest-kickoff-for-deadline')
def find_latest_kickoff_for_deadline(body: dict[str, Any]) -> dict[str, Any]:
    """Reverse planner; body uses deadlineIso, anchorPhaseId, tactic, …"""
    return _post_worker('/scenario/find-latest-kickoff-for-deadline', body)

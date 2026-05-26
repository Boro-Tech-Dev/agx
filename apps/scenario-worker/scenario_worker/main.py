"""FastAPI entrypoint: scenario compute endpoints only (no Redis queue)."""

from __future__ import annotations

import os
import socket
from typing import Any

from fastapi import FastAPI
from prometheus_fastapi_instrumentator import Instrumentator

VERSION = '0.1.0'

app = FastAPI(title='scenario-worker', version=VERSION)

Instrumentator(
    should_group_status_codes=True,
    should_instrument_requests_inprogress=True,
).instrument(app).expose(app, include_in_schema=False)


@app.post('/scenario/compute-scenario-steps')
def post_compute_scenario_steps(body: dict[str, Any]) -> dict[str, Any]:
    from worker.scenario_planning import run_scenario_engine_compute

    if not isinstance(body, dict):
        return {'ok': False, 'error': 'JSON body must be an object'}
    return run_scenario_engine_compute(body)


@app.post('/scenario/find-latest-kickoff-for-deadline')
def post_find_latest_kickoff_for_deadline(body: dict[str, Any]) -> dict[str, Any]:
    from worker.scenario_planning import run_scenario_engine_find_latest_kickoff

    if not isinstance(body, dict):
        return {'ok': False, 'error': 'JSON body must be an object'}
    return run_scenario_engine_find_latest_kickoff(body)


@app.get('/health')
def health() -> dict[str, Any]:
    return {
        'ok': True,
        'service': 'scenario-worker',
        'version': VERSION,
        'hostname': socket.gethostname(),
        'pid': os.getpid(),
    }

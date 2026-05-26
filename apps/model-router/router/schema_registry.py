"""Load agent JSON schemas from a vendored copy of agent-worker schemas (single source at build time)."""

from __future__ import annotations

import importlib.util
import logging
from pathlib import Path

log = logging.getLogger(__name__)

SCHEMA_BY_KEY: dict[str, dict] = {}


def _load() -> None:
    global SCHEMA_BY_KEY
    path = Path(__file__).resolve().parent.parent / 'vendor' / 'agent_worker_schemas.py'
    if not path.is_file():
        log.warning('schema_registry: missing %s (schema_key disabled)', path)
        SCHEMA_BY_KEY = {}
        return
    spec = importlib.util.spec_from_file_location('agent_worker_schemas', path)
    if spec is None or spec.loader is None:
        SCHEMA_BY_KEY = {}
        return
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    SCHEMA_BY_KEY = {
        'pm_business': mod.PM_SCHEMA_BUSINESS,
        'pm_personal': mod.PM_SCHEMA_PERSONAL,
        'synergy': mod.PM_SCHEMA_PERSONAL,
        'clinic': mod.CLINIC_SCHEMA,
        'builder': mod.BUILDER_SCHEMA,
        'canon': mod.CANON_SCHEMA,
        'forge': mod.FORGE_SCHEMA,
        'kitt': mod.KITT_SCHEMA_TRIAGE,
        'eddie': mod.FORGE_SCHEMA,
        'bubs': mod.PM_SCHEMA_PERSONAL,
    }


_load()

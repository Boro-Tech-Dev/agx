"""Map raw timeline rows to canonical phase_id via model-router JSON schema, with string-match fallback."""

from __future__ import annotations

import json
import logging
import os
from typing import Any

import httpx

from .timeline_phase_catalog import PHASE_ROWS, catalog_prompt_block, phase_by_id

log = logging.getLogger(__name__)

MODEL_ROUTER_URL = os.getenv('MODEL_ROUTER_URL', 'http://model-router:8085')
TIMELINE_MAP_TIMEOUT_SEC = float(os.getenv('TIMELINE_MAP_TIMEOUT_SEC', '240') or '240')
TIMELINE_MAP_MODE = os.getenv('TIMELINE_MAP_MODE', 'llm').strip().lower()

TIMELINE_MAP_SCHEMA: dict[str, Any] = {
    'type': 'object',
    'properties': {
        'mappings': {
            'type': 'array',
            'items': {
                'type': 'object',
                'properties': {
                    'row_index': {'type': 'integer'},
                    'date': {'type': ['string', 'null']},
                    'raw_label': {'type': 'string'},
                    'phase_id': {'type': ['string', 'null']},
                    'confidence': {'type': 'number'},
                },
                'required': ['raw_label', 'row_index'],
            },
        }
    },
    'required': ['mappings'],
}


def _normalize_label_for_match(s: str) -> str:
    t = (s or '').strip().lower().rstrip('.').strip()
    t = t.replace('developement', 'development')
    return t


def _fallback_phase_id(raw_label: str) -> str | None:
    s = _normalize_label_for_match(raw_label)
    if not s:
        return None
    by_label = {_normalize_label_for_match(p['label']): p['phase_id'] for p in PHASE_ROWS}
    if s in by_label:
        return by_label[s]
    for p in PHASE_ROWS:
        pl = _normalize_label_for_match(p['label'])
        if pl and (pl in s or s in pl):
            return p['phase_id']
    for p in PHASE_ROWS:
        pid = p['phase_id'].replace('_', ' ')
        if pid in s:
            return p['phase_id']
    return None


def map_rows_with_llm(
    rows: list[dict],
    *,
    timeout: float | None = None,
) -> list[dict]:
    """
    Each input row: row_index, date_iso, raw_label.
    Returns rows with keys: row_index, date_iso, raw_label, phase_id, phase_order, canonical_label,
    mapping_confidence, unmapped (bool).
    """
    if not rows:
        return []
    parsed: dict | None = None
    if TIMELINE_MAP_MODE == 'fallback_only':
        log.info('timeline map: TIMELINE_MAP_MODE=fallback_only, skipping model-router')
    else:
        catalog = catalog_prompt_block()
        payload_rows = []
        for r in rows:
            row_payload: dict[str, Any] = {
                'row_index': r['row_index'],
                'date': r.get('date_iso'),
                'raw_label': r['raw_label'],
            }
            if r.get('start_date_iso') is not None:
                row_payload['start_date'] = r.get('start_date_iso')
            if r.get('end_date_iso') is not None:
                row_payload['end_date'] = r.get('end_date_iso')
            if r.get('timeline_note'):
                row_payload['note'] = (r.get('timeline_note') or '')[:600]
            payload_rows.append(row_payload)
        payload_json = json.dumps(payload_rows, separators=(',', ':'), ensure_ascii=False)
        user = (
            'Map each spreadsheet row to the best matching phase_id from the catalog, or null if none fits.\n'
            'Use row_index to align output with input. Dates and notes help disambiguate repeated labels like "Revisions".\n\n'
            f'Input rows JSON:\n{payload_json[:16000]}\n\n{catalog}'
        )
        body = {
            'agent': 'pm',
            'task_type': 'timeline_map',
            'temperature_override': 0.1,
            'messages': [
                {'role': 'system', 'content': 'You output only valid JSON matching the schema. No prose.'},
                {'role': 'user', 'content': user},
            ],
            'schema': TIMELINE_MAP_SCHEMA,
        }
        try:
            eff_timeout = float(timeout) if timeout is not None else TIMELINE_MAP_TIMEOUT_SEC
            with httpx.Client(timeout=httpx.Timeout(eff_timeout, connect=15.0)) as client:
                res = client.post(f'{MODEL_ROUTER_URL}/v1/route', json=body)
                data = res.json()
            if data.get('error'):
                log.warning('timeline map route error: %s', data.get('error'))
            elif data.get('parse_failed'):
                log.warning('timeline map parse_failed model=%s', data.get('model_used'))
            else:
                parsed = data.get('parsed') if isinstance(data.get('parsed'), dict) else None
        except Exception:
            log.exception('timeline map HTTP failed')

    by_index: dict[int, dict] = {}
    if parsed and isinstance(parsed.get('mappings'), list):
        for m in parsed['mappings']:
            if not isinstance(m, dict):
                continue
            try:
                idx = int(m.get('row_index', -1))
            except (TypeError, ValueError):
                continue
            pid = m.get('phase_id')
            if pid is not None and not isinstance(pid, str):
                pid = str(pid) if pid is not None else None
            conf = m.get('confidence')
            try:
                conf_f = float(conf) if conf is not None else 0.5
            except (TypeError, ValueError):
                conf_f = 0.5
            by_index[idx] = {'phase_id': pid, 'confidence': conf_f}

    by_id = phase_by_id()
    out: list[dict] = []
    for r in rows:
        idx = int(r['row_index'])
        date_iso = r.get('date_iso')
        raw = r['raw_label']
        chosen = by_index.get(idx)
        phase_id: str | None = None
        conf = 0.4
        if chosen:
            pid = chosen.get('phase_id')
            if isinstance(pid, str) and pid in by_id:
                phase_id = pid
                conf = float(chosen.get('confidence') or 0.7)
        if phase_id is None:
            phase_id = _fallback_phase_id(raw)
            conf = 0.35 if phase_id else 0.0
        if phase_id and phase_id not in by_id:
            phase_id = None
            conf = 0.0
        meta = by_id[phase_id] if phase_id else None
        row_out: dict[str, Any] = {
            'row_index': idx,
            'date_iso': date_iso,
            'raw_label': raw,
            'phase_id': phase_id,
            'phase_order': meta['order'] if meta else None,
            'canonical_label': meta['label'] if meta else None,
            'mapping_confidence': conf,
            'unmapped': phase_id is None,
        }
        for k in ('start_date_iso', 'end_date_iso', 'timeline_note'):
            if r.get(k) is not None:
                row_out[k] = r[k]
        out.append(row_out)
    return out

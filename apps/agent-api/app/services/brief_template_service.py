from __future__ import annotations

import json
from pathlib import Path
from typing import Any

import os

from fastapi import HTTPException, Request

from ..db import conn, execute, fetch, fetch_one, j
from .brief_template_validate import validate_brief_bundle


def _defaults_dir() -> Path:
    return Path(__file__).resolve().parent.parent / 'brief_defaults'


def load_default_bundles() -> tuple[dict[str, Any], dict[str, Any], dict[str, Any]]:
    d = _defaults_dir()
    sk = json.loads((d / 'skeleton.json').read_text(encoding='utf-8'))
    ov = json.loads((d / 'tactic_overrides.json').read_text(encoding='utf-8'))
    pr = json.loads((d / 'presets.json').read_text(encoding='utf-8'))
    return sk, ov, pr


def require_brief_ops_write(request: Request) -> None:
    expected = os.getenv('BRIEF_OPS_TOKEN', '').strip()
    if not expected:
        return
    got = (request.headers.get('x-brief-ops-token') or '').strip()
    if got != expected:
        raise HTTPException(status_code=403, detail='brief ops token required')


def fetch_tactic_keys() -> set[str]:
    rows = fetch('SELECT key FROM tactics', ())
    return {str(r['key']) for r in rows if r.get('key')}


def tactic_keys_for_validation() -> set[str] | None:
    """If tactics library is empty, skip tactic-key checks so templates can be published before seed."""
    keys = fetch_tactic_keys()
    return keys if keys else None


def get_published_bundle() -> dict[str, Any] | None:
    row = fetch_one(
        """
        SELECT b.id, b.version, b.skeleton, b.tactic_overrides, b.presets, b.label, b.created_at
        FROM brief_template_active a
        JOIN brief_template_bundle b ON b.id = a.published_bundle_id
        WHERE a.id = 1 AND a.published_bundle_id IS NOT NULL
        """,
        (),
    )
    if not row:
        return None
    return {
        'bundle_id': str(row['id']),
        'version': row['version'],
        'label': row.get('label'),
        'created_at': row.get('created_at'),
        'skeleton': row['skeleton'],
        'tactic_overrides': row['tactic_overrides'],
        'presets': row['presets'],
    }


def get_draft_row() -> dict[str, Any]:
    row = fetch_one('SELECT skeleton, tactic_overrides, presets, updated_at FROM brief_template_draft WHERE id=1', ())
    if not row:
        sk, ov, pr = load_default_bundles()
        execute(
            'INSERT INTO brief_template_draft (id, skeleton, tactic_overrides, presets) VALUES (1, %s::jsonb, %s::jsonb, %s::jsonb) ON CONFLICT (id) DO NOTHING',
            (j(sk), j(ov), j(pr)),
        )
        row = fetch_one('SELECT skeleton, tactic_overrides, presets, updated_at FROM brief_template_draft WHERE id=1', ())
    assert row
    sk = row.get('skeleton') or {}
    if isinstance(sk, dict) and not sk.get('sections'):
        dsk, dov, dpr = load_default_bundles()
        with conn() as c, c.cursor() as cur:
            cur.execute(
                'UPDATE brief_template_draft SET skeleton=%s::jsonb, tactic_overrides=%s::jsonb, presets=%s::jsonb, updated_at=now() WHERE id=1',
                (j(dsk), j(dov), j(dpr)),
            )
            c.commit()
        row = fetch_one('SELECT skeleton, tactic_overrides, presets, updated_at FROM brief_template_draft WHERE id=1', ())
    assert row
    return row


def put_draft(skeleton: dict[str, Any], tactic_overrides: dict[str, Any], presets: dict[str, Any]) -> dict[str, Any]:
    errs = validate_brief_bundle(skeleton, tactic_overrides, presets, tactic_keys_in_db=tactic_keys_for_validation())
    if errs:
        raise HTTPException(status_code=400, detail={'validation_errors': errs})
    with conn() as c, c.cursor() as cur:
        cur.execute(
            """UPDATE brief_template_draft SET skeleton=%s::jsonb, tactic_overrides=%s::jsonb, presets=%s::jsonb, updated_at=now() WHERE id=1 RETURNING skeleton, tactic_overrides, presets, updated_at""",
            (j(skeleton), j(tactic_overrides), j(presets)),
        )
        out = cur.fetchone()
        c.commit()
    return dict(out)


def patch_draft(payload: dict[str, Any]) -> dict[str, Any]:
    row = get_draft_row()
    sk = payload.get('skeleton', row['skeleton'])
    ov = payload.get('tactic_overrides', row['tactic_overrides'])
    pr = payload.get('presets', row['presets'])
    if not isinstance(sk, dict):
        raise HTTPException(400, 'skeleton must be an object')
    if not isinstance(ov, dict):
        raise HTTPException(400, 'tactic_overrides must be an object')
    if not isinstance(pr, dict):
        raise HTTPException(400, 'presets must be an object')
    return put_draft(sk, ov, pr)


def publish_draft(*, label: str | None = None, notes: str | None = None) -> dict[str, Any]:
    row = get_draft_row()
    sk, ov, pr = row['skeleton'], row['tactic_overrides'], row['presets']
    errs = validate_brief_bundle(sk, ov, pr, tactic_keys_in_db=tactic_keys_for_validation())
    if errs:
        raise HTTPException(status_code=400, detail={'validation_errors': errs})
    with conn() as c, c.cursor() as cur:
        cur.execute('SELECT COALESCE(MAX(version), 0) + 1 AS nv FROM brief_template_bundle')
        nv = int(cur.fetchone()['nv'])
        cur.execute(
            """INSERT INTO brief_template_bundle (version, skeleton, tactic_overrides, presets, label, notes)
               VALUES (%s, %s::jsonb, %s::jsonb, %s::jsonb, %s, %s) RETURNING id, version, created_at""",
            (nv, j(sk), j(ov), j(pr), label, notes),
        )
        ins = cur.fetchone()
        cur.execute(
            'UPDATE brief_template_active SET published_bundle_id=%s, updated_at=now() WHERE id=1',
            (str(ins['id']),),
        )
        c.commit()
    return {'published_bundle_id': str(ins['id']), 'version': ins['version'], 'created_at': ins['created_at']}


def bootstrap_from_defaults_if_empty() -> dict[str, Any] | None:
    if get_published_bundle():
        return None
    sk, ov, pr = load_default_bundles()
    put_draft(sk, ov, pr)
    return publish_draft(label='bootstrap from packaged defaults', notes=None)

"""Transactional CSV import for workspace hierarchy (see docs/workspace_bulk_import.md)."""

from __future__ import annotations

import csv
import io
import json
from typing import Any

from psycopg import errors as pg_errors
from psycopg.rows import dict_row

from ..db import conn, j
from ..project_type_catalog import normalize_project_type
from ..schemas.hierarchy import _slug_key

_ENTITY_ORDER = {'workspace': 0, 'client': 1, 'brand': 2, 'project': 3, 'tactic': 4}
_PM_KINDS = frozenset({'business', 'personal'})
_LIFECYCLE = frozenset({'draft', 'active', 'paused', 'completed', 'archived'})


def _norm_header(s: str) -> str:
    return (s or '').strip().lower().lstrip('\ufeff')


def _cell(row: dict[str, str], *names: str) -> str:
    for n in names:
        v = row.get(n)
        if v is not None and str(v).strip() != '':
            return str(v).strip()
    return ''


def _parse_json_col(raw: str, line: int, col: str) -> tuple[dict[str, Any] | None, str | None]:
    t = (raw or '').strip()
    if not t:
        return {}, None
    try:
        v = json.loads(t)
        if isinstance(v, dict):
            return v, None
        return None, f'{col} must be a JSON object'
    except json.JSONDecodeError as e:
        return None, f'{col} invalid JSON: {e}'


def _parse_json_list_col(raw: str, line: int, col: str) -> tuple[list[Any] | None, str | None]:
    t = (raw or '').strip()
    if not t:
        return [], None
    try:
        v = json.loads(t)
        if isinstance(v, list):
            return v, None
        return None, f'{col} must be a JSON array'
    except json.JSONDecodeError as e:
        return None, f'{col} invalid JSON: {e}'


def _validate_slug_key(label: str, value: str, line: int) -> str | None:
    try:
        _slug_key(value)
    except ValueError as e:
        return f'line {line}: {label}: {e}'
    return None


def _strip_name(value: str, required: bool, line: int, label: str) -> tuple[str | None, str | None]:
    t = (value or '').strip()
    if not t:
        if required:
            return None, f'line {line}: {label} is required'
        return None, None
    return t[:200], None


def parse_csv_rows(csv_text: str) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    errors: list[dict[str, Any]] = []
    rows: list[dict[str, Any]] = []
    stream = io.StringIO(csv_text)
    reader = csv.DictReader(stream)
    if not reader.fieldnames:
        errors.append({'line': 1, 'entity': '', 'message': 'CSV has no header row'})
        return errors, rows
    norm_fields = {_norm_header(f): f for f in reader.fieldnames}
    if 'entity' not in norm_fields:
        errors.append({'line': 1, 'entity': '', 'message': 'CSV must include an "entity" column'})
        return errors, rows

    for i, raw in enumerate(reader, start=2):
        line = i
        row_lower: dict[str, str] = {}
        for k, v in (raw or {}).items():
            if k is None:
                continue
            nk = _norm_header(k)
            row_lower[nk] = (v if v is not None else '').strip()
        ent = _cell(row_lower, 'entity').lower()
        if not ent or ent.startswith('#'):
            continue
        rows.append({'line': line, 'entity': ent, 'fields': row_lower})
    return errors, rows


def _sort_rows(parsed: list[dict[str, Any]]) -> list[dict[str, Any]]:
    return sorted(parsed, key=lambda r: (_ENTITY_ORDER.get(r['entity'], 99), r['line']))


def run_import(csv_text: str, *, dry_run: bool, skip_existing: bool) -> dict[str, Any]:
    parse_errors, parsed = parse_csv_rows(csv_text)
    errors: list[dict[str, Any]] = list(parse_errors)
    if errors:
        return _result(dry_run, {}, {}, errors)

    if not parsed:
        errors.append({'line': 0, 'entity': '', 'message': 'No data rows (entity column empty or only comments)'})
        return _result(dry_run, {}, {}, errors)

    for r in parsed:
        if r['entity'] not in _ENTITY_ORDER:
            errors.append({'line': r['line'], 'entity': r['entity'], 'message': f'unknown entity (use {", ".join(_ENTITY_ORDER)})'})

    if errors:
        return _result(dry_run, {}, {}, errors)

    sorted_rows = _sort_rows(parsed)
    struct_errors = _validate_rows_structural(sorted_rows)
    errors.extend(struct_errors)
    if errors:
        return _result(dry_run, {}, {}, errors)

    created = {'workspaces': 0, 'clients': 0, 'brands': 0, 'projects': 0, 'tactics': 0}
    skipped = {'workspaces': 0, 'clients': 0, 'brands': 0, 'projects': 0, 'tactics': 0}

    try:
        with conn() as c:
            c.row_factory = dict_row
            try:
                with c.cursor() as cur:
                    ws_ids: dict[str, str] = {}
                    client_ids: dict[tuple[str, str], str] = {}
                    brand_ids: dict[tuple[str, str, str], str] = {}

                    def load_workspace_id(wk: str) -> str | None:
                        if wk in ws_ids:
                            return ws_ids[wk]
                        cur.execute('SELECT id::text AS id FROM workspaces WHERE key=%s', (wk,))
                        row = cur.fetchone()
                        return row['id'] if row else None

                    def load_client_id(wk: str, ck: str) -> str | None:
                        k = (wk, ck)
                        if k in client_ids:
                            return client_ids[k]
                        cur.execute(
                            """SELECT c.id::text AS id FROM clients c
                               JOIN workspaces w ON c.workspace_id = w.id
                               WHERE w.key=%s AND c.key=%s""",
                            (wk, ck),
                        )
                        row = cur.fetchone()
                        return row['id'] if row else None

                    def load_brand_id(wk: str, ck: str, bk: str) -> str | None:
                        k = (wk, ck, bk)
                        if k in brand_ids:
                            return brand_ids[k]
                        cur.execute(
                            """SELECT b.id::text AS id FROM brands b
                               JOIN clients c ON b.client_id = c.id
                               JOIN workspaces w ON c.workspace_id = w.id
                               WHERE w.key=%s AND c.key=%s AND b.key=%s""",
                            (wk, ck, bk),
                        )
                        row = cur.fetchone()
                        return row['id'] if row else None

                    for r in sorted_rows:
                        ent = r['entity']
                        line = r['line']
                        f = r['fields']
                        if ent == 'workspace':
                            try:
                                wk = _slug_key(_cell(f, 'key'))
                            except ValueError as e:
                                raise _ImportAbort([{'line': line, 'entity': ent, 'message': str(e)}]) from e
                            name, err = _strip_name(_cell(f, 'name'), True, line, 'name')
                            if err:
                                raise _ImportAbort([{'line': line, 'entity': ent, 'message': err}])
                            desc = _cell(f, 'description') or ''
                            cur.execute('SELECT id::text FROM workspaces WHERE key=%s', (wk,))
                            ex = cur.fetchone()
                            if ex:
                                ws_ids[wk] = ex['id']
                                if skip_existing:
                                    skipped['workspaces'] += 1
                                    continue
                                raise _ImportAbort(
                                    [{'line': line, 'entity': ent, 'message': f'workspace key {wk!r} already exists'}]
                                )
                            cur.execute(
                                'INSERT INTO workspaces(key, name, description) VALUES(%s,%s,%s) RETURNING id::text',
                                (wk, name, desc),
                            )
                            row = cur.fetchone()
                            ws_ids[wk] = row['id']
                            created['workspaces'] += 1

                        elif ent == 'client':
                            wk_s = _cell(f, 'workspace_key')
                            try:
                                ck = _slug_key(_cell(f, 'key'))
                            except ValueError as e:
                                raise _ImportAbort([{'line': line, 'entity': ent, 'message': str(e)}]) from e
                            wid = load_workspace_id(wk_s)
                            if not wid:
                                raise _ImportAbort(
                                    [
                                        {
                                            'line': line,
                                            'entity': ent,
                                            'message': f'workspace {wk_s!r} not found (create it first in this file or DB)',
                                        }
                                    ]
                                )
                            name, err = _strip_name(_cell(f, 'name'), True, line, 'name')
                            if err:
                                raise _ImportAbort([{'line': line, 'entity': ent, 'message': err}])
                            desc = _cell(f, 'description') or ''
                            cur.execute(
                                'SELECT id::text FROM clients WHERE workspace_id=%s::uuid AND key=%s',
                                (wid, ck),
                            )
                            ex = cur.fetchone()
                            if ex:
                                client_ids[(wk_s, ck)] = ex['id']
                                if skip_existing:
                                    skipped['clients'] += 1
                                    continue
                                raise _ImportAbort(
                                    [
                                        {
                                            'line': line,
                                            'entity': ent,
                                            'message': f'client {ck!r} already exists in workspace {wk_s!r}',
                                        }
                                    ]
                                )
                            cur.execute(
                                'INSERT INTO clients(workspace_id, key, name, description) VALUES(%s::uuid,%s,%s,%s) RETURNING id::text',
                                (wid, ck, name, desc),
                            )
                            row = cur.fetchone()
                            client_ids[(wk_s, ck)] = row['id']
                            created['clients'] += 1

                        elif ent == 'brand':
                            wk_s = _cell(f, 'workspace_key')
                            try:
                                ck = _slug_key(_cell(f, 'client_key'))
                                bk = _slug_key(_cell(f, 'key'))
                            except ValueError as e:
                                raise _ImportAbort([{'line': line, 'entity': ent, 'message': str(e)}]) from e
                            cid = load_client_id(wk_s, ck)
                            if not cid:
                                raise _ImportAbort(
                                    [{'line': line, 'entity': ent, 'message': f'client {wk_s!r}/{ck!r} not found'}]
                                )
                            name, err = _strip_name(_cell(f, 'name'), True, line, 'name')
                            if err:
                                raise _ImportAbort([{'line': line, 'entity': ent, 'message': err}])
                            desc = _cell(f, 'description') or ''
                            cur.execute('SELECT id::text FROM brands WHERE client_id=%s::uuid AND key=%s', (cid, bk))
                            ex = cur.fetchone()
                            if ex:
                                brand_ids[(wk_s, ck, bk)] = ex['id']
                                if skip_existing:
                                    skipped['brands'] += 1
                                    continue
                                raise _ImportAbort(
                                    [
                                        {
                                            'line': line,
                                            'entity': ent,
                                            'message': f'brand {bk!r} already exists for client {wk_s!r}/{ck!r}',
                                        }
                                    ]
                                )
                            cur.execute(
                                'INSERT INTO brands(client_id, key, name, description) VALUES(%s::uuid,%s,%s,%s) RETURNING id::text',
                                (cid, bk, name, desc),
                            )
                            row = cur.fetchone()
                            brand_ids[(wk_s, ck, bk)] = row['id']
                            created['brands'] += 1

                        elif ent == 'project':
                            wk_s = _cell(f, 'workspace_key')
                            try:
                                ck = _slug_key(_cell(f, 'client_key'))
                                bk = _slug_key(_cell(f, 'brand_key'))
                                pk = _slug_key(_cell(f, 'key'))
                            except ValueError as e:
                                raise _ImportAbort([{'line': line, 'entity': ent, 'message': str(e)}]) from e
                            bid = load_brand_id(wk_s, ck, bk)
                            if not bid:
                                raise _ImportAbort(
                                    [{'line': line, 'entity': ent, 'message': f'brand {wk_s!r}/{ck!r}/{bk!r} not found'}]
                                )
                            name, err = _strip_name(_cell(f, 'name'), True, line, 'name')
                            if err:
                                raise _ImportAbort([{'line': line, 'entity': ent, 'message': err}])
                            desc = _cell(f, 'description') or None
                            ptype_raw = _cell(f, 'project_type')
                            if not ptype_raw:
                                raise _ImportAbort(
                                    [
                                        {
                                            'line': line,
                                            'entity': ent,
                                            'message': 'project_type is required (must be a catalog slug; see GET /api/projects/project-types)',
                                        }
                                    ]
                                )
                            try:
                                ptype = normalize_project_type(ptype_raw)
                            except ValueError as e:
                                raise _ImportAbort(
                                    [{'line': line, 'entity': ent, 'message': str(e)}]
                                ) from e
                            pm = (_cell(f, 'pm_kind') or 'business').strip().lower()
                            if pm not in _PM_KINDS:
                                raise _ImportAbort(
                                    [{'line': line, 'entity': ent, 'message': f'pm_kind must be business or personal, got {pm!r}'}]
                                )
                            cur.execute('SELECT key FROM projects WHERE key=%s', (pk,))
                            if cur.fetchone():
                                if skip_existing:
                                    skipped['projects'] += 1
                                    continue
                                raise _ImportAbort(
                                    [{'line': line, 'entity': ent, 'message': f'project key {pk!r} already exists globally'}]
                                )
                            cur.execute(
                                """INSERT INTO projects(key, name, description, brand_id, project_type, pm_kind)
                                   VALUES(%s,%s,%s,%s::uuid,%s,%s)""",
                                (pk, name, desc, bid, ptype, pm),
                            )
                            created['projects'] += 1

                        elif ent == 'tactic':
                            try:
                                pk = _slug_key(_cell(f, 'project_key'))
                            except ValueError as e:
                                raise _ImportAbort([{'line': line, 'entity': ent, 'message': str(e)}]) from e
                            tk_raw = _cell(f, 'tactic_key', 'key')
                            if not tk_raw:
                                raise _ImportAbort([{'line': line, 'entity': ent, 'message': 'tactic_key is required'}])
                            try:
                                tactic_key = _slug_key(tk_raw)
                            except ValueError as e:
                                raise _ImportAbort([{'line': line, 'entity': ent, 'message': str(e)}]) from e

                            name, err = _strip_name(_cell(f, 'name'), True, line, 'name')
                            if err:
                                raise _ImportAbort([{'line': line, 'entity': ent, 'message': err}])
                            cur.execute('SELECT key FROM projects WHERE key=%s', (pk,))
                            if not cur.fetchone():
                                raise _ImportAbort(
                                    [{'line': line, 'entity': ent, 'message': f'project {pk!r} not found'}]
                                )
                            channel = _cell(f, 'channel') or None
                            st = (_cell(f, 'lifecycle_status') or 'draft').strip().lower()
                            if st not in _LIFECYCLE:
                                raise _ImportAbort(
                                    [{'line': line, 'entity': ent, 'message': f'invalid lifecycle_status {st!r}'}]
                                )
                            start_at = _cell(f, 'start_at') or None
                            end_at = _cell(f, 'end_at') or None
                            sm, e1 = _parse_json_col(_cell(f, 'success_metrics_override', 'success_metrics'), line, 'success_metrics_override')
                            if e1:
                                raise _ImportAbort([{'line': line, 'entity': ent, 'message': e1}])
                            dep, e2 = _parse_json_col(_cell(f, 'dependencies_override', 'dependencies'), line, 'dependencies_override')
                            if e2:
                                raise _ImportAbort([{'line': line, 'entity': ent, 'message': e2}])
                            meta, e3 = _parse_json_col(_cell(f, 'metadata'), line, 'metadata')
                            if e3:
                                raise _ImportAbort([{'line': line, 'entity': ent, 'message': e3}])

                            # Library-level optional fields (only used when creating a missing library tactic)
                            desc = _cell(f, 'description') or None
                            kind = _cell(f, 'tactic_kind') or None
                            medium = _cell(f, 'medium') or None
                            fmt = _cell(f, 'format') or None
                            owner = _cell(f, 'owner') or None
                            currency = _cell(f, 'currency') or None
                            cadence = _cell(f, 'cadence') or None
                            status = (_cell(f, 'status') or 'draft').strip().lower()
                            if status not in ('draft', 'active', 'archived'):
                                raise _ImportAbort([{'line': line, 'entity': ent, 'message': f'invalid status {status!r}'}])
                            tags, et = _parse_json_list_col(_cell(f, 'tags'), line, 'tags')
                            if et:
                                raise _ImportAbort([{'line': line, 'entity': ent, 'message': et}])
                            dsm, e4 = _parse_json_col(_cell(f, 'default_success_metrics'), line, 'default_success_metrics')
                            if e4:
                                raise _ImportAbort([{'line': line, 'entity': ent, 'message': e4}])
                            ddef, e5 = _parse_json_col(_cell(f, 'default_dependencies'), line, 'default_dependencies')
                            if e5:
                                raise _ImportAbort([{'line': line, 'entity': ent, 'message': e5}])
                            try:
                                est_cost = int(_cell(f, 'estimated_cost_cents')) if _cell(f, 'estimated_cost_cents') else None
                            except Exception:
                                raise _ImportAbort([{'line': line, 'entity': ent, 'message': 'estimated_cost_cents must be an integer'}])
                            try:
                                start_off = int(_cell(f, 'default_start_offset_days')) if _cell(f, 'default_start_offset_days') else None
                            except Exception:
                                raise _ImportAbort([{'line': line, 'entity': ent, 'message': 'default_start_offset_days must be an integer'}])
                            try:
                                dur = int(_cell(f, 'default_duration_days')) if _cell(f, 'default_duration_days') else None
                            except Exception:
                                raise _ImportAbort([{'line': line, 'entity': ent, 'message': 'default_duration_days must be an integer'}])

                            # Project-level fields
                            priority = (_cell(f, 'priority') or 'medium').strip().lower()
                            objective_override = _cell(f, 'objective_override', 'objective') or None
                            notes = _cell(f, 'notes') or None

                            # Upsert/find library tactic by key.
                            cur.execute('SELECT id::text AS id FROM tactics WHERE key=%s', (tactic_key,))
                            trow = cur.fetchone()
                            if not trow:
                                cur.execute(
                                    """
                                    INSERT INTO tactics(
                                      key, name, description, tactic_kind, channel, medium, format, tags,
                                      default_success_metrics, default_dependencies,
                                      default_start_offset_days, default_duration_days, cadence,
                                      estimated_cost_cents, currency, owner, status, metadata
                                    )
                                    VALUES(
                                      %s,%s,%s,%s,%s,%s,%s,
                                      %s::jsonb,%s::jsonb,%s::jsonb,
                                      %s,%s,%s,%s,%s,%s,%s,%s::jsonb
                                    )
                                    RETURNING id::text
                                    """,
                                    (
                                        tactic_key,
                                        name,
                                        desc,
                                        kind,
                                        channel,
                                        medium,
                                        fmt,
                                        j(tags or []),
                                        j(dsm or {}),
                                        j(ddef or {}),
                                        start_off,
                                        dur,
                                        cadence,
                                        est_cost,
                                        currency,
                                        owner,
                                        status,
                                        j(meta or {}),
                                    ),
                                )
                                trow = cur.fetchone()

                            # Attach to project (idempotent-ish: if already attached and skip_existing, skip).
                            cur.execute(
                                'SELECT id::text AS id FROM project_tactics WHERE project_key=%s AND tactic_id=%s::uuid',
                                (pk, trow['id']),
                            )
                            ex = cur.fetchone()
                            if ex:
                                if skip_existing:
                                    skipped['tactics'] += 1
                                    continue
                                raise _ImportAbort(
                                    [{'line': line, 'entity': ent, 'message': f'tactic {tactic_key!r} already attached to project {pk!r}'}]
                                )

                            cur.execute(
                                """
                                INSERT INTO project_tactics(
                                  project_key, tactic_id, lifecycle_status, priority, start_at, end_at,
                                  objective_override, success_metrics_override, dependencies_override, notes, metadata
                                )
                                VALUES(
                                  %s, %s::uuid, %s, %s, %s, %s,
                                  %s, %s::jsonb, %s::jsonb, %s, %s::jsonb
                                )
                                """,
                                (
                                    pk,
                                    trow['id'],
                                    st,
                                    priority,
                                    start_at,
                                    end_at,
                                    objective_override,
                                    j(sm or {}),
                                    j(dep or {}),
                                    notes,
                                    j(meta or {}),
                                ),
                            )
                            created['tactics'] += 1

                if dry_run:
                    c.rollback()
                else:
                    c.commit()
            except _ImportAbort as e:
                c.rollback()
                return _result(dry_run, {}, {}, list(e.errors))
            except pg_errors.UniqueViolation as e:
                c.rollback()
                return _result(
                    dry_run,
                    {},
                    {},
                    [{'line': 0, 'entity': '', 'message': str(e.diag.message_primary or e)}],
                )
    except Exception as e:
        return _result(dry_run, {}, {}, [{'line': 0, 'entity': '', 'message': str(e)}])

    return _result(dry_run, created, skipped, errors)


class _ImportAbort(Exception):
    def __init__(self, errors: list[dict[str, Any]]):
        self.errors = errors


def _validate_rows_structural(sorted_rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
    errors: list[dict[str, Any]] = []
    for r in sorted_rows:
        ent = r['entity']
        line = r['line']
        f = r['fields']
        if ent == 'workspace':
            if not _cell(f, 'key'):
                errors.append({'line': line, 'entity': ent, 'message': 'key is required'})
            elif (e := _validate_slug_key('key', _cell(f, 'key'), line)):
                errors.append({'line': line, 'entity': ent, 'message': e})
            if not _cell(f, 'name'):
                errors.append({'line': line, 'entity': ent, 'message': 'name is required'})
        elif ent == 'client':
            for col, label in [('workspace_key', 'workspace_key'), ('key', 'key'), ('name', 'name')]:
                if not _cell(f, col):
                    errors.append({'line': line, 'entity': ent, 'message': f'{label} is required'})
            if _cell(f, 'key') and (e := _validate_slug_key('key', _cell(f, 'key'), line)):
                errors.append({'line': line, 'entity': ent, 'message': e})
        elif ent == 'brand':
            for col in ('workspace_key', 'client_key', 'key', 'name'):
                if not _cell(f, col):
                    errors.append({'line': line, 'entity': ent, 'message': f'{col} is required'})
            for label, val in [('client_key', _cell(f, 'client_key')), ('key', _cell(f, 'key'))]:
                if val and (e := _validate_slug_key(label, val, line)):
                    errors.append({'line': line, 'entity': ent, 'message': e})
        elif ent == 'project':
            for col in ('workspace_key', 'client_key', 'brand_key', 'key', 'name'):
                if not _cell(f, col):
                    errors.append({'line': line, 'entity': ent, 'message': f'{col} is required'})
            for label, val in [('key', _cell(f, 'key')), ('client_key', _cell(f, 'client_key')), ('brand_key', _cell(f, 'brand_key'))]:
                if val and (e := _validate_slug_key(label, val, line)):
                    errors.append({'line': line, 'entity': ent, 'message': e})
            pm = (_cell(f, 'pm_kind') or 'business').strip().lower()
            if pm not in _PM_KINDS:
                errors.append({'line': line, 'entity': ent, 'message': f'pm_kind must be business or personal, got {pm!r}'})
        elif ent == 'tactic':
            if not _cell(f, 'project_key'):
                errors.append({'line': line, 'entity': ent, 'message': 'project_key is required'})
            elif (e := _validate_slug_key('project_key', _cell(f, 'project_key'), line)):
                errors.append({'line': line, 'entity': ent, 'message': e})
            if not _cell(f, 'tactic_key', 'key'):
                errors.append({'line': line, 'entity': ent, 'message': 'tactic_key is required'})
            else:
                tk_raw = _cell(f, 'tactic_key', 'key')
                if tk_raw and (e := _validate_slug_key('tactic_key', tk_raw, line)):
                    errors.append({'line': line, 'entity': ent, 'message': e})
            if not _cell(f, 'name'):
                errors.append({'line': line, 'entity': ent, 'message': 'name is required'})
            st = (_cell(f, 'lifecycle_status') or 'draft').strip().lower()
            if st not in _LIFECYCLE:
                errors.append({'line': line, 'entity': ent, 'message': f'invalid lifecycle_status {st!r}'})
            for col in ('success_metrics_override', 'dependencies_override', 'default_success_metrics', 'default_dependencies', 'metadata'):
                _, err = _parse_json_col(_cell(f, col), line, col)
                if err:
                    errors.append({'line': line, 'entity': ent, 'message': err})
            if _cell(f, 'tags'):
                _, err = _parse_json_list_col(_cell(f, 'tags'), line, 'tags')
                if err:
                    errors.append({'line': line, 'entity': ent, 'message': err})
    return errors


def _result(dry_run: bool, created: dict, skipped: dict, errors: list) -> dict[str, Any]:
    out: dict[str, Any] = {
        'dry_run': dry_run,
        'created': created,
        'skipped': skipped,
        'errors': errors,
        'ok': not errors,
    }
    if dry_run and not errors:
        out['message'] = 'Dry run completed; no changes were committed.'
    return out

from __future__ import annotations

from typing import Any


def _section_ids(skeleton: dict[str, Any]) -> set[str]:
    out: set[str] = set()
    for sec in skeleton.get('sections') or []:
        if isinstance(sec, dict) and sec.get('id'):
            out.add(str(sec['id']))
    return out


def _field_ids(skeleton: dict[str, Any]) -> tuple[list[str], list[str]]:
    """Returns (errors, field_ids_in_order)."""
    errors: list[str] = []
    seen: set[str] = set()
    ordered: list[str] = []
    sections = skeleton.get('sections')
    if not isinstance(sections, list):
        return ['sections must be a list'], []
    for sec in sections:
        if not isinstance(sec, dict):
            errors.append('each section must be an object')
            continue
        sid = sec.get('id')
        if not sid:
            errors.append('section missing id')
            continue
        fields = sec.get('fields')
        if not isinstance(fields, list):
            errors.append(f'section {sid}: fields must be a list')
            continue
        for f in fields:
            if not isinstance(f, dict):
                errors.append(f'section {sid}: field must be an object')
                continue
            fid = f.get('id')
            if not fid:
                errors.append(f'section {sid}: field missing id')
                continue
            fs = str(fid)
            if fs in seen:
                errors.append(f'duplicate field id: {fs}')
            seen.add(fs)
            ordered.append(fs)
    return errors, ordered


def validate_brief_bundle(
    skeleton: dict[str, Any],
    tactic_overrides: dict[str, Any],
    presets: dict[str, Any],
    *,
    tactic_keys_in_db: set[str] | None = None,
) -> list[str]:
    errors: list[str] = []
    if skeleton.get('version') != 1:
        errors.append('skeleton.version must be 1')
    if tactic_overrides.get('version') != 1:
        errors.append('tactic_overrides.version must be 1')
    if presets.get('version') != 1:
        errors.append('presets.version must be 1')

    fe, field_ids = _field_ids(skeleton)
    errors.extend(fe)
    sec_ids = _section_ids(skeleton)

    ovr = tactic_overrides.get('overrides')
    if not isinstance(ovr, dict):
        errors.append('tactic_overrides.overrides must be an object')
    else:
        for tk, block in ovr.items():
            if tactic_keys_in_db is not None and str(tk) not in tactic_keys_in_db:
                errors.append(f'override tactic key not in tactics table: {tk}')
            if not isinstance(block, dict):
                errors.append(f'override for {tk} must be an object')
                continue
            hides = block.get('hideSectionIds') or []
            if isinstance(hides, list):
                for hid in hides:
                    if str(hid) not in sec_ids:
                        errors.append(f'hideSectionIds references unknown section: {hid}')

    plist = presets.get('presets')
    if not isinstance(plist, list):
        errors.append('presets.presets must be a list')
    else:
        field_set = set(field_ids)
        for i, p in enumerate(plist):
            if not isinstance(p, dict):
                errors.append(f'preset[{i}] must be an object')
                continue
            if not p.get('id'):
                errors.append(f'preset[{i}] missing id')
            keys = p.get('tactic_keys')
            if not isinstance(keys, list) or not keys:
                errors.append(f'preset {p.get("id")}: tactic_keys must be a non-empty array')
            elif tactic_keys_in_db is not None:
                for tk in keys:
                    if str(tk) not in tactic_keys_in_db:
                        errors.append(f'preset {p.get("id")}: unknown tactic_key {tk}')
            fd = p.get('field_defaults')
            if fd is not None and isinstance(fd, dict):
                for fk in fd:
                    if fk not in field_set:
                        errors.append(f'preset {p.get("id")}: field_defaults key not in skeleton: {fk}')
    return errors

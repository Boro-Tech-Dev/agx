"""Load and merge learning playbooks from config/learning/."""

from __future__ import annotations

import copy
import json
from functools import lru_cache
from pathlib import Path
from typing import Any


def _learning_root() -> Path:
    here = Path(__file__).resolve()
    for depth in (4, 3, 2):
        if len(here.parents) > depth:
            candidate = here.parents[depth] / 'config' / 'learning'
            if candidate.is_dir():
                return candidate
    raise FileNotFoundError('config/learning not found')


def _playbook_path(playbook_id: str) -> Path:
    root = _learning_root()
    direct = root / f'{playbook_id}.v1.json'
    if direct.is_file():
        return direct
    role = root / 'roles' / f'{playbook_id}.v1.json'
    if role.is_file():
        return role
    raise FileNotFoundError(f'playbook not found: {playbook_id}')


def _brand_overlay_path(brand_key: str) -> Path | None:
    root = _learning_root() / 'brands'
    for name in (f'{brand_key}.v1.json', 'default.v1.json'):
        p = root / name
        if p.is_file():
            return p
    return None


def _all_playbook_ids() -> list[str]:
    root = _learning_root()
    ids: list[str] = []
    for p in root.glob('*.v1.json'):
        ids.append(p.name.replace('.v1.json', ''))
    roles = root / 'roles'
    if roles.is_dir():
        for p in roles.glob('*.v1.json'):
            ids.append(p.name.replace('.v1.json', ''))
    return sorted(set(ids))


@lru_cache(maxsize=32)
def load_playbook_raw(playbook_id: str) -> dict[str, Any]:
    data = json.loads(_playbook_path(playbook_id).read_text(encoding='utf-8'))
    if data.get('id') != playbook_id:
        data = {**data, 'id': playbook_id}
    return data


def merge_brand_overlay(playbook: dict[str, Any], brand_key: str | None) -> dict[str, Any]:
    if not brand_key:
        return playbook
    path = _brand_overlay_path(brand_key.strip())
    if not path or path.name.startswith('default'):
        if brand_key and brand_key != 'default':
            path = _brand_overlay_path('default')
        if not path:
            return playbook
    overlay = json.loads(path.read_text(encoding='utf-8'))
    out = copy.deepcopy(playbook)
    append = overlay.get('append_missions') or []
    if append:
        out['missions'] = list(out.get('missions') or []) + append
    patches = {p['step_id']: p for p in (overlay.get('step_patches') or []) if p.get('step_id')}
    if patches:
        for mission in out.get('missions') or []:
            for step in mission.get('steps') or []:
                sid = step.get('id')
                if sid and sid in patches:
                    patch = patches[sid]
                    if patch.get('title'):
                        step['title'] = patch['title']
                    if patch.get('body'):
                        step['body'] = patch['body']
    out['brand_key'] = brand_key
    return out


# New step ids inherit completion from retired ids (playbook migrations).
STEP_COMPLETION_ALIASES: dict[str, list[str]] = {
    's2_platform_gov': ['s2_governance'],
}


def _activity_content_path(playbook_id: str, step_id: str) -> Path:
    return _learning_root() / 'content' / playbook_id / f'{step_id}.json'


def load_activity_content(playbook_id: str, step_id: str) -> dict[str, Any] | None:
    path = _activity_content_path(playbook_id, step_id)
    if not path.is_file():
        return None
    return json.loads(path.read_text(encoding='utf-8'))


def merge_activity_content(playbook: dict[str, Any]) -> dict[str, Any]:
    out = copy.deepcopy(playbook)
    pid = str(out.get('id') or '')
    for mission in out.get('missions') or []:
        for step in mission.get('steps') or []:
            sid = step.get('id')
            if not sid:
                continue
            content = load_activity_content(pid, str(sid))
            if content:
                activity = dict(content)
            else:
                activity = {}
            if step.get('body') and not activity.get('sections'):
                activity['body'] = step['body']
            href = step.get('href')
            if href and not activity.get('tool_cta'):
                activity['tool_cta'] = {
                    'label': activity.get('tool_cta', {}).get('label') or 'Open tool',
                    'href': href,
                }
            if activity:
                step['activity'] = activity
    return out


def step_completed(step_id: str, completed: set[str]) -> bool:
    if step_id in completed:
        return True
    for legacy in STEP_COMPLETION_ALIASES.get(step_id, []):
        if legacy in completed:
            return True
    return False


def load_playbook(playbook_id: str, brand_key: str | None = None) -> dict[str, Any]:
    base = load_playbook_raw(playbook_id)
    merged = merge_brand_overlay(base, brand_key)
    return merge_activity_content(merged)


def catalog_entries() -> list[dict[str, Any]]:
    out: list[dict[str, Any]] = []
    for pid in _all_playbook_ids():
        pb = load_playbook_raw(pid)
        out.append(
            {
                'id': pb['id'],
                'version': pb.get('version', 1),
                'module_type': pb.get('module_type'),
                'title': pb.get('title'),
                'agency_role': pb.get('agency_role'),
                'vertical': pb.get('vertical'),
                'estimatedMinutes': pb.get('estimatedMinutes'),
                'total_steps': step_count(pb),
            }
        )
    return out


def all_step_ids(playbook: dict[str, Any]) -> list[str]:
    ids: list[str] = []
    for mission in playbook.get('missions') or []:
        for step in mission.get('steps') or []:
            sid = step.get('id')
            if sid:
                ids.append(str(sid))
    return ids


def step_count(playbook: dict[str, Any]) -> int:
    return len(all_step_ids(playbook))


def find_step(playbook: dict[str, Any], step_id: str) -> dict[str, Any] | None:
    for mission in playbook.get('missions') or []:
        for step in mission.get('steps') or []:
            if step.get('id') == step_id:
                return step
    return None


def playbook_diff_summary(old_version: int, new_playbook: dict[str, Any]) -> dict[str, Any]:
    """Lightweight diff for content versioning banner."""
    return {
        'playbook_id': new_playbook.get('id'),
        'from_version': old_version,
        'to_version': new_playbook.get('version', 1),
        'summary': f'Content updated to version {new_playbook.get("version", 1)}. Review new or changed steps.',
    }

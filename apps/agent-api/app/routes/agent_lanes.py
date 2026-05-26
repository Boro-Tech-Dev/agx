import json
from pathlib import Path

from fastapi import APIRouter

router = APIRouter(prefix='/api/agent-lanes', tags=['agent-lanes'])

_CONFIG_PATH = Path(__file__).resolve().parents[2] / 'config' / 'agent_lanes.json'
_cached: dict | None = None


def _load() -> dict:
    global _cached
    if _cached is not None:
        return _cached
    data = json.loads(_CONFIG_PATH.read_text(encoding='utf-8'))
    _cached = data
    return data


@router.get('')
def get_agent_lanes():
    data = _load()
    agents = data.get('agents') or {}
    lanes = data.get('lanes') or {}
    allowlists = data.get('tool_allowlists') or {}
    catalog = []
    for key, spec in sorted(agents.items()):
        lane = spec.get('lane')
        lane_meta = lanes.get(lane, {}) if lane else {}
        catalog.append(
            {
                'agent_key': key,
                'lane': lane,
                'lane_label': lane_meta.get('label', lane),
                'lane_description': lane_meta.get('description', ''),
                'default_model': spec.get('default_model'),
                'tool_model': spec.get('tool_model'),
                'tool_allowlist': allowlists.get(key, []),
                'default_web_search': spec.get('default_web_search', False),
                'default_use_tools': spec.get('default_use_tools', False),
            }
        )
    return {'lanes': lanes, 'agents': catalog}

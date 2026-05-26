"""Project row fields that drive PM Copilot behavior.

`projects.pm_kind` selects PM vs Synergy: `business` | `personal`. Breakdown blocking for
log-only types uses `project_type` and `metadata.allow_structured_breakdown` in run_service
and worker `project_policy`.
"""

from worker.db import fetch_one

_VALID = frozenset({'business', 'personal'})


def project_pm_kind(project_key: str | None) -> str:
    """Return 'business' or 'personal' from projects.pm_kind. Missing project or column → business."""
    if not project_key:
        return 'business'
    try:
        row = fetch_one('SELECT pm_kind FROM projects WHERE key=%s', (project_key,))
    except Exception:
        return 'business'
    if not row:
        return 'business'
    k = str(row.get('pm_kind') or 'business').strip().lower()
    return k if k in _VALID else 'business'

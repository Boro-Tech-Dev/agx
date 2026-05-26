"""JSON extraction from model text (shared by /v1/route and tests)."""

from __future__ import annotations

import json
import logging
import re
from typing import Any

log = logging.getLogger(__name__)


def _extract_best_json_value(text: str) -> Any | None:
    """Prefer the largest valid JSON object/array starting at any ``{`` or ``[` (balanced decode)."""
    decoder = json.JSONDecoder()
    best: Any | None = None
    best_score = -1
    i = 0
    n = len(text)
    while i < n:
        ch = text[i]
        if ch not in '{[':
            i += 1
            continue
        try:
            val, end = decoder.raw_decode(text, i)
        except json.JSONDecodeError:
            i += 1
            continue
        if isinstance(val, dict):
            score = len(json.dumps(val, sort_keys=True))
        elif isinstance(val, list):
            score = len(json.dumps(val, sort_keys=True)) // 2
        else:
            score = 0
        if score > best_score:
            best = val
            best_score = score
        i = end if end > i else i + 1
    return best


def recover_json(content: str) -> Any | None:
    try:
        obj = json.loads(content)
        if isinstance(obj, dict) and len(obj) == 0:
            return None
        return obj
    except Exception:
        pass
    cleaned = content.strip()
    cleaned = re.sub(r'^```(?:json)?\s*', '', cleaned)
    cleaned = re.sub(r'\s*```$', '', cleaned)
    try:
        obj = json.loads(cleaned)
        if isinstance(obj, dict) and len(obj) == 0:
            return None
        return obj
    except Exception:
        pass
    extracted = _extract_best_json_value(cleaned)
    if extracted is not None:
        if isinstance(extracted, dict) and len(extracted) == 0:
            return None
        return extracted
    log.warning(
        'recover_json: all parse attempts failed content_len=%s preview_hash=%s',
        len(content or ''),
        hash((content or '')[:200]),
    )
    return None

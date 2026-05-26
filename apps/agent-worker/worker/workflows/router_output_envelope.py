"""Reserved ``output['_router']`` blob for audit/debug (not PM schema fields).

Persisted on ``agent_runs.output`` so operators can inspect truncated model text and
router flags without relying on worker logs alone.
"""

from __future__ import annotations

import hashlib
import os
from typing import Any


def router_raw_content_max_chars() -> int:
    raw = os.getenv('ROUTER_RAW_CONTENT_MAX_CHARS', '24000').strip()
    try:
        n = int(raw)
        return max(1000, min(n, 500_000))
    except ValueError:
        return 24000


def attach_router_envelope(
    out: dict[str, Any],
    routed: dict[str, Any] | None,
    *,
    fallback_used: bool = False,
    loose_unparsed: bool = False,
) -> None:
    """Merge router fingerprints into ``out['_router']``. Mutates ``out`` in place."""
    if not isinstance(out, dict):
        return

    raw = ''
    err: Any = None
    pf: Any = None
    mu: Any = None
    gff: Any = None
    sfu: Any = None
    warn: Any = None
    kgm: Any = None

    if isinstance(routed, dict):
        c = routed.get('content')
        raw = c if isinstance(c, str) else ''
        err = routed.get('error')
        pf = routed.get('parse_failed')
        mu = routed.get('model_used')
        gff = routed.get('grammar_failure_fallback_used')
        sfu = routed.get('schema_fallback_used')
        kgm = routed.get('kitt_grammar_mode')
        w = routed.get('warning')
        if isinstance(w, str) and w.strip():
            warn = w[:8000] if len(w) > 8000 else w

    full = raw or ''
    digest = hashlib.sha256(full.encode('utf-8', errors='replace')).hexdigest()
    max_c = router_raw_content_max_chars()
    truncated_flag = len(full) > max_c
    preview = full[:max_c] if truncated_flag else full

    envelope: dict[str, Any] = {
        'raw_content_sha256': digest,
        'raw_content_truncated': truncated_flag,
        'raw_content_char_len': len(full),
        'raw_content_preview': preview,
        'fallback_used': bool(fallback_used),
        'loose_unparsed': bool(loose_unparsed),
    }
    if err is not None:
        envelope['error'] = err
    if pf is not None:
        envelope['parse_failed'] = pf
    if mu is not None:
        envelope['model_used'] = mu
    if gff is not None:
        envelope['grammar_failure_fallback_used'] = gff
    if sfu is not None:
        envelope['schema_fallback_used'] = sfu
    if warn is not None:
        envelope['router_warning'] = warn
    if kgm is not None:
        envelope['kitt_grammar_mode'] = kgm

    out['_router'] = envelope

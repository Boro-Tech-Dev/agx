"""Shared per-request capture flags (HAR, debug artifacts)."""

from __future__ import annotations

import os

from pydantic import BaseModel, Field


class CaptureRequestOptions(BaseModel):
    record_har: bool = False
    debug_on_failure: bool = False


def debug_on_failure_enabled(request_flag: bool) -> bool:
    env_on = os.getenv('WEB_DEBUG_ON_FAILURE', '').strip().lower() in ('1', 'true', 'yes', 'on')
    return bool(request_flag or env_on)


def debug_artifact_max_bytes() -> int:
    raw = os.getenv('WEB_DEBUG_ARTIFACT_MAX_BYTES', '').strip()
    if not raw:
        return 2_000_000
    try:
        v = int(raw, 10)
    except ValueError:
        return 2_000_000
    return max(64_000, min(v, 8_000_000))


def crawl_pdf_max_bytes() -> int:
    raw = os.getenv('WEB_CRAWL_PDF_MAX_BYTES', '').strip()
    if not raw:
        return 2_000_000
    try:
        v = int(raw, 10)
    except ValueError:
        return 2_000_000
    return max(64_000, min(v, 6_000_000))


def har_max_bytes() -> int:
    raw = os.getenv('WEB_HAR_MAX_BYTES', '').strip()
    if not raw:
        return 1_500_000
    try:
        v = int(raw, 10)
    except ValueError:
        return 1_500_000
    return max(32_000, min(v, 6_000_000))


def read_capped_file(path: str, *, max_bytes: int) -> bytes:
    with open(path, 'rb') as f:
        return f.read(max_bytes + 1)[:max_bytes]

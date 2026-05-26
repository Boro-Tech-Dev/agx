"""Trusted dashboard user identity from BFF proxy header."""

from __future__ import annotations

import os

from fastapi import Header, HTTPException

LOCAL_DEV_SUB = 'local-dev'


def require_user_sub(x_dashboard_user_sub: str | None = Header(default=None, alias='X-Dashboard-User-Sub')) -> str:
    sub = (x_dashboard_user_sub or '').strip()
    if sub:
        return sub
    if os.getenv('AUTH_DISABLED', '').lower() in ('1', 'true', 'yes'):
        return LOCAL_DEV_SUB
    raise HTTPException(401, 'Missing X-Dashboard-User-Sub')

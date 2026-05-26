"""Deprecated module.

Phase 06 removed duplicate path-handling code. Use the HTTP endpoints in tools.main,
which rely on Path.relative_to() and redaction. This module intentionally exposes no
repo helpers to avoid accidental import of stale unsafe logic.
"""
DEPRECATED = True

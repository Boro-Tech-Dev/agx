"""Page tiers for SkillArts `skillarts_tiered` PRB cadence (parity with skillArtsTier.ts)."""

from __future__ import annotations

DEFAULT_SKILLARTS_PAGE_COUNT = 20


def skill_arts_tier_inclusive_working_days(page_count: float | int) -> int:
    try:
        n = int(page_count)
    except (TypeError, ValueError):
        return 5
    if n < 1:
        return 5
    if n >= 30:
        return 10
    if n >= 15:
        return 5
    return 3


def resolve_skill_arts_page_count(raw: int | float | None) -> int:
    if raw is None:
        return DEFAULT_SKILLARTS_PAGE_COUNT
    try:
        n = int(raw)
    except (TypeError, ValueError):
        return DEFAULT_SKILLARTS_PAGE_COUNT
    if n < 1:
        return DEFAULT_SKILLARTS_PAGE_COUNT
    return min(5000, n)

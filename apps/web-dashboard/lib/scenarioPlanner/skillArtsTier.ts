/** Page-count tiers for SkillArts `skillarts_tiered` PRB cadence (inclusive working days submit → review). */

export const DEFAULT_SKILLARTS_PAGE_COUNT = 20;

/** Tier bands match PRB submit→review inclusive working-day spans (see `skillArtsTierInclusiveWorkingDays`). */
export type SkillArtsTierId = 'tier1' | 'tier2' | 'tier3';

export const SKILL_ARTS_TIER_IDS: readonly SkillArtsTierId[] = ['tier1', 'tier2', 'tier3'];

export const SKILL_ARTS_TIER_LABEL: Record<SkillArtsTierId, string> = {
  tier1: 'Tier 1 — 30+ pages (10 wd)',
  tier2: 'Tier 2 — 15–29 pages (5 wd)',
  tier3: 'Tier 3 — under 15 pages (3 wd)',
};

/**
 * Derives tier from page count (same boundaries as schedule math).
 */
export function skillArtsTierFromPageCount(rawPageCount: number): SkillArtsTierId {
  const n = resolveSkillArtsPageCount(rawPageCount);
  if (n >= 30) return 'tier1';
  if (n >= 15) return 'tier2';
  return 'tier3';
}

/**
 * Representative page count when the user picks a tier explicitly (page field stays editable afterward).
 */
export function canonicalPageCountForSkillArtsTier(tier: SkillArtsTierId): number {
  switch (tier) {
    case 'tier1':
      return 30;
    case 'tier2':
      return 20;
    case 'tier3':
      return 10;
    default:
      return DEFAULT_SKILLARTS_PAGE_COUNT;
  }
}

/**
 * Inclusive count of working days from PRB submit start through PRB review start.
 * Mutually exclusive: ≥30 → 10; 15–29 → 5; below 15 → 3.
 */
export function skillArtsTierInclusiveWorkingDays(pageCount: number): number {
  const n = Math.floor(Number(pageCount));
  if (!Number.isFinite(n) || n < 1) return 5;
  if (n >= 30) return 10;
  if (n >= 15) return 5;
  return 3;
}

export function resolveSkillArtsPageCount(raw: number | undefined): number {
  if (raw === undefined) return DEFAULT_SKILLARTS_PAGE_COUNT;
  const n = Math.floor(Number(raw));
  if (!Number.isFinite(n) || n < 1) return DEFAULT_SKILLARTS_PAGE_COUNT;
  return Math.min(5000, n);
}

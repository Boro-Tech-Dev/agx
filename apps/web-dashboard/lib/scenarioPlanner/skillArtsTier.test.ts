import { describe, expect, it } from 'vitest';

import {
  canonicalPageCountForSkillArtsTier,
  skillArtsTierFromPageCount,
  skillArtsTierInclusiveWorkingDays,
} from './skillArtsTier';

describe('skillArtsTier', () => {
  it('maps page bands to tier ids', () => {
    expect(skillArtsTierFromPageCount(35)).toBe('tier1');
    expect(skillArtsTierFromPageCount(30)).toBe('tier1');
    expect(skillArtsTierFromPageCount(29)).toBe('tier2');
    expect(skillArtsTierFromPageCount(15)).toBe('tier2');
    expect(skillArtsTierFromPageCount(14)).toBe('tier3');
  });

  it('canonical tier picks representative page counts inside each band', () => {
    expect(canonicalPageCountForSkillArtsTier('tier1')).toBe(30);
    expect(canonicalPageCountForSkillArtsTier('tier2')).toBe(20);
    expect(canonicalPageCountForSkillArtsTier('tier3')).toBe(10);
  });

  it('inclusive WD span matches tier bands', () => {
    expect(skillArtsTierInclusiveWorkingDays(40)).toBe(10);
    expect(skillArtsTierInclusiveWorkingDays(20)).toBe(5);
    expect(skillArtsTierInclusiveWorkingDays(10)).toBe(3);
  });
});

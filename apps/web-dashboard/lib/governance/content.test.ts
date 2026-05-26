import { describe, expect, it } from 'vitest';
import { getGovernanceDoc, GOVERNANCE_SECTION_IDS } from './content';

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

describe('governance content', () => {
  it('has required section ids', () => {
    const doc = getGovernanceDoc();
    const ids = doc.sections.map((s) => s.id);
    for (const required of GOVERNANCE_SECTION_IDS) {
      expect(ids).toContain(required);
    }
    expect(ids.length).toBe(GOVERNANCE_SECTION_IDS.length);
  });

  it('lastVerifiedFromCode is ISO date', () => {
    const doc = getGovernanceDoc();
    expect(doc.lastVerifiedFromCode).toMatch(ISO_DATE);
  });

  it('has known issues', () => {
    const doc = getGovernanceDoc();
    expect(doc.knownIssues.length).toBeGreaterThan(0);
    for (const row of doc.knownIssues) {
      expect(row.issue.trim()).not.toBe('');
      expect(row.whyItMatters.trim()).not.toBe('');
      expect(row.mitigationToday.trim()).not.toBe('');
    }
  });

  it('hero summary and quick links are present', () => {
    const doc = getGovernanceDoc();
    expect(doc.heroSummary.length).toBeGreaterThanOrEqual(2);
    expect(doc.quickLinks.length).toBeGreaterThan(0);
  });
});

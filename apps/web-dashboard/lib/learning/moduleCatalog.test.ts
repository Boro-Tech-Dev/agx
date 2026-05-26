import { describe, expect, it } from 'vitest';

import { learningActivityHref, learningMissionHref } from './moduleCatalog';

describe('learningActivityHref', () => {
  it('builds activity path with enrollment', () => {
    expect(learningActivityHref('pharma_knowledge', 's4_prb', 'enr-1')).toBe(
      '/tools/learning/activity/pharma_knowledge/s4_prb?enrollment=enr-1',
    );
  });

  it('includes brand when provided', () => {
    expect(learningActivityHref('account_management_pharma', 'am_p_s1_clarifier', 'enr-2', 'advsm-hcp')).toBe(
      '/tools/learning/activity/account_management_pharma/am_p_s1_clarifier?enrollment=enr-2&brand=advsm-hcp',
    );
  });
});

describe('learningMissionHref', () => {
  it('routes pharma knowledge to /tools/learning/pharma', () => {
    expect(learningMissionHref('pharma_knowledge', 'enr-1', 's1_intro')).toBe(
      '/tools/learning/pharma?enrollment=enr-1&step=s1_intro',
    );
  });
});

import { describe, expect, it } from 'vitest';

import { catalogIdForDashboardToolKey, dashboardToolKeyForCatalog } from './navConfig';
import { toolCatalogList, toolIdFromSlug, toolRouteHref } from './toolCatalog';

describe('toolCatalog routing', () => {
  it('has unique slugs for every catalog tool', () => {
    const slugs = toolCatalogList().map(({ entry }) => entry.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it('round-trips slug to id', () => {
    for (const { id, entry } of toolCatalogList()) {
      expect(toolIdFromSlug(entry.slug)).toBe(id);
    }
    expect(toolIdFromSlug('not-a-tool')).toBeNull();
  });

  it('builds href with optional tab=how', () => {
    expect(toolRouteHref('web_capture')).toBe('/tools/web-capture');
    expect(toolRouteHref('web_search')).toBe('/tools/web-search');
    expect(toolRouteHref('web_capture', 'how')).toBe('/tools/web-capture?tab=how');
    expect(toolRouteHref('web_capture', 'use')).toBe('/tools/web-capture?tab=use');
    expect(toolRouteHref('learning')).toBe('/tools/learning');
    expect(toolRouteHref('learning', 'team')).toBe('/tools/learning?tab=team');
  });

  it('round-trips dashboard tool keys', () => {
    for (const { id } of toolCatalogList()) {
      const key = dashboardToolKeyForCatalog(id);
      expect(catalogIdForDashboardToolKey(key)).toBe(id);
    }
    expect(catalogIdForDashboardToolKey('tools')).toBeNull();
  });
});

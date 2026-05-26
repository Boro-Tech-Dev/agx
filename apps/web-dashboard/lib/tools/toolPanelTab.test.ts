import { describe, expect, it } from 'vitest';

import { resolveToolPanelTab } from './toolPanelTab';

describe('resolveToolPanelTab', () => {
  it('prefers URL tab param', () => {
    expect(resolveToolPanelTab('how', 'use')).toBe('how');
    expect(resolveToolPanelTab('use', 'how')).toBe('use');
  });

  it('ignores invalid tab param', () => {
    expect(resolveToolPanelTab('bogus', 'how')).toBe('how');
    expect(resolveToolPanelTab('', 'how')).toBe('how');
  });

  it('falls back to default', () => {
    expect(resolveToolPanelTab(null, null)).toBe('use');
    expect(resolveToolPanelTab(undefined, null, 'how')).toBe('how');
  });
});

import { describe, expect, it } from 'vitest';

import {
  learningMusingBySlug,
  learningMusingHref,
  learningMusingSlugs,
  learningMusingsList,
} from './registry';

describe('learning musings registry', () => {
  it('lists the-stack', () => {
    expect(learningMusingsList().map((m) => m.slug)).toContain('the-stack');
  });

  it('round-trips slug and href', () => {
    for (const slug of learningMusingSlugs()) {
      expect(learningMusingBySlug(slug)?.slug).toBe(slug);
      expect(learningMusingHref(slug)).toBe(`/tools/learning/musings/${slug}`);
    }
  });

  it('returns undefined for unknown slug', () => {
    expect(learningMusingBySlug('not-a-musing')).toBeUndefined();
  });
});

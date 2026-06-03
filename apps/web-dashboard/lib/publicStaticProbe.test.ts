import { describe, expect, it } from 'vitest';

import { isPublicStaticAsset } from './publicStaticProbe';

describe('isPublicStaticAsset', () => {
  it('matches favicon and touch-icon probe paths', () => {
    expect(isPublicStaticAsset('/favicon.ico')).toBe(true);
    expect(isPublicStaticAsset('/icon.svg')).toBe(true);
    expect(isPublicStaticAsset('/apple-touch-icon.png')).toBe(true);
    expect(isPublicStaticAsset('/apple-touch-icon-precomposed.png')).toBe(true);
  });

  it('does not match app routes', () => {
    expect(isPublicStaticAsset('/login')).toBe(false);
    expect(isPublicStaticAsset('/')).toBe(false);
    expect(isPublicStaticAsset('/tools')).toBe(false);
  });
});

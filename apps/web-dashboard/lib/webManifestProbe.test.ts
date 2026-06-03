import { describe, expect, it } from 'vitest';

import { isWebManifestProbe } from './webManifestProbe';

describe('isWebManifestProbe', () => {
  it('matches common manifest probe paths', () => {
    expect(isWebManifestProbe('/site.webmanifest')).toBe(true);
    expect(isWebManifestProbe('/foo/bar.webmanifest')).toBe(true);
  });

  it('matches /manifest.json', () => {
    expect(isWebManifestProbe('/manifest.json')).toBe(true);
  });

  it('does not match app routes', () => {
    expect(isWebManifestProbe('/login')).toBe(false);
    expect(isWebManifestProbe('/')).toBe(false);
  });
});

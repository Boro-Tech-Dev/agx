import { describe, expect, it } from 'vitest';

import { isWebManifestProbe } from './webManifestProbe';

describe('isWebManifestProbe', () => {
  it('matches common manifest probe paths', () => {
    expect(isWebManifestProbe('/site.webmanifest')).toBe(true);
    expect(isWebManifestProbe('/foo/bar.webmanifest')).toBe(true);
  });

  it('does not match app routes or other manifest filenames', () => {
    expect(isWebManifestProbe('/login')).toBe(false);
    expect(isWebManifestProbe('/')).toBe(false);
    expect(isWebManifestProbe('/manifest.json')).toBe(false);
  });
});

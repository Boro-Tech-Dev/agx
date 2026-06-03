import { describe, expect, it } from 'vitest';

import { issuerHostMatchesAppHost } from './keycloakOidc';

describe('issuerHostMatchesAppHost', () => {
  it('returns true when issuer and app share the same hostname', () => {
    expect(
      issuerHostMatchesAppHost(
        'https://idea-impact.com/realms/platform',
        'https://idea-impact.com',
      ),
    ).toBe(true);
  });

  it('returns false when issuer is on auth subdomain', () => {
    expect(
      issuerHostMatchesAppHost(
        'https://auth.idea-impact.com/realms/platform',
        'https://idea-impact.com',
      ),
    ).toBe(false);
  });

  it('returns false for invalid URLs', () => {
    expect(issuerHostMatchesAppHost('not-a-url', 'https://idea-impact.com')).toBe(false);
  });
});

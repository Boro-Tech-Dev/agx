import { describe, expect, it } from 'vitest';

import { safeNextPath } from '../auth/safeNextPath';
import {
  codeChallengeS256,
  generateCodeVerifier,
  generateOidcState,
} from '../server/keycloakOidc';

describe('keycloakOidc PKCE helpers', () => {
  it('generateCodeVerifier produces URL-safe length >= 43', () => {
    const v = generateCodeVerifier();
    expect(v.length).toBeGreaterThanOrEqual(43);
    expect(v).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it('codeChallengeS256 is deterministic base64url', () => {
    const v = 'test-verifier-fixed-value-123456789012345678901234';
    const c1 = codeChallengeS256(v);
    const c2 = codeChallengeS256(v);
    expect(c1).toBe(c2);
    expect(c1).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it('generateOidcState is non-empty', () => {
    expect(generateOidcState().length).toBeGreaterThan(10);
  });

  it('safeNextPath defaults to /home for OIDC callback', () => {
    expect(safeNextPath(null)).toBe('/home');
    expect(safeNextPath('/tools/web-capture')).toBe('/tools/web-capture');
    expect(safeNextPath('//evil')).toBe('/home');
  });
});

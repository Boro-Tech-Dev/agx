import { describe, expect, it } from 'vitest';

import { securityHeaders } from './securityHeaders.js';

const REQUIRED_KEYS = [
  'Strict-Transport-Security',
  'X-Frame-Options',
  'X-Content-Type-Options',
  'Referrer-Policy',
  'X-XSS-Protection',
] as const;

const EXCLUDED_KEYS = ['Content-Security-Policy', 'Permissions-Policy'] as const;

function headerValue(key: string): string | undefined {
  return securityHeaders.find((h) => h.key === key)?.value;
}

describe('securityHeaders', () => {
  it('includes headers aligned with problematticsolutions.com posture', () => {
    const keys = securityHeaders.map((h) => h.key);
    for (const required of REQUIRED_KEYS) {
      expect(keys).toContain(required);
    }
    for (const excluded of EXCLUDED_KEYS) {
      expect(keys).not.toContain(excluded);
    }
  });

  it('sets HSTS max-age to at least one year', () => {
    const hsts = headerValue('Strict-Transport-Security') ?? '';
    const match = /max-age=(\d+)/i.exec(hsts);
    expect(match).not.toBeNull();
    expect(Number(match![1])).toBeGreaterThanOrEqual(31_536_000);
    expect(hsts).toContain('includeSubDomains');
  });

  it('sets framing to same origin', () => {
    expect(headerValue('X-Frame-Options')).toBe('SAMEORIGIN');
  });
});

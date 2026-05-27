import { describe, expect, it } from 'vitest';

import { securityHeaders } from './securityHeaders.js';

const REQUIRED_KEYS = [
  'Strict-Transport-Security',
  'Content-Security-Policy',
  'X-Frame-Options',
  'X-Content-Type-Options',
  'Referrer-Policy',
  'Permissions-Policy',
  'X-XSS-Protection',
] as const;

function headerValue(key: string): string | undefined {
  return securityHeaders.find((h) => h.key === key)?.value;
}

describe('securityHeaders', () => {
  it('includes all required response headers', () => {
    const keys = securityHeaders.map((h) => h.key);
    for (const required of REQUIRED_KEYS) {
      expect(keys).toContain(required);
    }
  });

  it('sets HSTS max-age to at least one year', () => {
    const hsts = headerValue('Strict-Transport-Security') ?? '';
    const match = /max-age=(\d+)/i.exec(hsts);
    expect(match).not.toBeNull();
    expect(Number(match![1])).toBeGreaterThanOrEqual(31_536_000);
    expect(hsts).toContain('includeSubDomains');
  });

  it('restricts framing and form posts to same origin', () => {
    const csp = headerValue('Content-Security-Policy') ?? '';
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("form-action 'self'");
    expect(csp).toContain("default-src 'self'");
  });

  it('does not allow chrome-extension scripts outside production', () => {
    const csp = headerValue('Content-Security-Policy') ?? '';
    expect(process.env.NODE_ENV).not.toBe('production');
    expect(csp).not.toContain('chrome-extension:');
  });
});

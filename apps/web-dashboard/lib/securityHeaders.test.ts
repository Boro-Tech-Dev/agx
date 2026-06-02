import { describe, expect, it } from 'vitest';

import { buildContentSecurityPolicy, securityHeaders } from './securityHeaders.js';

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
    expect(csp).toContain("frame-src 'self'");
    expect(csp).toContain("form-action 'self'");
    expect(csp).toContain("default-src 'self'");
  });

  it('does not allow chrome-extension scripts in dev CSP', () => {
    const csp = buildContentSecurityPolicy({ production: false });
    expect(csp).not.toContain('chrome-extension:');
  });
});

describe('buildContentSecurityPolicy', () => {
  it('production CSP is tightened for corporate SWG', () => {
    const csp = buildContentSecurityPolicy({ production: true });
    expect(csp).toContain("script-src 'self' 'unsafe-inline'");
    expect(csp).not.toContain('chrome-extension:');
    expect(csp).toContain("connect-src 'self'");
    expect(csp).not.toMatch(/connect-src[^;]*https:/);
    expect(csp).toContain("img-src 'self' data: blob:");
    expect(csp).not.toMatch(/img-src[^;]*https:/);
    expect(csp).toContain("frame-src 'self'");
  });

  it('dev CSP allows https connect and images for local tooling', () => {
    const csp = buildContentSecurityPolicy({ production: false });
    expect(csp).toContain("connect-src 'self' https:");
    expect(csp).toContain("img-src 'self' data: blob: https:");
  });
});

import { describe, expect, it } from 'vitest';

import { absolutePublicUrl, requestPublicOrigin } from './requestPublicOrigin';

function fakeReq(
  url: string,
  headers: Record<string, string> = {},
): { headers: { get: (k: string) => string | null }; nextUrl: URL } {
  const nextUrl = new URL(url);
  return {
    headers: {
      get: (key: string) => headers[key.toLowerCase()] ?? headers[key] ?? null,
    },
    nextUrl,
  };
}

describe('requestPublicOrigin', () => {
  it('prefers APP_PUBLIC_ORIGIN over localhost req.url', () => {
    const prev = process.env.APP_PUBLIC_ORIGIN;
    process.env.APP_PUBLIC_ORIGIN = 'https://idea-impact.com';
    try {
      const req = fakeReq('http://localhost:3000/api/auth/login');
      expect(requestPublicOrigin(req)).toBe('https://idea-impact.com');
      expect(absolutePublicUrl(req, '/').href).toBe('https://idea-impact.com/');
    } finally {
      if (prev === undefined) delete process.env.APP_PUBLIC_ORIGIN;
      else process.env.APP_PUBLIC_ORIGIN = prev;
    }
  });

  it('uses x-forwarded headers when env unset', () => {
    const prev = process.env.APP_PUBLIC_ORIGIN;
    delete process.env.APP_PUBLIC_ORIGIN;
    try {
      const req = fakeReq('http://localhost:3000/login', {
        'x-forwarded-proto': 'https',
        'x-forwarded-host': 'idea-impact.com',
      });
      expect(requestPublicOrigin(req)).toBe('https://idea-impact.com');
    } finally {
      if (prev !== undefined) process.env.APP_PUBLIC_ORIGIN = prev;
    }
  });
});

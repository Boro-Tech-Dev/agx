import type { NextRequest } from 'next/server';
import type { NextResponse } from 'next/server';
import { decodeJwt } from 'jose';

import { ACCESS_TOKEN_COOKIE, REFRESH_TOKEN_COOKIE } from '../auth/constants';

/**
 * Use Secure cookies only on HTTPS (or when a TLS terminator sets x-forwarded-proto).
 * `NODE_ENV === 'production'` alone is wrong: Docker `next start` over http://localhost
 * would set Secure and browsers would drop the cookie, breaking login.
 */
export function cookieSecureForRequest(req: Pick<NextRequest, 'headers' | 'nextUrl'>): boolean {
  const o = (process.env.AUTH_COOKIE_SECURE || '').trim().toLowerCase();
  if (o === '0' || o === 'false') return false;
  if (o === '1' || o === 'true') return true;
  const xfp = req.headers.get('x-forwarded-proto')?.split(',')[0]?.trim().toLowerCase();
  if (xfp === 'https') return true;
  if (xfp === 'http') return false;
  return req.nextUrl.protocol === 'https:';
}

export function setAccessTokenCookie(
  res: NextResponse,
  accessToken: string,
  req: Pick<NextRequest, 'headers' | 'nextUrl'>,
): void {
  let maxAge = Math.max(60, Number(process.env.AUTH_COOKIE_MAX_AGE_SEC || 43200) || 43200);
  try {
    const { exp } = decodeJwt(accessToken);
    if (typeof exp === 'number') {
      const sec = exp - Math.floor(Date.now() / 1000);
      if (sec > 60) maxAge = sec;
    }
  } catch {
    /* use default */
  }
  res.cookies.set(ACCESS_TOKEN_COOKIE, accessToken, {
    httpOnly: true,
    secure: cookieSecureForRequest(req),
    sameSite: 'lax',
    path: '/',
    maxAge,
  });
}

export function clearAccessTokenCookie(res: NextResponse, req: Pick<NextRequest, 'headers' | 'nextUrl'>): void {
  res.cookies.set(ACCESS_TOKEN_COOKIE, '', {
    httpOnly: true,
    secure: cookieSecureForRequest(req),
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  });
}

/**
 * Refresh token max-age: use JWT `exp` when Keycloak issues a JWT refresh token; otherwise
 * `AUTH_REFRESH_COOKIE_MAX_AGE_SEC` (default 172800s = 48h, aligned with realm `ssoSessionIdleTimeout`).
 */
export function setRefreshTokenCookie(
  res: NextResponse,
  refreshToken: string,
  req: Pick<NextRequest, 'headers' | 'nextUrl'>,
): void {
  let maxAge = Math.max(3600, Number(process.env.AUTH_REFRESH_COOKIE_MAX_AGE_SEC || 172800) || 172800);
  try {
    const { exp } = decodeJwt(refreshToken);
    if (typeof exp === 'number') {
      const sec = exp - Math.floor(Date.now() / 1000);
      if (sec > 3600) maxAge = sec;
    }
  } catch {
    /* opaque refresh token — use AUTH_REFRESH_COOKIE_MAX_AGE_SEC */
  }
  res.cookies.set(REFRESH_TOKEN_COOKIE, refreshToken, {
    httpOnly: true,
    secure: cookieSecureForRequest(req),
    sameSite: 'lax',
    path: '/',
    maxAge,
  });
}

export function clearRefreshTokenCookie(res: NextResponse, req: Pick<NextRequest, 'headers' | 'nextUrl'>): void {
  res.cookies.set(REFRESH_TOKEN_COOKIE, '', {
    httpOnly: true,
    secure: cookieSecureForRequest(req),
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  });
}

export function clearAuthTokenCookies(res: NextResponse, req: Pick<NextRequest, 'headers' | 'nextUrl'>): void {
  clearAccessTokenCookie(res, req);
  clearRefreshTokenCookie(res, req);
}

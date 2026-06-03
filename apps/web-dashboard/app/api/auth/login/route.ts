import { decodeJwt } from 'jose';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { isAuthDisabled, keycloakBaseUrl } from '../../../../lib/auth/env';
import { loginErrorResponse, wantsJsonLoginResponse } from '../../../../lib/auth/loginRedirect';
import { safeNextPath } from '../../../../lib/auth/safeNextPath';
import { setAccessTokenCookie, setRefreshTokenCookie } from '../../../../lib/server/authCookies';
import { keycloakPasswordGrant } from '../../../../lib/server/keycloakPasswordGrant';
import { absolutePublicUrl } from '../../../../lib/server/requestPublicOrigin';

export const dynamic = 'force-dynamic';

function grantErrorMessage(bodyText: string): string {
  try {
    const j = JSON.parse(bodyText) as { error?: string; error_description?: string };
    const d = typeof j.error_description === 'string' ? j.error_description.trim() : '';
    const err = typeof j.error === 'string' ? j.error : '';
    if (
      err === 'unauthorized_client' ||
      d.toLowerCase().includes('invalid client') ||
      d.toLowerCase().includes('client credentials')
    ) {
      return 'Invalid Keycloak client secret (must match the web-dashboard client in Keycloak).';
    }
    if (d) return d.length > 280 ? `${d.slice(0, 280)}…` : d;
    if (err) return err;
  } catch {
    /* ignore */
  }
  return 'Sign-in failed.';
}

function parseBody(text: string, contentType: string): { username: string; password: string; next: string } | null {
  const ct = contentType.toLowerCase();
  if (ct.includes('application/json')) {
    try {
      const j = JSON.parse(text) as Record<string, unknown>;
      const username = typeof j.username === 'string' ? j.username : '';
      const password = typeof j.password === 'string' ? j.password : '';
      const next = typeof j.next === 'string' ? j.next : '/';
      if (!username || !password) return null;
      return { username, password, next };
    } catch {
      return null;
    }
  }
  if (ct.includes('application/x-www-form-urlencoded')) {
    const p = new URLSearchParams(text);
    const username = p.get('username') ?? '';
    const password = p.get('password') ?? '';
    const next = p.get('next') ?? '/';
    if (!username || !password) return null;
    return { username, password, next };
  }
  return null;
}

export async function POST(req: NextRequest) {
  const fallbackNext = safeNextPath(req.nextUrl.searchParams.get('next'));

  if (isAuthDisabled()) {
    return loginErrorResponse(req, 'Authentication is disabled (AUTH_DISABLED).', 400, fallbackNext);
  }

  const raw = await req.text();
  const parsed = parseBody(raw, req.headers.get('content-type') || '');
  if (!parsed) {
    return loginErrorResponse(req, 'Invalid credentials payload.', 400, fallbackNext);
  }

  const next = safeNextPath(parsed.next);

  if (!keycloakBaseUrl()) {
    return loginErrorResponse(
      req,
      'Sign-in is not configured (set KEYCLOAK_BASE_URL on the server, e.g. http://keycloak:8080 in Docker).',
      503,
      next,
    );
  }

  const grant = await keycloakPasswordGrant(parsed.username, parsed.password);
  if (grant.ok === false) {
    const { status, bodyText } = grant;
    const msg = grantErrorMessage(bodyText);
    if (status === 503) {
      return loginErrorResponse(req, msg, 503, next);
    }
    if (status >= 500) {
      return loginErrorResponse(
        req,
        `Keycloak is unreachable or returned an error (${status}). ${msg}`,
        503,
        next,
      );
    }
    return loginErrorResponse(req, msg, 401, next);
  }

  try {
    decodeJwt(grant.data.access_token);
  } catch {
    return loginErrorResponse(req, 'Invalid token response.', 502, next);
  }

  const wantsJson = wantsJsonLoginResponse(req.headers.get('accept'));

  const res = wantsJson
    ? NextResponse.json({ ok: true, next })
    : NextResponse.redirect(absolutePublicUrl(req, next), 302);

  setAccessTokenCookie(res, grant.data.access_token, req);
  if (typeof grant.data.refresh_token === 'string' && grant.data.refresh_token.trim()) {
    setRefreshTokenCookie(res, grant.data.refresh_token.trim(), req);
  }
  return res;
}

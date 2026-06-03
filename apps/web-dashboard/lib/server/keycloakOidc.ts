import { createHash, randomBytes } from 'crypto';

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import {
  OIDC_NEXT_COOKIE,
  OIDC_STATE_COOKIE,
  OIDC_VERIFIER_COOKIE,
} from '../auth/oidcConstants';
import { keycloakIssuer } from '../auth/env';
import { landingSigninFailedUrl } from '../auth/loginRedirect';
import { safeNextPath } from '../auth/safeNextPath';
import { cookieSecureForRequest } from './authCookies';
import { absolutePublicUrl, requestPublicOrigin } from './requestPublicOrigin';

export type OidcTokenResponse = {
  access_token: string;
  refresh_token?: string;
  id_token?: string;
};

export type OidcExchangeResult =
  | { ok: true; data: OidcTokenResponse; next: string }
  | { ok: false; message: string };

function base64UrlEncode(buf: Buffer): string {
  return buf.toString('base64url');
}

export function generateCodeVerifier(): string {
  return base64UrlEncode(randomBytes(32));
}

export function codeChallengeS256(verifier: string): string {
  return createHash('sha256').update(verifier).digest('base64url');
}

export function generateOidcState(): string {
  return base64UrlEncode(randomBytes(16));
}

function clientCredentials(): { clientId: string; clientSecret: string } {
  const clientId = (process.env.KEYCLOAK_CLIENT_ID || 'web-dashboard').trim();
  const clientSecret =
    (process.env.KEYCLOAK_CLIENT_SECRET || '').trim() || 'web-dashboard-dev-secret';
  return { clientId, clientSecret };
}

function authorizeEndpoint(issuer: string): string {
  return `${issuer.replace(/\/$/, '')}/protocol/openid-connect/auth`;
}

function tokenEndpoint(issuer: string): string {
  return `${issuer.replace(/\/$/, '')}/protocol/openid-connect/logout`.replace('/logout', '/token');
}

export function endSessionEndpoint(issuer: string): string {
  return `${issuer.replace(/\/$/, '')}/protocol/openid-connect/logout`;
}

const OIDC_COOKIE_MAX_AGE = 600;

function setOidcFlowCookies(
  res: NextResponse,
  req: Pick<NextRequest, 'headers' | 'nextUrl'>,
  state: string,
  verifier: string,
  next: string,
): void {
  const secure = cookieSecureForRequest(req);
  const base = { httpOnly: true, secure, sameSite: 'lax' as const, path: '/', maxAge: OIDC_COOKIE_MAX_AGE };
  res.cookies.set(OIDC_STATE_COOKIE, state, base);
  res.cookies.set(OIDC_VERIFIER_COOKIE, verifier, base);
  res.cookies.set(OIDC_NEXT_COOKIE, next, base);
}

function clearOidcFlowCookies(res: NextResponse, req: Pick<NextRequest, 'headers' | 'nextUrl'>): void {
  const secure = cookieSecureForRequest(req);
  const base = { httpOnly: true, secure, sameSite: 'lax' as const, path: '/', maxAge: 0 };
  res.cookies.set(OIDC_STATE_COOKIE, '', base);
  res.cookies.set(OIDC_VERIFIER_COOKIE, '', base);
  res.cookies.set(OIDC_NEXT_COOKIE, '', base);
}

/** True when KEYCLOAK_ISSUER would send users to Keycloak on the app host (broken + RBI risk). */
export function issuerHostMatchesAppHost(issuer: string, appOrigin: string): boolean {
  try {
    return new URL(issuer).hostname === new URL(appOrigin).hostname;
  } catch {
    return false;
  }
}

function redirectLandingSigninFailed(req: NextRequest): NextResponse {
  return NextResponse.redirect(landingSigninFailedUrl(requestPublicOrigin(req)), 302);
}

/** Start OIDC authorization code flow with PKCE; redirect to Keycloak. */
export function buildAuthorizeRedirect(req: NextRequest, nextPath: string): NextResponse {
  const issuer = keycloakIssuer();
  if (!issuer) {
    return redirectLandingSigninFailed(req);
  }

  if (issuerHostMatchesAppHost(issuer, requestPublicOrigin(req))) {
    console.error(
      '[oidc] KEYCLOAK_ISSUER hostname must differ from APP_PUBLIC_ORIGIN — fix env and redeploy',
    );
    return redirectLandingSigninFailed(req);
  }

  const next = safeNextPath(nextPath);
  const state = generateOidcState();
  const verifier = generateCodeVerifier();
  const challenge = codeChallengeS256(verifier);
  const { clientId } = clientCredentials();
  const redirectUri = absolutePublicUrl(req, '/api/auth/callback').href;

  const authUrl = new URL(authorizeEndpoint(issuer));
  authUrl.searchParams.set('client_id', clientId);
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('scope', 'openid');
  authUrl.searchParams.set('redirect_uri', redirectUri);
  authUrl.searchParams.set('state', state);
  authUrl.searchParams.set('code_challenge', challenge);
  authUrl.searchParams.set('code_challenge_method', 'S256');

  const res = NextResponse.redirect(authUrl, 302);
  setOidcFlowCookies(res, req, state, verifier, next);
  return res;
}

/** Exchange authorization code for tokens; validates PKCE state cookies. */
export async function exchangeAuthorizationCode(req: NextRequest): Promise<OidcExchangeResult> {
  const issuer = keycloakIssuer();
  if (!issuer) {
    return { ok: false, message: 'Sign-in is not configured.' };
  }

  const code = req.nextUrl.searchParams.get('code')?.trim();
  const state = req.nextUrl.searchParams.get('state')?.trim();
  if (!code || !state) {
    return { ok: false, message: 'Missing authorization code or state.' };
  }

  const expectedState = req.cookies.get(OIDC_STATE_COOKIE)?.value;
  const verifier = req.cookies.get(OIDC_VERIFIER_COOKIE)?.value;
  const next = safeNextPath(req.cookies.get(OIDC_NEXT_COOKIE)?.value);

  if (!expectedState || !verifier || state !== expectedState) {
    return { ok: false, message: 'Invalid or expired sign-in session.' };
  }

  const { clientId, clientSecret } = clientCredentials();
  const redirectUri = absolutePublicUrl(req, '/api/auth/callback').href;
  const tokenUrl = `${issuer.replace(/\/$/, '')}/protocol/openid-connect/token`;

  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    client_id: clientId,
    client_secret: clientSecret,
    code,
    redirect_uri: redirectUri,
    code_verifier: verifier,
  });

  let res: Response;
  try {
    res = await fetch(tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
      cache: 'no-store',
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, message: `Keycloak is unreachable: ${msg}` };
  }

  const bodyText = await res.text();
  if (!res.ok) {
    let detail = 'Sign-in failed.';
    try {
      const j = JSON.parse(bodyText) as { error_description?: string; error?: string };
      if (j.error_description) detail = j.error_description;
      else if (j.error) detail = j.error;
    } catch {
      /* ignore */
    }
    return { ok: false, message: detail };
  }

  let json: Record<string, unknown>;
  try {
    json = JSON.parse(bodyText) as Record<string, unknown>;
  } catch {
    return { ok: false, message: 'Invalid token response from Keycloak.' };
  }

  if (typeof json.access_token !== 'string') {
    return { ok: false, message: 'Invalid token response from Keycloak.' };
  }

  return {
    ok: true,
    next,
    data: {
      access_token: json.access_token,
      refresh_token: typeof json.refresh_token === 'string' ? json.refresh_token : undefined,
      id_token: typeof json.id_token === 'string' ? json.id_token : undefined,
    },
  };
}

/** RP-initiated logout URL; caller clears session cookies on the response. */
export function buildLogoutRedirect(req: NextRequest, idTokenHint?: string): URL {
  const issuer = keycloakIssuer();
  const landing = absolutePublicUrl(req, '/');
  if (!issuer) return landing;

  const logout = new URL(endSessionEndpoint(issuer));
  logout.searchParams.set('post_logout_redirect_uri', landing.href);
  const { clientId } = clientCredentials();
  logout.searchParams.set('client_id', clientId);
  if (idTokenHint?.trim()) {
    logout.searchParams.set('id_token_hint', idTokenHint.trim());
  }
  return logout;
}

export function clearOidcFlowCookiesOnResponse(
  res: NextResponse,
  req: Pick<NextRequest, 'headers' | 'nextUrl'>,
): void {
  clearOidcFlowCookies(res, req);
}

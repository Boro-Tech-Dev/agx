import { decodeJwt } from 'jose';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { setAccessTokenCookie, setRefreshTokenCookie } from '../../../../lib/server/authCookies';
import {
  clearOidcFlowCookiesOnResponse,
  exchangeAuthorizationCode,
} from '../../../../lib/server/keycloakOidc';
import { absolutePublicUrl } from '../../../../lib/server/requestPublicOrigin';

export const dynamic = 'force-dynamic';

function redirectOidcRetry(req: NextRequest): NextResponse {
  const res = NextResponse.redirect(absolutePublicUrl(req, '/api/auth/login'), 302);
  clearOidcFlowCookiesOnResponse(res, req);
  return res;
}

export async function GET(req: NextRequest) {
  const oauthError = req.nextUrl.searchParams.get('error_description')
    || req.nextUrl.searchParams.get('error');
  if (oauthError) {
    return redirectOidcRetry(req);
  }

  const result = await exchangeAuthorizationCode(req);
  if (result.ok === false) {
    return redirectOidcRetry(req);
  }

  try {
    decodeJwt(result.data.access_token);
  } catch {
    return redirectOidcRetry(req);
  }

  const res = NextResponse.redirect(absolutePublicUrl(req, result.next), 302);
  clearOidcFlowCookiesOnResponse(res, req);
  setAccessTokenCookie(res, result.data.access_token, req);
  if (result.data.refresh_token?.trim()) {
    setRefreshTokenCookie(res, result.data.refresh_token.trim(), req);
  }
  return res;
}

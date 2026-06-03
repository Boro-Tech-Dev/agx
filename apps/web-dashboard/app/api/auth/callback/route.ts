import { decodeJwt } from 'jose';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { capLoginErrorMessage } from '../../../../lib/auth/loginRedirect';
import { setAccessTokenCookie, setRefreshTokenCookie } from '../../../../lib/server/authCookies';
import {
  clearOidcFlowCookiesOnResponse,
  exchangeAuthorizationCode,
} from '../../../../lib/server/keycloakOidc';
import { absolutePublicUrl } from '../../../../lib/server/requestPublicOrigin';

export const dynamic = 'force-dynamic';

function redirectLandingWithError(req: NextRequest, message: string): NextResponse {
  const url = absolutePublicUrl(req, '/');
  url.searchParams.set('error', capLoginErrorMessage(message));
  const res = NextResponse.redirect(url, 302);
  clearOidcFlowCookiesOnResponse(res, req);
  return res;
}

export async function GET(req: NextRequest) {
  const oauthError = req.nextUrl.searchParams.get('error_description')
    || req.nextUrl.searchParams.get('error');
  if (oauthError) {
    return redirectLandingWithError(req, oauthError);
  }

  const result = await exchangeAuthorizationCode(req);
  if (result.ok === false) {
    return redirectLandingWithError(req, result.message);
  }

  try {
    decodeJwt(result.data.access_token);
  } catch {
    return redirectLandingWithError(req, 'Invalid token response.');
  }

  const res = NextResponse.redirect(absolutePublicUrl(req, result.next), 302);
  clearOidcFlowCookiesOnResponse(res, req);
  setAccessTokenCookie(res, result.data.access_token, req);
  if (result.data.refresh_token?.trim()) {
    setRefreshTokenCookie(res, result.data.refresh_token.trim(), req);
  }
  return res;
}

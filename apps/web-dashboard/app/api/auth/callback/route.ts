import { decodeJwt } from 'jose';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { landingSigninFailedUrl } from '../../../../lib/auth/loginRedirect';
import { setAccessTokenCookie, setRefreshTokenCookie } from '../../../../lib/server/authCookies';
import {
  clearOidcFlowCookiesOnResponse,
  exchangeAuthorizationCode,
} from '../../../../lib/server/keycloakOidc';
import { absolutePublicUrl, requestPublicOrigin } from '../../../../lib/server/requestPublicOrigin';

export const dynamic = 'force-dynamic';

function redirectLandingSigninFailed(req: NextRequest): NextResponse {
  const res = NextResponse.redirect(landingSigninFailedUrl(requestPublicOrigin(req)), 302);
  clearOidcFlowCookiesOnResponse(res, req);
  return res;
}

export async function GET(req: NextRequest) {
  const oauthError = req.nextUrl.searchParams.get('error_description')
    || req.nextUrl.searchParams.get('error');
  if (oauthError) {
    return redirectLandingSigninFailed(req);
  }

  const result = await exchangeAuthorizationCode(req);
  if (result.ok === false) {
    return redirectLandingSigninFailed(req);
  }

  try {
    decodeJwt(result.data.access_token);
  } catch {
    return redirectLandingSigninFailed(req);
  }

  const res = NextResponse.redirect(absolutePublicUrl(req, result.next), 302);
  clearOidcFlowCookiesOnResponse(res, req);
  setAccessTokenCookie(res, result.data.access_token, req);
  if (result.data.refresh_token?.trim()) {
    setRefreshTokenCookie(res, result.data.refresh_token.trim(), req);
  }
  return res;
}

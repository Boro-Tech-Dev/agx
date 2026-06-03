import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { ACCESS_TOKEN_COOKIE } from '../../../../lib/auth/constants';
import { isAuthDisabled } from '../../../../lib/auth/env';
import { clearAuthTokenCookies } from '../../../../lib/server/authCookies';
import { buildLogoutRedirect } from '../../../../lib/server/keycloakOidc';
import { absolutePublicUrl } from '../../../../lib/server/requestPublicOrigin';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const accept = req.headers.get('accept') || '';
  const wantsJson = accept.includes('application/json') && !accept.includes('text/html');

  const idTokenHint = req.cookies.get(ACCESS_TOKEN_COOKIE)?.value;
  const logoutUrl = buildLogoutRedirect(req, idTokenHint);

  const res = wantsJson
    ? NextResponse.json({ ok: true, next: '/' })
    : NextResponse.redirect(logoutUrl, 302);

  clearAuthTokenCookies(res, req);
  return res;
}

export async function GET(req: NextRequest) {
  if (isAuthDisabled()) {
    return NextResponse.redirect(absolutePublicUrl(req, '/'), 302);
  }
  return POST(req);
}

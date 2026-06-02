import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { safeNextPath } from './safeNextPath';

/** Set by middleware on GET /login so root layout skips dashboard client providers. */
export const LOGIN_ROUTE_HEADER = 'x-ragtag-login-route';

const MAX_ERROR_LEN = 280;

export function capLoginErrorMessage(message: string): string {
  const t = message.trim();
  if (!t) return 'Sign-in failed.';
  return t.length > MAX_ERROR_LEN ? `${t.slice(0, MAX_ERROR_LEN)}…` : t;
}

export function wantsJsonLoginResponse(acceptHeader: string | null): boolean {
  const accept = acceptHeader || '';
  return accept.includes('application/json') && !accept.includes('text/html');
}

export function buildLoginErrorUrl(baseUrl: string, message: string, next: string): URL {
  const login = new URL('/login', baseUrl);
  login.searchParams.set('error', capLoginErrorMessage(message));
  login.searchParams.set('next', safeNextPath(next));
  return login;
}

export function redirectToLoginWithError(
  req: Pick<NextRequest, 'url'>,
  message: string,
  next: string,
): NextResponse {
  return NextResponse.redirect(buildLoginErrorUrl(req.url, message, next), 302);
}

export function loginErrorResponse(
  req: NextRequest,
  message: string,
  status: number,
  next: string,
): NextResponse {
  if (wantsJsonLoginResponse(req.headers.get('accept'))) {
    return NextResponse.json({ error: capLoginErrorMessage(message) }, { status });
  }
  return redirectToLoginWithError(req, message, next);
}

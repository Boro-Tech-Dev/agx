import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { isAuthDisabled } from './lib/auth/env';
import { safeNextPath } from './lib/auth/safeNextPath';
import { verifyAccessToken } from './lib/auth/verifyAccessToken';
import { ACCESS_TOKEN_COOKIE } from './lib/auth/constants';
import { isWebManifestProbe } from './lib/webManifestProbe';

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (isWebManifestProbe(pathname)) {
    return new NextResponse('Not Found', {
      status: 404,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    });
  }

  if (isAuthDisabled()) return NextResponse.next();

  if (pathname === '/login' || pathname.startsWith('/api/auth/')) {
    return NextResponse.next();
  }

  if (pathname === '/health') {
    return NextResponse.next();
  }

  /** Agent BFF proxy resolves session (access JWT + optional refresh) in route handler; skip duplicate `verifyAccessToken` here. */
  if (pathname === '/api' || pathname.startsWith('/api/')) {
    return NextResponse.next();
  }

  const token = req.cookies.get(ACCESS_TOKEN_COOKIE)?.value;
  if (!token) {
    return redirectToLogin(req);
  }

  const ok = await verifyAccessToken(token);
  if (!ok) {
    return redirectToLogin(req);
  }

  return NextResponse.next();
}

function redirectToLogin(req: NextRequest) {
  const login = new URL('/login', req.url);
  const path = req.nextUrl.pathname + req.nextUrl.search;
  login.searchParams.set('next', safeNextPath(path));
  return NextResponse.redirect(login);
}

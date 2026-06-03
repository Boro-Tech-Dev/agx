import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { isAuthDisabled } from './lib/auth/env';
import { safeNextPath } from './lib/auth/safeNextPath';
import { verifyAccessToken } from './lib/auth/verifyAccessToken';
import { ACCESS_TOKEN_COOKIE } from './lib/auth/constants';
import { isPublicStaticAsset } from './lib/publicStaticProbe';
import { isWebManifestProbe } from './lib/webManifestProbe';
import { absolutePublicUrl } from './lib/server/requestPublicOrigin';

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|icon.svg|apple-touch-icon).*)'],
};

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (isWebManifestProbe(pathname)) {
    return new NextResponse('Not Found', {
      status: 404,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    });
  }

  if (pathname === '/robots.txt') {
    return new NextResponse('Not Found', {
      status: 404,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    });
  }

  if (isPublicStaticAsset(pathname)) {
    return NextResponse.next();
  }

  if (isAuthDisabled()) {
    return NextResponse.next();
  }

  if (pathname === '/login') {
    return NextResponse.next();
  }

  if (pathname.startsWith('/api/auth/')) {
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
  const sessionValid = token ? await verifyAccessToken(token) : false;

  if (pathname === '/') {
    if (sessionValid) {
      return NextResponse.redirect(absolutePublicUrl(req, '/home'), 302);
    }
    return NextResponse.redirect(absolutePublicUrl(req, '/api/auth/login'), 302);
  }

  if (!token || !sessionValid) {
    return redirectToLogin(req);
  }

  return NextResponse.next();
}

function redirectToLogin(req: NextRequest) {
  const login = absolutePublicUrl(req, '/login');
  const path = req.nextUrl.pathname + req.nextUrl.search;
  login.searchParams.set('next', safeNextPath(path));
  return NextResponse.redirect(login);
}

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { clearAuthTokenCookies } from '../../../../lib/server/authCookies';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const accept = req.headers.get('accept') || '';
  const wantsJson = accept.includes('application/json') && !accept.includes('text/html');

  const res = wantsJson
    ? NextResponse.json({ ok: true, next: '/login' })
    : NextResponse.redirect(new URL('/login', req.url), 302);

  clearAuthTokenCookies(res, req);
  return res;
}

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { safeNextPath } from '../../lib/auth/safeNextPath';
import { absolutePublicUrl } from '../../lib/server/requestPublicOrigin';

export const dynamic = 'force-dynamic';

/** Public entry: redirect to OIDC login (no HTML credential form). */
export async function GET(req: NextRequest) {
  const login = absolutePublicUrl(req, '/api/auth/login');
  const rawNext = req.nextUrl.searchParams.get('next');
  if (rawNext != null && rawNext !== '') {
    login.searchParams.set('next', safeNextPath(rawNext));
  }
  return NextResponse.redirect(login, 302);
}

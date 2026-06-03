import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { safeNextPath } from '../../lib/auth/safeNextPath';
import { absolutePublicUrl } from '../../lib/server/requestPublicOrigin';

export const dynamic = 'force-dynamic';

/** Public entry: redirect to OIDC login (no HTML credential form). */
export async function GET(req: NextRequest) {
  const next = safeNextPath(req.nextUrl.searchParams.get('next'));
  const login = absolutePublicUrl(req, '/api/auth/login');
  if (req.nextUrl.searchParams.get('next')) {
    login.searchParams.set('next', next);
  }
  return NextResponse.redirect(login, 302);
}

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { isAuthDisabled } from '../../../../lib/auth/env';
import { safeNextPath } from '../../../../lib/auth/safeNextPath';
import { buildAuthorizeRedirect } from '../../../../lib/server/keycloakOidc';
import { absolutePublicUrl } from '../../../../lib/server/requestPublicOrigin';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  if (isAuthDisabled()) {
    return NextResponse.redirect(absolutePublicUrl(req, '/home'), 302);
  }

  const next = safeNextPath(req.nextUrl.searchParams.get('next'));
  return buildAuthorizeRedirect(req, next);
}

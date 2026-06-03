import type { NextRequest } from 'next/server';

import { keycloakIssuer } from '../lib/auth/env';
import { buildLandingHtml } from '../lib/public/landingPage';

export const dynamic = 'force-dynamic';

const DEFAULT_IDP_HOST = 'auth.idea-impact.com';

function idpHostFromIssuer(): string {
  const issuer = keycloakIssuer();
  if (!issuer) return DEFAULT_IDP_HOST;
  try {
    return new URL(issuer).hostname;
  } catch {
    return DEFAULT_IDP_HOST;
  }
}

export async function GET(req: NextRequest) {
  const signinFailed = req.nextUrl.searchParams.get('signin') === 'failed';
  const html = buildLandingHtml({ signinFailed, idpHost: idpHostFromIssuer() });

  return new Response(html, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'private, no-cache, no-store, max-age=0, must-revalidate',
    },
  });
}

import { decodeJwt } from 'jose';
import type { NextRequest } from 'next/server';

import { ACCESS_TOKEN_COOKIE } from '../auth/constants';
import { isAuthDisabled } from '../auth/env';
import { verifyAccessToken } from '../auth/verifyAccessToken';

const LOCAL_DEV_SUB = 'local-dev';

/**
 * Returns Keycloak `sub` when the access token is valid, or `local-dev` when AUTH_DISABLED.
 */
export async function resolveDashboardUserSub(req: NextRequest): Promise<string | null> {
  if (isAuthDisabled()) return LOCAL_DEV_SUB;
  const token = req.cookies.get(ACCESS_TOKEN_COOKIE)?.value;
  if (!token?.trim()) return null;
  if (!(await verifyAccessToken(token))) return null;
  try {
    const payload = decodeJwt(token);
    return typeof payload.sub === 'string' ? payload.sub : null;
  } catch {
    return null;
  }
}

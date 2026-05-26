import type { NextRequest } from 'next/server';
import type { NextResponse } from 'next/server';

import { ACCESS_TOKEN_COOKIE, REFRESH_TOKEN_COOKIE } from '../auth/constants';
import { isAuthDisabled } from '../auth/env';
import { verifyAccessToken } from '../auth/verifyAccessToken';
import {
  clearAuthTokenCookies,
  setAccessTokenCookie,
  setRefreshTokenCookie,
} from './authCookies';
import { keycloakRefreshGrant } from './keycloakRefreshGrant';

export type ResolveDashboardSessionResult =
  | { kind: 'ok' }
  | {
      kind: 'refreshed';
      applySessionCookies: (res: NextResponse, req: NextRequest) => void;
    }
  | {
      kind: 'unauthorized';
      applyClearCookies: (res: NextResponse, req: NextRequest) => void;
    };

/**
 * Validates dashboard session for BFF `/api/*` proxy: valid access JWT, or successful
 * Keycloak refresh using `dd_refresh_token` with re-verification of the new access token.
 */
export async function resolveDashboardSession(req: NextRequest): Promise<ResolveDashboardSessionResult> {
  if (isAuthDisabled()) {
    return { kind: 'ok' };
  }

  const access = req.cookies.get(ACCESS_TOKEN_COOKIE)?.value;
  const refresh = req.cookies.get(REFRESH_TOKEN_COOKIE)?.value;

  if (access?.trim() && (await verifyAccessToken(access))) {
    return { kind: 'ok' };
  }

  if (!refresh?.trim()) {
    return {
      kind: 'unauthorized',
      applyClearCookies(res, reqInner) {
        if (access?.trim() || refresh?.trim()) {
          clearAuthTokenCookies(res, reqInner);
        }
      },
    };
  }

  const grant = await keycloakRefreshGrant(refresh.trim());
  if (!grant.ok) {
    return {
      kind: 'unauthorized',
      applyClearCookies(res, reqInner) {
        clearAuthTokenCookies(res, reqInner);
      },
    };
  }

  const newAccess = grant.data.access_token;
  const rotatedRefresh = grant.data.refresh_token;
  const refreshToStore = typeof rotatedRefresh === 'string' && rotatedRefresh.trim() ? rotatedRefresh : refresh;

  if (!(await verifyAccessToken(newAccess))) {
    return {
      kind: 'unauthorized',
      applyClearCookies(res, reqInner) {
        clearAuthTokenCookies(res, reqInner);
      },
    };
  }

  return {
    kind: 'refreshed',
    applySessionCookies(res, reqInner) {
      setAccessTokenCookie(res, newAccess, reqInner);
      setRefreshTokenCookie(res, refreshToStore, reqInner);
    },
  };
}

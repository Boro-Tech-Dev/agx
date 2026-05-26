import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';

vi.mock('../auth/env', () => ({
  isAuthDisabled: vi.fn(),
}));

vi.mock('../auth/verifyAccessToken', () => ({
  verifyAccessToken: vi.fn(),
}));

vi.mock('./keycloakRefreshGrant', () => ({
  keycloakRefreshGrant: vi.fn(),
}));

import { isAuthDisabled } from '../auth/env';
import { verifyAccessToken } from '../auth/verifyAccessToken';
import { ACCESS_TOKEN_COOKIE, REFRESH_TOKEN_COOKIE } from '../auth/constants';
import { keycloakRefreshGrant } from './keycloakRefreshGrant';
import { resolveDashboardSession } from './resolveDashboardSession';

const mockedIsAuthDisabled = vi.mocked(isAuthDisabled);
const mockedVerify = vi.mocked(verifyAccessToken);
const mockedRefresh = vi.mocked(keycloakRefreshGrant);

function reqWithCookies(pairs: Record<string, string>) {
  const parts = Object.entries(pairs).map(([k, v]) => `${k}=${v}`);
  return new NextRequest('http://localhost/api/web/health', {
    headers: { cookie: parts.join('; ') },
  });
}

describe('resolveDashboardSession', () => {
  beforeEach(() => {
    mockedIsAuthDisabled.mockReturnValue(false);
    mockedVerify.mockReset();
    mockedRefresh.mockReset();
  });

  it('returns ok when auth is disabled', async () => {
    mockedIsAuthDisabled.mockReturnValue(true);

    const out = await resolveDashboardSession(new NextRequest('http://localhost/api/x'));

    expect(out).toEqual({ kind: 'ok' });
    expect(mockedVerify).not.toHaveBeenCalled();
    expect(mockedRefresh).not.toHaveBeenCalled();
  });

  it('returns ok when access token verifies', async () => {
    mockedVerify.mockResolvedValue(true);

    const req = reqWithCookies({ [ACCESS_TOKEN_COOKIE]: 'valid.jwt.here' });
    const out = await resolveDashboardSession(req);

    expect(out.kind).toBe('ok');
    expect(mockedRefresh).not.toHaveBeenCalled();
  });

  it('returns unauthorized without calling Keycloak when refresh cookie is missing', async () => {
    mockedVerify.mockResolvedValue(false);

    const req = reqWithCookies({ [ACCESS_TOKEN_COOKIE]: 'stale' });
    const out = await resolveDashboardSession(req);

    expect(out.kind).toBe('unauthorized');
    expect(mockedRefresh).not.toHaveBeenCalled();

    const res = NextResponse.json({});
    if (out.kind === 'unauthorized') {
      out.applyClearCookies(res, req);
    }
    const cleared = res.cookies.getAll().map((c) => c.name);
    expect(cleared).toContain(ACCESS_TOKEN_COOKIE);
    expect(cleared).toContain(REFRESH_TOKEN_COOKIE);
  });

  it('returns unauthorized without Set-Cookie when no tokens were sent', async () => {
    mockedVerify.mockResolvedValue(false);

    const req = new NextRequest('http://localhost/api/x');
    const out = await resolveDashboardSession(req);

    expect(out.kind).toBe('unauthorized');
    const res = NextResponse.json({});
    if (out.kind === 'unauthorized') {
      out.applyClearCookies(res, req);
    }
    expect(res.cookies.getAll()).toHaveLength(0);
  });

  it('returns refreshed and applies cookies when refresh grant succeeds', async () => {
    mockedVerify.mockImplementation(async (token: string) => token === 'new-access');

    mockedRefresh.mockResolvedValue({
      ok: true,
      data: { access_token: 'new-access', refresh_token: 'rotated-refresh' },
    });

    const req = reqWithCookies({
      [ACCESS_TOKEN_COOKIE]: 'expired',
      [REFRESH_TOKEN_COOKIE]: 'old-refresh',
    });
    const out = await resolveDashboardSession(req);

    expect(out.kind).toBe('refreshed');
    expect(mockedRefresh).toHaveBeenCalledWith('old-refresh');

    const res = NextResponse.json({ ok: true });
    if (out.kind === 'refreshed') {
      out.applySessionCookies(res, req);
    }
    expect(res.cookies.get(ACCESS_TOKEN_COOKIE)?.value).toBe('new-access');
    expect(res.cookies.get(REFRESH_TOKEN_COOKIE)?.value).toBe('rotated-refresh');
  });

  it('returns unauthorized and clears cookies when refresh grant fails', async () => {
    mockedVerify.mockResolvedValue(false);

    mockedRefresh.mockResolvedValue({
      ok: false,
      status: 400,
      bodyText: '{"error":"invalid_grant"}',
    });

    const req = reqWithCookies({ [REFRESH_TOKEN_COOKIE]: 'bad-refresh' });
    const out = await resolveDashboardSession(req);

    expect(out.kind).toBe('unauthorized');
    const res = NextResponse.json({}, { status: 401 });
    if (out.kind === 'unauthorized') {
      out.applyClearCookies(res, req);
    }
    expect(res.cookies.get(ACCESS_TOKEN_COOKIE)?.maxAge).toBe(0);
    expect(res.cookies.get(REFRESH_TOKEN_COOKIE)?.maxAge).toBe(0);
  });

  it('returns unauthorized when new access fails verifyAccessToken', async () => {
    mockedVerify.mockResolvedValue(false);

    mockedRefresh.mockResolvedValue({
      ok: true,
      data: { access_token: 'new-but-wrong-iss' },
    });

    const req = reqWithCookies({ [REFRESH_TOKEN_COOKIE]: 'rt' });
    const out = await resolveDashboardSession(req);

    expect(out.kind).toBe('unauthorized');
  });
});

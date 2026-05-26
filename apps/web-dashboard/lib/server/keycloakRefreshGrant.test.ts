import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { keycloakRefreshGrant } from './keycloakRefreshGrant';

describe('keycloakRefreshGrant', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock);
    process.env.KEYCLOAK_BASE_URL = 'http://keycloak:8080';
    process.env.KEYCLOAK_REALM = 'platform';
    process.env.KEYCLOAK_CLIENT_ID = 'web-dashboard';
    process.env.KEYCLOAK_CLIENT_SECRET = 'web-dashboard-dev-secret';
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    fetchMock.mockReset();
    delete process.env.KEYCLOAK_BASE_URL;
    delete process.env.KEYCLOAK_REALM;
    delete process.env.KEYCLOAK_CLIENT_ID;
    delete process.env.KEYCLOAK_CLIENT_SECRET;
  });

  it('posts refresh_token grant with client credentials', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      text: async () =>
        JSON.stringify({
          access_token: 'new-access',
          refresh_token: 'new-refresh',
        }),
    });

    const out = await keycloakRefreshGrant('old-refresh');

    expect(out.ok).toBe(true);
    if (out.ok) {
      expect(out.data.access_token).toBe('new-access');
      expect(out.data.refresh_token).toBe('new-refresh');
    }

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('http://keycloak:8080/realms/platform/protocol/openid-connect/token');
    expect(init.method).toBe('POST');
    expect(init.headers).toEqual({ 'Content-Type': 'application/x-www-form-urlencoded' });
    const body = init.body as URLSearchParams;
    expect(body.get('grant_type')).toBe('refresh_token');
    expect(body.get('client_id')).toBe('web-dashboard');
    expect(body.get('client_secret')).toBe('web-dashboard-dev-secret');
    expect(body.get('refresh_token')).toBe('old-refresh');
  });

  it('returns ok without refresh_token in JSON when Keycloak omits rotation', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      text: async () => JSON.stringify({ access_token: 'only-access' }),
    });

    const out = await keycloakRefreshGrant('rt');

    expect(out.ok).toBe(true);
    if (out.ok) {
      expect(out.data.refresh_token).toBeUndefined();
    }
  });

  it('returns ok: false with status on HTTP error', async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 400,
      text: async () => JSON.stringify({ error: 'invalid_grant' }),
    });

    const out = await keycloakRefreshGrant('bad');

    expect(out.ok).toBe(false);
    if (out.ok === false) {
      expect(out.status).toBe(400);
      expect(out.bodyText).toContain('invalid_grant');
    }
  });

  it('returns 503 when KEYCLOAK_BASE_URL is unset', async () => {
    delete process.env.KEYCLOAK_BASE_URL;

    const out = await keycloakRefreshGrant('rt');

    expect(out.ok).toBe(false);
    if (out.ok === false) {
      expect(out.status).toBe(503);
    }
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

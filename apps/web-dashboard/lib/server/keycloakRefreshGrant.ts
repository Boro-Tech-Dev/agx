import { keycloakBaseUrl, keycloakRealm } from '../auth/env';

export type KeycloakRefreshTokenResponse = {
  access_token: string;
  refresh_token?: string;
};

export type KeycloakRefreshGrantResult =
  | { ok: true; data: KeycloakRefreshTokenResponse }
  | { ok: false; status: number; bodyText: string };

/** Refresh grant to Keycloak; client credentials match `keycloakPasswordGrant`. */
export async function keycloakRefreshGrant(refreshToken: string): Promise<KeycloakRefreshGrantResult> {
  const base = keycloakBaseUrl();
  const realm = keycloakRealm();
  const clientId = (process.env.KEYCLOAK_CLIENT_ID || 'web-dashboard').trim();
  const clientSecret =
    (process.env.KEYCLOAK_CLIENT_SECRET || '').trim() || 'web-dashboard-dev-secret';

  if (!base) {
    return {
      ok: false,
      status: 503,
      bodyText: '{"error":"configuration","error_description":"KEYCLOAK_BASE_URL is not set"}',
    };
  }

  const tokenUrl = `${base}/realms/${encodeURIComponent(realm)}/protocol/openid-connect/token`;
  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: refreshToken,
  });

  const res = await fetch(tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
    cache: 'no-store',
  });
  const bodyText = await res.text();
  if (!res.ok) {
    return { ok: false, status: res.status, bodyText };
  }
  let json: Record<string, unknown>;
  try {
    json = JSON.parse(bodyText) as Record<string, unknown>;
  } catch {
    return {
      ok: false,
      status: 502,
      bodyText: '{"error":"parse","error_description":"Invalid JSON from token endpoint"}',
    };
  }
  if (typeof json.access_token !== 'string') {
    return { ok: false, status: 502, bodyText: bodyText.slice(0, 2000) };
  }
  return {
    ok: true,
    data: {
      access_token: json.access_token,
      refresh_token: typeof json.refresh_token === 'string' ? json.refresh_token : undefined,
    },
  };
}

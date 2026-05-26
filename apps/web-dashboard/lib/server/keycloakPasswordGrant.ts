import { keycloakBaseUrl, keycloakRealm } from '../auth/env';

export type KeycloakTokenResponse = {
  access_token: string;
  expires_in?: number;
  refresh_token?: string;
};

export type KeycloakPasswordGrantResult =
  | { ok: true; data: KeycloakTokenResponse }
  | { ok: false; status: number; bodyText: string };

/**
 * Password grant to Keycloak. Client secret falls back to the realm import default when env is
 * missing or blank — Docker Compose treats `KEYCLOAK_CLIENT_SECRET=` in `.env` as set-but-empty,
 * which overrides `compose.yml` defaults and would otherwise send an empty secret.
 */
export async function keycloakPasswordGrant(
  username: string,
  password: string,
): Promise<KeycloakPasswordGrantResult> {
  const base = keycloakBaseUrl();
  const realm = keycloakRealm();
  const clientId = (process.env.KEYCLOAK_CLIENT_ID || 'web-dashboard').trim();
  const clientSecret =
    (process.env.KEYCLOAK_CLIENT_SECRET || '').trim() || 'web-dashboard-dev-secret';

  if (!base) {
    return { ok: false, status: 503, bodyText: '{"error":"configuration","error_description":"KEYCLOAK_BASE_URL is not set"}' };
  }

  const tokenUrl = `${base}/realms/${encodeURIComponent(realm)}/protocol/openid-connect/token`;
  const body = new URLSearchParams({
    grant_type: 'password',
    client_id: clientId,
    client_secret: clientSecret,
    username,
    password,
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
    return { ok: false, status: 502, bodyText: '{"error":"parse","error_description":"Invalid JSON from token endpoint"}' };
  }
  if (typeof json.access_token !== 'string') {
    return { ok: false, status: 502, bodyText: bodyText.slice(0, 2000) };
  }
  return {
    ok: true,
    data: {
      access_token: json.access_token,
      expires_in: typeof json.expires_in === 'number' ? json.expires_in : undefined,
      refresh_token: typeof json.refresh_token === 'string' ? json.refresh_token : undefined,
    },
  };
}

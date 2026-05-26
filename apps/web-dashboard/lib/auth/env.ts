/**
 * When `AUTH_DISABLED=1`, middleware and the API proxy do not enforce Keycloak session.
 * Use only on trusted local/dev networks (see docs/auth-keycloak.md).
 */
export function isAuthDisabled(): boolean {
  return process.env.AUTH_DISABLED === '1' || process.env.AUTH_DISABLED === 'true';
}

export function keycloakBaseUrl(): string {
  return (process.env.KEYCLOAK_BASE_URL || '').trim().replace(/\/$/, '');
}

export function keycloakRealm(): string {
  return (process.env.KEYCLOAK_REALM || 'platform').trim();
}

export function keycloakIssuer(): string {
  const explicit = (process.env.KEYCLOAK_ISSUER || '').trim().replace(/\/$/, '');
  if (explicit) return explicit;
  const base = keycloakBaseUrl();
  const realm = keycloakRealm();
  if (!base) return '';
  return `${base}/realms/${realm}`;
}

export function jwksUri(): string {
  const iss = keycloakIssuer();
  if (!iss) return '';
  return `${iss}/protocol/openid-connect/certs`;
}

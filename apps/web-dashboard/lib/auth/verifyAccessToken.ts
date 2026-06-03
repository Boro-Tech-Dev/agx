import { createRemoteJWKSet, decodeJwt, jwtVerify } from 'jose';

import { keycloakBaseUrl, keycloakRealm } from './env';

/** JWKS per token issuer (iss can differ from KEYCLOAK_BASE_URL hostname, e.g. host vs Docker DNS). */
const jwksByIssuer = new Map<string, ReturnType<typeof createRemoteJWKSet>>();

function normalizeIssuer(iss: string): string {
  return iss.trim().replace(/\/+$/, '');
}

/**
 * Accept JWT iss if it targets our realm and the host is trusted (prevents open JWKS fetch).
 */
export function isIssuerTrusted(issRaw: string): boolean {
  const iss = normalizeIssuer(issRaw);
  const realm = keycloakRealm();
  const realmPath = `/realms/${realm}`;
  if (!iss.endsWith(realmPath)) return false;

  const explicit = normalizeIssuer(process.env.KEYCLOAK_ISSUER || '');
  if (explicit && iss === explicit) return true;

  let host: string;
  try {
    host = new URL(iss).hostname.toLowerCase();
  } catch {
    return false;
  }

  const base = keycloakBaseUrl();
  if (base) {
    try {
      const expectedHost = new URL(base).hostname.toLowerCase();
      if (host === expectedHost) return true;
    } catch {
      /* ignore */
    }
  }

  // Docker Compose service name, local dev, loopbacks
  if (host === 'keycloak') return true;
  if (host === 'auth.idea-impact.com') return true;
  if (host === 'localhost' || host === '127.0.0.1' || host === '::1') return true;

  return false;
}

function jwksForIssuer(iss: string): ReturnType<typeof createRemoteJWKSet> {
  const key = normalizeIssuer(iss);
  let set = jwksByIssuer.get(key);
  if (!set) {
    set = createRemoteJWKSet(new URL(`${key}/protocol/openid-connect/certs`));
    jwksByIssuer.set(key, set);
  }
  return set;
}

/**
 * Verifies RS256 JWT: signature + exp + issuer allowlist.
 * Uses `iss` from the token (not only KEYCLOAK_BASE_URL) so Keycloak-issued iss matches JWKS URL
 * after redeploys or mixed host/internal URLs.
 */
export async function verifyAccessToken(token: string): Promise<boolean> {
  if (!token.trim()) return false;
  let iss: string;
  try {
    const payload = decodeJwt(token);
    if (typeof payload.iss !== 'string') return false;
    iss = normalizeIssuer(payload.iss);
  } catch {
    return false;
  }

  if (!isIssuerTrusted(iss)) return false;

  try {
    await jwtVerify(token, jwksForIssuer(iss), {
      issuer: iss,
      algorithms: ['RS256'],
      clockTolerance: 30,
    });
    return true;
  } catch {
    // Keycloak key rotation / redeploy: drop cached JWKS for this issuer once and retry
    jwksByIssuer.delete(iss);
    try {
      await jwtVerify(token, jwksForIssuer(iss), {
        issuer: iss,
        algorithms: ['RS256'],
        clockTolerance: 30,
      });
      return true;
    } catch {
      return false;
    }
  }
}

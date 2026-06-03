#!/usr/bin/env bash
# Set web-dashboard OIDC client fields in Keycloak (redirectUris, standardFlow, PKCE).
# Realm JSON import runs once; this updates the live DB. Called from vps-deploy*.sh.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.vps.yml:docker-compose.traefik.yml}"
export COMPOSE_FILE

if [[ -f .env ]]; then
  set -a
  # shellcheck disable=SC1091
  source .env
  set +a
fi

KC="${KEYCLOAK_ADMIN:-admin}"
KCP="${KEYCLOAK_ADMIN_PASSWORD:-admin}"
REALM="${KEYCLOAK_REALM:-platform}"
CLIENT_ID="${KEYCLOAK_CLIENT_ID:-web-dashboard}"
PUBLIC_ORIGIN="${APP_PUBLIC_ORIGIN:-${VPS_PUBLIC_URL:-https://idea-impact.com}}"
PUBLIC_ORIGIN="${PUBLIC_ORIGIN%/}"
REDIRECT_URI="${OIDC_REDIRECT_URI:-${PUBLIC_ORIGIN}/api/auth/callback}"
WEB_ORIGIN="${OIDC_WEB_ORIGIN:-${PUBLIC_ORIGIN}}"

echo "Configuring Keycloak client ${CLIENT_ID} in realm ${REALM} for OIDC authorization code + PKCE..."

docker compose exec -T keycloak /opt/keycloak/bin/kcadm.sh config credentials \
  --server http://127.0.0.1:8080 \
  --realm master \
  --user "$KC" \
  --password "$KCP"

CID="$(docker compose exec -T keycloak /opt/keycloak/bin/kcadm.sh get clients -r "$REALM" -q "clientId=$CLIENT_ID" --fields id --format csv --noquotes | tail -1 | tr -d '\r')"

if [[ -z "$CID" || "$CID" == "id" ]]; then
  echo "Client ${CLIENT_ID} not found in realm ${REALM}" >&2
  exit 1
fi

docker compose exec -T keycloak /opt/keycloak/bin/kcadm.sh update "clients/${CID}" -r "$REALM" -f - <<EOF
{
  "standardFlowEnabled": true,
  "directAccessGrantsEnabled": false,
  "implicitFlowEnabled": false,
  "redirectUris": ["${REDIRECT_URI}"],
  "webOrigins": ["${WEB_ORIGIN}"],
  "attributes": {
    "pkce.code.challenge.method": "S256"
  }
}
EOF

echo "Done. Verify: curl -fsS https://auth.idea-impact.com/realms/${REALM}/.well-known/openid-configuration | grep issuer"

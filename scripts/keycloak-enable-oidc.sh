#!/usr/bin/env bash
# Apply OIDC client settings on an existing Keycloak volume (realm import runs once).
# Run on VPS via SSH after web-dashboard OIDC deploy:
#   COMPOSE_FILE=docker-compose.vps.yml:docker-compose.traefik.yml ./scripts/keycloak-enable-oidc.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.vps.yml:docker-compose.traefik.yml}"
export COMPOSE_FILE

KC="${KEYCLOAK_ADMIN:-admin}"
KCP="${KEYCLOAK_ADMIN_PASSWORD:-admin}"
REALM="${KEYCLOAK_REALM:-platform}"
CLIENT_ID="${KEYCLOAK_CLIENT_ID:-web-dashboard}"
REDIRECT_URI="${OIDC_REDIRECT_URI:-https://idea-impact.com/api/auth/callback}"
WEB_ORIGIN="${OIDC_WEB_ORIGIN:-https://idea-impact.com}"

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

docker compose exec -T keycloak /opt/keycloak/bin/kcadm.sh update "clients/${CID}" -r "$REALM" \
  -s standardFlowEnabled=true \
  -s directAccessGrantsEnabled=false \
  -s implicitFlowEnabled=false \
  -s "redirectUris=[\"${REDIRECT_URI}\"]" \
  -s "webOrigins=[\"${WEB_ORIGIN}\"]" \
  -s 'attributes.pkce.code.challenge.method=S256'

echo "Done. Verify: curl -fsS https://idea-impact.com/realms/${REALM}/.well-known/openid-configuration"

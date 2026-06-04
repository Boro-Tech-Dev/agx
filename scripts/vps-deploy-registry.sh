#!/usr/bin/env bash
# VPS deploy from prebuilt GHCR images (no on-host docker build).
# Requires IMAGE_TAG (e.g. sha-abc1234 from CI). Production .env must exist on the host.
#
# Usage:
#   export IMAGE_TAG=sha-$(git rev-parse HEAD)
#   ./scripts/vps-deploy-registry.sh
#   ./scripts/vps-deploy-registry.sh -d agent-api web-dashboard
set -euo pipefail
cd "$(dirname "$0")/.."

if [[ -z "${IMAGE_TAG:-}" ]]; then
  echo "ERROR: IMAGE_TAG is required (e.g. sha-\$(git rev-parse HEAD))" >&2
  exit 1
fi

export COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.vps.yml:docker-compose.traefik.yml:docker-compose.registry.yml}"

if [[ -f .env ]] && grep -q '^KEYCLOAK_ISSUER=https://idea-impact.com/realms/platform' .env; then
  sed -i.bak 's|^KEYCLOAK_ISSUER=https://idea-impact.com/realms/platform|KEYCLOAK_ISSUER=https://auth.idea-impact.com/realms/platform|' .env
  echo "Migrated KEYCLOAK_ISSUER to auth.idea-impact.com in .env"
fi

"$(dirname "$0")/generate-vps-compose.sh"

echo "Pulling images (IMAGE_TAG=${IMAGE_TAG})..."
docker compose pull

if [[ "$#" -eq 0 ]]; then
  set -- -d
fi
"$(dirname "$0")/compose-up.sh" "$@"
echo "Recreating keycloak + web-dashboard to apply hostname/issuer env..."
docker compose up -d --force-recreate keycloak web-dashboard
if docker compose ps keycloak --status running --quiet 2>/dev/null | grep -q .; then
  "$(dirname "$0")/keycloak-enable-oidc.sh" || {
    echo "WARN: keycloak-enable-oidc.sh failed; web-dashboard redirectUris may still be wrong in Keycloak" >&2
  }
fi
"$(dirname "$0")/apply-retrieval-seeds.sh"

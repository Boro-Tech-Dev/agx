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

"$(dirname "$0")/generate-vps-compose.sh"

echo "Pulling images (IMAGE_TAG=${IMAGE_TAG})..."
docker compose pull

if [[ "$#" -eq 0 ]]; then
  set -- -d
fi
"$(dirname "$0")/compose-up.sh" "$@"
"$(dirname "$0")/apply-retrieval-seeds.sh"

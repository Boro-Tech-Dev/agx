#!/usr/bin/env bash
# VPS bring-up: host swap, regenerate hardened compose, then docker compose up.
# Usage: ./scripts/vps-deploy.sh [args passed to compose-up.sh, default: -d --build]
set -euo pipefail
cd "$(dirname "$0")/.."

export COMPOSE_FILE=docker-compose.vps.yml:docker-compose.traefik.yml

sudo "$(dirname "$0")/setup-swap.sh"
"$(dirname "$0")/generate-vps-compose.sh"

if [[ "$#" -eq 0 ]]; then
  set -- -d --build
fi
"$(dirname "$0")/compose-up.sh" "$@"
"$(dirname "$0")/apply-retrieval-seeds.sh"

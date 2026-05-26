#!/usr/bin/env bash
# Example: run the stack with multiple queue consumers.
# Requires docker-compose.yml without fixed container_name on services you scale
# (this repo leaves names to Compose so replicas and `compose down` work predictably).
#
# Usage from repo root:
#   N_AGENT_WORKER=2 N_INGESTION_WORKER=2 ./scripts/compose-scale-example.sh
# Or pass extra compose args:
#   ./scripts/compose-scale-example.sh -d

set -euo pipefail
ROOT=$(cd "$(dirname "$0")/.." && pwd)
cd "$ROOT"
"$ROOT/scripts/compose-reclaim.sh" before-up

N_AGENT_WORKER="${N_AGENT_WORKER:-2}"
N_INGESTION_WORKER="${N_INGESTION_WORKER:-1}"

exec docker compose up --build \
  --scale "agent-worker=${N_AGENT_WORKER}" \
  --scale "ingestion-worker=${N_INGESTION_WORKER}" \
  "$@"

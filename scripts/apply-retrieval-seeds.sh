#!/usr/bin/env bash
# Apply ColBERT-only retrieval catalog migration to the running Postgres container.
set -euo pipefail
cd "$(dirname "$0")/.."

COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.yml}"
export COMPOSE_FILE

echo "Waiting for postgres to be healthy..."
docker compose ps postgres --format json 2>/dev/null | grep -q '"Health":"healthy"' \
  || docker compose up -d postgres

for _ in $(seq 1 60); do
  if docker compose exec -T postgres pg_isready -U dd_agent -d dd_agents >/dev/null 2>&1; then
    break
  fi
  sleep 2
done

echo "Applying infra/postgres/init/032_colbert_only.sql ..."
docker compose exec -T postgres psql -v ON_ERROR_STOP=1 -U dd_agent -d dd_agents \
  < infra/postgres/init/032_colbert_only.sql

echo "Retrieval seeds applied."

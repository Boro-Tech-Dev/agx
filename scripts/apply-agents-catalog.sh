#!/usr/bin/env sh
# Re-upsert agent catalog rows into a running Compose Postgres.
# Fresh DBs already get these rows from infra/postgres/schema.sql at first init;
# use this after changing agent SQL (e.g. default_model tier bump) or when an old volume
# was created before that bootstrap. Aligns DB defaults with config/agent_lanes.json for /model drift checks.
# For clinical document_kind values on existing DBs, also run: infra/postgres/init/008_document_kind_clinical.sql
set -eu
ROOT="$(CDPATH= cd -- "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
exec docker compose exec -T postgres \
  psql -v ON_ERROR_STOP=1 -U dd_agent -d dd_agents \
  < infra/postgres/seeds/agents_catalog.sql

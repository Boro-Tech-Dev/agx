#!/usr/bin/env sh
# Apply or refresh the full tactic library (idempotent; ON CONFLICT upserts).
# Init scripts in docker-entrypoint-initdb.d run only on first volume create — use this
# after pull or when /api/tactics returns no rows on an existing database.
#
# HappyGuy MAD rows only (smaller patch): see infra/postgres/seeds/005_happyguy_mad_tactics.sql
# HappyGuy AASLD rows only (smaller patch): see infra/postgres/seeds/006_happyguy_aasld_tactics.sql
# HappyGuy MPS website update rows only: see infra/postgres/seeds/007_happyguy_mps_website_tactics.sql
# HappyGuy branded CRM email rows only: see infra/postgres/seeds/008_happyguy_branded_crm_email_tactics.sql
#
# Example:
#   DATABASE_URL='postgresql://dd_agent:dd_agent_dev@localhost:5432/dd_agents' ./scripts/apply-tactic-library-seed.sh
set -e
cd "$(dirname "$0")/.."
if [ -z "${DATABASE_URL-}" ]; then
  echo "DATABASE_URL is required (postgres connection string)." >&2
  exit 1
fi
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f "infra/postgres/init/018_tactic_library_seed.sql"
echo "Tactic library seed applied (018)."

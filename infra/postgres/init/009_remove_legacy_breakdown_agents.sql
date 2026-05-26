-- Remove legacy Ollama-only breakdown agents (no longer registered in worker or API).
-- Safe on empty DBs. Apply manually on existing volumes:
--   psql "$DATABASE_URL" -f infra/postgres/init/009_remove_legacy_breakdown_agents.sql

DELETE FROM agents WHERE key IN ('ricky', 'julian', 'bubs');

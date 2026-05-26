-- Per-brand and per-project MLR cadence (timing profile id from config/scenario_planner/timing_profiles.json).
-- Apply on existing DBs: psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f infra/postgres/init/023_timing_profile_columns.sql

ALTER TABLE brands ADD COLUMN IF NOT EXISTS timing_profile_id TEXT;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS timing_profile_id TEXT;

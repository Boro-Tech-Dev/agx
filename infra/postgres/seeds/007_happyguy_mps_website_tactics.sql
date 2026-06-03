-- Idempotent HappyGuy MPS website update tactic rows (tactic library / attach flows).
-- Duplicates the MPS insert at the end of infra/postgres/init/018_tactic_library_seed.sql
-- so operators can patch existing Postgres volumes without re-applying the full seed file.
BEGIN;
INSERT INTO tactics (key, name, description, tactic_kind, channel, medium, format, tags, status, metadata)
VALUES (
  'happyguy_mps_website_updates',
  'HappyGuy — MPS Website Updates',
  'Figma/PRC website update; extended OPDP, FDA, production deploy, post-launch QA',
  'owned',
  'digital',
  'website',
  'web',
  '["happyguy","mps","website","prc","opdp"]'::jsonb,
  'active',
  '{"timing_profile":"happyguy_mps_website_update"}'::jsonb
)
ON CONFLICT (key) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  tactic_kind = EXCLUDED.tactic_kind,
  channel = EXCLUDED.channel,
  medium = EXCLUDED.medium,
  format = EXCLUDED.format,
  tags = EXCLUDED.tags,
  status = EXCLUDED.status,
  metadata = EXCLUDED.metadata,
  updated_at = now();
COMMIT;

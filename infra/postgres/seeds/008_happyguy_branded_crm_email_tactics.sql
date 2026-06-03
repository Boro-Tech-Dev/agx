-- Idempotent HappyGuy branded CRM email tactic rows (tactic library / attach flows).
-- Duplicates the branded CRM email insert at the end of infra/postgres/init/018_tactic_library_seed.sql
-- so operators can patch existing Postgres volumes without re-applying the full seed file.
BEGIN;
INSERT INTO tactics (key, name, description, tactic_kind, channel, medium, format, tags, status, metadata)
VALUES (
  'happyguy_branded_crm_emails',
  'HappyGuy — Branded CRM Email Updates',
  'Branded CRM email update; 3 PRC rounds, OPDP binder, Martech test blasts, FDA 2253',
  'owned',
  'digital',
  'email',
  'html',
  '["happyguy","crm","email","prc","opdp","martech"]'::jsonb,
  'active',
  '{"timing_profile":"happyguy_branded_crm_email"}'::jsonb
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

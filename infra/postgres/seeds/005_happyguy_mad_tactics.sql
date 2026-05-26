-- Idempotent HappyGuy MAD tactic rows (tactic library / attach flows).
-- Duplicates the three MAD inserts at the end of infra/postgres/init/018_tactic_library_seed.sql
-- so operators can patch existing Postgres volumes without re-applying the full seed file.
BEGIN;
INSERT INTO tactics (key, name, description, tactic_kind, channel, medium, format, tags, status, metadata)
VALUES ('happyguy_mad_healthgrades_360_email', 'HappyGuy MAD — Healthgrades 360 email', 'Vendor screenshot cycles, resubmit path, OPDP; HappyGuy week-aligned PRB', 'owned', 'digital', 'email', 'html', '["happyguy","mad","healthgrades","email"]'::jsonb, 'active', '{"timing_profile":"happyguy_mad_healthgrades_360_email"}'::jsonb)
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
INSERT INTO tactics (key, name, description, tactic_kind, channel, medium, format, tags, status, metadata)
VALUES ('happyguy_mad_patient_profiles_tll', 'HappyGuy MAD — Patient profiles (TLL)', 'TLL alignment, profile creative, extended post-PRB1 revision track; HappyGuy week-aligned PRB', 'owned', 'other', 'mixed', 'mixed', '["happyguy","mad","patient_profiles","tll"]'::jsonb, 'active', '{"timing_profile":"happyguy_mad_patient_profiles_tll"}'::jsonb)
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
INSERT INTO tactics (key, name, description, tactic_kind, channel, medium, format, tags, status, metadata)
VALUES ('happyguy_mad_liver_brochure_training_blueprint', 'HappyGuy MAD — Liver brochure / training blueprint', 'Tighter discovery, layout + accessibility/fact-check overlap; HappyGuy week-aligned PRB', 'owned', 'print', 'brochure', 'pdf', '["happyguy","mad","brochure","training"]'::jsonb, 'active', '{"timing_profile":"happyguy_mad_liver_brochure_training_blueprint"}'::jsonb)
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

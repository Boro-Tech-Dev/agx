-- Idempotent HappyGuy AASLD tactic rows (tactic library / attach flows).
-- Duplicates the AASLD insert at the end of infra/postgres/init/018_tactic_library_seed.sql
-- so operators can patch existing Postgres volumes without re-applying the full seed file.
BEGIN;
INSERT INTO tactics (key, name, description, tactic_kind, channel, medium, format, tags, status, metadata)
VALUES ('happyguy_aasld_hotel_key_cards', 'HappyGuy — AASLD Hotel Key Cards', 'Congress hotel key card pick-up/revise; AASLD review, FDA 2253, print release', 'owned', 'print', 'congress', 'hotel_key_card', '["happyguy","aasld","congress","print","hotel_key_cards"]'::jsonb, 'active', '{"timing_profile":"happyguy_aasld_congress_print_pickup"}'::jsonb)
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
VALUES ('happyguy_aasld_wifi_splash_page', 'HappyGuy — AASLD Wifi Splash Page', 'Congress wifi splash page pick-up/revise; AASLD TENT review, file release, congress handoff', 'owned', 'digital', 'congress', 'wifi_splash', '["happyguy","aasld","congress","digital","wifi_splash"]'::jsonb, 'active', '{"timing_profile":"happyguy_aasld_congress_print_pickup"}'::jsonb)
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

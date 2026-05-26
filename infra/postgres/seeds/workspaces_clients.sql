-- Workspace + client + brand hierarchy for local / demo use.
-- Fresh Compose DBs: mounted as docker-entrypoint-initdb.d after schema.sql.
-- Apply manually on an existing database:
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f infra/postgres/seeds/workspaces_clients.sql
--
-- Workspaces / clients (workspace key / name | client key / name):
--   dood-1 / Dood Files     | data / Data
--   argon-1 / Argon         | schematic-1 / Schematic
--   cookie-1 / Cookie Files | data / Data
--   twins-1 / The Twins     | data / Data
--   skillarts-1 / SkillArts | skillarts / SkillArts
--   happyguy-1 / HappyGuy    | happyguy / HappyGuy
--
-- Brands (workspace / client / brand key / name):
--   argon-1 / schematic-1 / advsm-hcp / AdvSm HCP
--   argon-1 / schematic-1 / ism-hcp   / ISM HCP
--   argon-1 / schematic-1 / gist-hcp  / GIST HCP
--   dood-1  / data        / logs    / Logs
--   skillarts-1 / skillarts / default / Default
--   happyguy-1 / happyguy / default / Default

BEGIN;

INSERT INTO workspaces (key, name)
VALUES
  ('dood-1', 'Dood Files'),
  ('argon-1', 'Argon'),
  ('cookie-1', 'Cookie Files'),
  ('twins-1', 'The Twins'),
  ('skillarts-1', 'SkillArts'),
  ('happyguy-1', 'HappyGuy')
ON CONFLICT (key) DO UPDATE SET
  name = EXCLUDED.name;

INSERT INTO clients (workspace_id, key, name)
SELECT w.id, v.client_key, v.client_name
FROM workspaces w
JOIN (
  VALUES
    ('dood-1', 'data', 'Data'),
    ('argon-1', 'schematic-1', 'Schematic'),
    ('cookie-1', 'data', 'Data'),
    ('twins-1', 'data', 'Data'),
    ('skillarts-1', 'skillarts', 'SkillArts'),
    ('happyguy-1', 'happyguy', 'HappyGuy')
) AS v(workspace_key, client_key, client_name) ON w.key = v.workspace_key
ON CONFLICT (workspace_id, key) DO UPDATE SET
  name = EXCLUDED.name;

INSERT INTO brands (client_id, key, name)
SELECT c.id, v.brand_key, v.brand_name
FROM clients c
JOIN workspaces w ON w.id = c.workspace_id
JOIN (
  VALUES
    ('argon-1', 'schematic-1', 'advsm-hcp', 'AdvSm HCP'),
    ('argon-1', 'schematic-1', 'ism-hcp', 'ISM HCP'),
    ('argon-1', 'schematic-1', 'gist-hcp', 'GIST HCP'),
    ('dood-1', 'data', 'logs', 'Logs'),
    ('skillarts-1', 'skillarts', 'default', 'Default'),
    ('happyguy-1', 'happyguy', 'default', 'Default')
) AS v(ws_key, client_key, brand_key, brand_name) ON w.key = v.ws_key AND c.key = v.client_key
ON CONFLICT (client_id, key) DO UPDATE SET
  name = EXCLUDED.name;

-- Default MLR cadence per brand (timing profile ids from config/scenario_planner/timing_profiles.json)
UPDATE brands b
SET timing_profile_id = v.profile_id
FROM clients c
JOIN workspaces w ON w.id = c.workspace_id
JOIN (
  VALUES
    ('argon-1', 'schematic-1', 'advsm-hcp', 'generic_tactic'),
    ('argon-1', 'schematic-1', 'ism-hcp', 'generic_tactic'),
    ('argon-1', 'schematic-1', 'gist-hcp', 'generic_tactic'),
    ('skillarts-1', 'skillarts', 'default', 'skillarts_generic'),
    ('happyguy-1', 'happyguy', 'default', 'happyguy_submit_thursday')
) AS v(ws_key, client_key, brand_key, profile_id)
  ON w.key = v.ws_key AND c.key = v.client_key
WHERE b.client_id = c.id AND b.key = v.brand_key;

COMMIT;

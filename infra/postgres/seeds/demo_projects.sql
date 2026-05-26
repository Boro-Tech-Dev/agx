-- Demo / seed projects (optional hierarchy must exist — run after workspaces_clients seed).
-- Matches Workspaces "New project" examples.
-- Apply on existing DB: psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f infra/postgres/seeds/demo_projects.sql
--
-- Reprint Carrier (Argon → Schematic → AdvSm HCP):
--   key: rep-car | project_type: product_discovery | pm_kind: business | metadata.allow_structured_breakdown: true
--
-- Generic RTE (SkillArts → default brand):
--   key: email-1 | name: Generic RTE | project_type: other | pm_kind: business | metadata.allow_structured_breakdown: true
--
-- Tactic 1 (HappyGuy → default brand):
--   key: tactic-1 | name: Tactic 1 | project_type: other | pm_kind: business | metadata.allow_structured_breakdown: true

BEGIN;

INSERT INTO projects (key, name, description, brand_id, project_type, pm_kind, metadata)
SELECT
  'rep-car',
  'Reprint Carrier',
  'Reprint carrier',
  b.id,
  'product_discovery',
  'business',
  '{"allow_structured_breakdown": true}'::jsonb
FROM brands b
JOIN clients c ON b.client_id = c.id
JOIN workspaces w ON c.workspace_id = w.id
WHERE w.key = 'argon-1' AND c.key = 'schematic-1' AND b.key = 'advsm-hcp'
ON CONFLICT (key) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  brand_id = EXCLUDED.brand_id,
  project_type = EXCLUDED.project_type,
  pm_kind = EXCLUDED.pm_kind,
  metadata = EXCLUDED.metadata;

INSERT INTO projects (key, name, description, brand_id, project_type, pm_kind, metadata)
SELECT
  'email-1',
  'Generic RTE',
  NULL,
  b.id,
  'other',
  'business',
  '{"allow_structured_breakdown": true}'::jsonb
FROM brands b
JOIN clients c ON b.client_id = c.id
JOIN workspaces w ON c.workspace_id = w.id
WHERE w.key = 'skillarts-1' AND c.key = 'skillarts' AND b.key = 'default'
ON CONFLICT (key) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  brand_id = EXCLUDED.brand_id,
  project_type = EXCLUDED.project_type,
  pm_kind = EXCLUDED.pm_kind,
  metadata = EXCLUDED.metadata;

INSERT INTO projects (key, name, description, brand_id, project_type, pm_kind, metadata)
SELECT
  'tactic-1',
  'Tactic 1',
  NULL,
  b.id,
  'other',
  'business',
  '{"allow_structured_breakdown": true}'::jsonb
FROM brands b
JOIN clients c ON b.client_id = c.id
JOIN workspaces w ON c.workspace_id = w.id
WHERE w.key = 'happyguy-1' AND c.key = 'happyguy' AND b.key = 'default'
ON CONFLICT (key) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  brand_id = EXCLUDED.brand_id,
  project_type = EXCLUDED.project_type,
  pm_kind = EXCLUDED.pm_kind,
  metadata = EXCLUDED.metadata;

COMMIT;

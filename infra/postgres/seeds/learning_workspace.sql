-- Training hierarchy for Learning sandbox projects (no brand selected).
-- Apply: psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f infra/postgres/seeds/learning_workspace.sql

BEGIN;

INSERT INTO workspaces (key, name)
VALUES ('ragtag-learn', 'RagTag Learning')
ON CONFLICT (key) DO UPDATE SET name = EXCLUDED.name;

INSERT INTO clients (workspace_id, key, name)
SELECT w.id, 'training', 'Training'
FROM workspaces w
WHERE w.key = 'ragtag-learn'
ON CONFLICT (workspace_id, key) DO UPDATE SET name = EXCLUDED.name;

INSERT INTO brands (client_id, key, name)
SELECT c.id, 'sandbox', 'Sandbox'
FROM clients c
JOIN workspaces w ON c.workspace_id = w.id
WHERE w.key = 'ragtag-learn' AND c.key = 'training'
ON CONFLICT (client_id, key) DO UPDATE SET name = EXCLUDED.name;

COMMIT;

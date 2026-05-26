-- Agent catalog: default_workflow + ui metadata for dashboard/API.
--
-- Compose uses infra/postgres/schema.sql (not this folder) for first-time init; that file includes
-- the same INSERT as below. This file remains for incremental / non-Compose installs.
-- Changing agent rows here does not update an existing volume; re-apply with:
--   ./scripts/apply-agents-catalog.sh
-- Or: psql "$DATABASE_URL" -f infra/postgres/init/007_agents_catalog.sql

ALTER TABLE agents ADD COLUMN IF NOT EXISTS default_workflow TEXT NOT NULL DEFAULT 'breakdown';
ALTER TABLE agents ADD COLUMN IF NOT EXISTS ui JSONB NOT NULL DEFAULT '{}'::jsonb;

INSERT INTO agents (key, name, description, default_model, system_prompt, default_workflow, ui)
VALUES
(
  'pm',
  'HAL9000',
  'Tasks, risks, decisions, timelines, status for product and delivery work.',
  'llama3.1:8b',
  'You are PM Copilot (business). Return only JSON matching the requested schema.',
  'breakdown',
  '{"accent":"fuchsia","order":1}'::jsonb
),
(
  'synergy',
  'Synergy - I am no more or no less.',
  'Personal and creative organizing: lyrics, collections, life projects—structured, not clinical.',
  'llama3.2:3b',
  'You are Synergy, the personal-mode copilot. Return only JSON matching the requested schema.',
  'breakdown',
  '{"accent":"rose","order":2}'::jsonb
),
(
  'clinic',
  'H.E.L.P.eR',
  'Organize health records, visit summaries, lab and imaging reports (text), and care-navigation notes—informational only, not a substitute for licensed care.',
  'llama3.2:3b',
  'You are H.E.L.P.eR health-record organizer. Return only JSON matching the requested schema.',
  'breakdown',
  '{"accent":"teal","order":3}'::jsonb
),
(
  'builder',
  'Bot the Builder',
  'Repo plans, file maps, service scaffolds, patches.',
  'qwen2.5:7b',
  'You are Builder Agent. Return only JSON matching the requested schema.',
  'implementation_plan',
  '{"accent":"indigo","order":4}'::jsonb
),
(
  'canon',
  'Twiki',
  'Memory, decisions, recall, synthesis.',
  'llama3.2:3b',
  'You are Twiki. Return only JSON matching the requested schema.',
  'recall',
  '{"accent":"emerald","order":5}'::jsonb
),
(
  'forge',
  'The Nerdery',
  'Scored ideas, product concepts, opportunity scans.',
  'llama3.2:3b',
  'You are Forge Agent. Return only JSON matching the requested schema.',
  'opportunity_scan',
  '{"accent":"amber","order":6}'::jsonb
),
(
  'kitt',
  'KITT',
  'Fast tactical project breakdowns and status—business delivery focus.',
  'gemma3:270m',
  'You are KITT, a concise project copilot. Return only JSON matching the requested schema.',
  'breakdown',
  '{"accent":"cyan","order":7}'::jsonb
),
(
  'eddie',
  'Eddie',
  'Scored ideas and opportunity scans with reasoning-friendly output.',
  'deepseek-r1:1.5b',
  'You are Eddie. Return only JSON matching the requested schema.',
  'opportunity_scan',
  '{"accent":"violet","order":8}'::jsonb
),
(
  'bubs',
  'Bubs',
  'Lightweight personal and creative organizing with a small local model.',
  'tinyllama:1.1b',
  'You are Bubs, a personal-mode copilot. Return only JSON matching the requested schema.',
  'breakdown',
  '{"accent":"lime","order":9}'::jsonb
)
ON CONFLICT (key) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  default_model = EXCLUDED.default_model,
  system_prompt = EXCLUDED.system_prompt,
  default_workflow = EXCLUDED.default_workflow,
  ui = EXCLUDED.ui;

-- Canonical fresh schema bootstrap.
-- Inserts the built-in agents (catalog). Workspace / client / brand seeds run in a follow-up init script
-- (see docker-compose postgres volumes: seeds/workspaces_clients.sql).
-- This file is intended to be executed once on a brand-new database.

BEGIN;

-- Extensions
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Core tables
CREATE TABLE IF NOT EXISTS agents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  default_model TEXT NOT NULL,
  system_prompt TEXT NOT NULL,
  default_workflow TEXT NOT NULL DEFAULT 'breakdown',
  ui JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Built-in agent catalog (required for dashboard /api/agents).
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

CREATE TABLE IF NOT EXISTS workspaces (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  key TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(workspace_id, key)
);

CREATE TABLE IF NOT EXISTS brands (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  key TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  timing_profile_id TEXT,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(client_id, key)
);

CREATE TABLE IF NOT EXISTS projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id UUID NOT NULL REFERENCES brands(id) ON DELETE RESTRICT,
  key TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  project_type TEXT NOT NULL DEFAULT 'other' CHECK (
    project_type IN (
      'software_delivery',
      'product_discovery',
      'marketing_campaign',
      'operations_runbook',
      'research_synthesis',
      'personal_journal',
      'health_activity_log',
      'media_log',
      'quotes_snippets',
      'metrics_checkins',
      'general_inbox',
      'other'
    )
  ),
  pm_kind TEXT NOT NULL DEFAULT 'business' CHECK (pm_kind IN ('business', 'personal')),
  status TEXT NOT NULL DEFAULT 'active',
  timing_profile_id TEXT,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS tactics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  tactic_kind TEXT,
  channel TEXT,
  medium TEXT,
  format TEXT,
  tags JSONB NOT NULL DEFAULT '[]',
  default_success_metrics JSONB NOT NULL DEFAULT '{}',
  default_dependencies JSONB NOT NULL DEFAULT '{}',
  default_start_offset_days INT,
  default_duration_days INT,
  cadence TEXT,
  estimated_cost_cents BIGINT,
  currency TEXT,
  owner TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','active','archived')),
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS project_tactics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_key TEXT NOT NULL REFERENCES projects(key) ON DELETE CASCADE,
  tactic_id UUID NOT NULL REFERENCES tactics(id) ON DELETE CASCADE,
  lifecycle_status TEXT NOT NULL DEFAULT 'draft' CHECK (lifecycle_status IN ('draft','active','paused','completed','archived')),
  priority TEXT DEFAULT 'medium',
  start_at TIMESTAMPTZ,
  end_at TIMESTAMPTZ,
  objective_override TEXT,
  success_metrics_override JSONB NOT NULL DEFAULT '{}',
  dependencies_override JSONB NOT NULL DEFAULT '{}',
  notes TEXT,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(project_key, tactic_id)
);

CREATE TABLE IF NOT EXISTS brief_template_bundle (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  version INT NOT NULL,
  skeleton JSONB NOT NULL,
  tactic_overrides JSONB NOT NULL,
  presets JSONB NOT NULL,
  label TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS brief_template_bundle_version_uq ON brief_template_bundle (version);

CREATE TABLE IF NOT EXISTS brief_template_active (
  id INT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  published_bundle_id UUID REFERENCES brief_template_bundle (id) ON DELETE RESTRICT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS brief_template_draft (
  id INT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  skeleton JSONB NOT NULL DEFAULT '{"version":1,"sections":[]}'::jsonb,
  tactic_overrides JSONB NOT NULL DEFAULT '{"version":1,"overrides":{}}'::jsonb,
  presets JSONB NOT NULL DEFAULT '{"version":1,"presets":[]}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS agent_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_key TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('queued','running','needs_approval','completed','degraded','failed','cancelled')),
  title TEXT,
  input JSONB NOT NULL,
  output JSONB,
  model_used TEXT,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  error_message TEXT,
  parent_run_id UUID REFERENCES agent_runs(id) ON DELETE SET NULL,
  conversation_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS source_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  source_type TEXT NOT NULL,
  source_uri TEXT,
  storage_bucket TEXT,
  storage_key TEXT,
  mime_type TEXT,
  checksum TEXT,
  workspace_key TEXT REFERENCES workspaces(key) ON DELETE SET NULL,
  project_key TEXT REFERENCES projects(key) ON DELETE SET NULL,
  original_filename TEXT,
  processing_status TEXT NOT NULL DEFAULT 'ready',
  error_message TEXT,
  archived_at TIMESTAMPTZ,
  document_kind TEXT NOT NULL DEFAULT 'general',
  metadata JSONB NOT NULL DEFAULT '{}',
  ingested_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT source_documents_processing_status_check
    CHECK (processing_status IN ('queued', 'processing', 'ready', 'failed')),
  CONSTRAINT source_documents_document_kind_check
    CHECK (document_kind IN (
      'timeline', 'brief', 'estimate', 'concept', 'changeorder', 'contract', 'spec', 'general',
      'clinical_note', 'lab_report', 'imaging_report', 'scenario', 'omnichannel_plan', 'veeva_suite'
    ))
);

CREATE TABLE IF NOT EXISTS document_chunks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES source_documents(id) ON DELETE CASCADE,
  chunk_index INT NOT NULL,
  content TEXT NOT NULL,
  token_estimate INT,
  metadata JSONB NOT NULL DEFAULT '{}',
  embedding vector(768),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS memories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  memory_type TEXT NOT NULL CHECK (memory_type IN ('note','decision','artifact','project_context','pattern','opportunity')),
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','superseded','archived','uncertain')),
  confidence TEXT NOT NULL DEFAULT 'medium' CHECK (confidence IN ('low','medium','high')),
  workspace_key TEXT NOT NULL REFERENCES workspaces(key) ON DELETE CASCADE,
  project_key TEXT REFERENCES projects(key) ON DELETE SET NULL,
  source_document_id UUID REFERENCES source_documents(id) ON DELETE CASCADE,
  source_run_id UUID REFERENCES agent_runs(id),
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS memory_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  from_memory_id UUID NOT NULL REFERENCES memories(id) ON DELETE CASCADE,
  to_memory_id UUID NOT NULL REFERENCES memories(id) ON DELETE CASCADE,
  relation_type TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS artifacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id UUID REFERENCES agent_runs(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  artifact_type TEXT NOT NULL,
  storage_bucket TEXT NOT NULL,
  storage_key TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS approvals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id UUID NOT NULL REFERENCES agent_runs(id) ON DELETE CASCADE,
  approval_type TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending','approved','rejected','expired')),
  requested_action JSONB NOT NULL,
  response_note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS run_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id UUID NOT NULL REFERENCES agent_runs(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  message TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS project_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_key TEXT NOT NULL REFERENCES projects(key),
  item_type TEXT NOT NULL CHECK (item_type IN ('task','risk','decision','dependency','milestone','idea','open_question','anomaly','timeline_event','cost')),
  title TEXT NOT NULL,
  body TEXT,
  status TEXT NOT NULL DEFAULT 'open',
  priority TEXT DEFAULT 'medium',
  due_date DATE,
  owner TEXT,
  source_run_id UUID REFERENCES agent_runs(id),
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS holidays (
  date DATE NOT NULL,
  country_code TEXT NOT NULL DEFAULT 'US',
  name TEXT NOT NULL,
  observed BOOLEAN NOT NULL DEFAULT TRUE,
  PRIMARY KEY (date, country_code)
);

INSERT INTO holidays (date, country_code, name, observed) VALUES
('2024-01-01', 'US', 'New Year''s Day', TRUE),
('2024-01-15', 'US', 'Martin Luther King Jr. Day', TRUE),
('2024-02-19', 'US', 'Washington''s Birthday', TRUE),
('2024-05-27', 'US', 'Memorial Day', TRUE),
('2024-06-19', 'US', 'Juneteenth', TRUE),
('2024-07-04', 'US', 'Independence Day', TRUE),
('2024-09-02', 'US', 'Labor Day', TRUE),
('2024-10-14', 'US', 'Columbus Day', TRUE),
('2024-11-11', 'US', 'Veterans Day', TRUE),
('2024-11-28', 'US', 'Thanksgiving Day', TRUE),
('2024-12-25', 'US', 'Christmas Day', TRUE),
('2025-01-01', 'US', 'New Year''s Day', TRUE),
('2025-01-20', 'US', 'Martin Luther King Jr. Day', TRUE),
('2025-02-17', 'US', 'Washington''s Birthday', TRUE),
('2025-05-26', 'US', 'Memorial Day', TRUE),
('2025-06-19', 'US', 'Juneteenth', TRUE),
('2025-07-04', 'US', 'Independence Day', TRUE),
('2025-09-01', 'US', 'Labor Day', TRUE),
('2025-10-13', 'US', 'Columbus Day', TRUE),
('2025-11-11', 'US', 'Veterans Day', TRUE),
('2025-11-27', 'US', 'Thanksgiving Day', TRUE),
('2025-12-25', 'US', 'Christmas Day', TRUE),
('2026-01-01', 'US', 'New Year''s Day', TRUE),
('2026-01-19', 'US', 'Martin Luther King Jr. Day', TRUE),
('2026-02-16', 'US', 'Washington''s Birthday', TRUE),
('2026-05-25', 'US', 'Memorial Day', TRUE),
('2026-06-19', 'US', 'Juneteenth', TRUE),
('2026-07-03', 'US', 'Independence Day (observed)', TRUE),
('2026-09-07', 'US', 'Labor Day', TRUE),
('2026-10-12', 'US', 'Columbus Day', TRUE),
('2026-11-11', 'US', 'Veterans Day', TRUE),
('2026-11-26', 'US', 'Thanksgiving Day', TRUE),
('2026-12-25', 'US', 'Christmas Day', TRUE),
('2027-01-01', 'US', 'New Year''s Day', TRUE),
('2027-01-18', 'US', 'Martin Luther King Jr. Day', TRUE),
('2027-02-15', 'US', 'Washington''s Birthday', TRUE),
('2027-05-31', 'US', 'Memorial Day', TRUE),
('2027-06-18', 'US', 'Juneteenth (observed)', TRUE),
('2027-07-05', 'US', 'Independence Day (observed)', TRUE),
('2027-09-06', 'US', 'Labor Day', TRUE),
('2027-10-11', 'US', 'Columbus Day', TRUE),
('2027-11-11', 'US', 'Veterans Day', TRUE),
('2027-11-25', 'US', 'Thanksgiving Day', TRUE),
('2027-12-24', 'US', 'Christmas Day (observed)', TRUE),
('2027-12-31', 'US', 'New Year''s Day (observed)', TRUE),
('2028-01-17', 'US', 'Martin Luther King Jr. Day', TRUE),
('2028-02-21', 'US', 'Washington''s Birthday', TRUE),
('2028-05-29', 'US', 'Memorial Day', TRUE),
('2028-06-19', 'US', 'Juneteenth', TRUE),
('2028-07-04', 'US', 'Independence Day', TRUE),
('2028-09-04', 'US', 'Labor Day', TRUE),
('2028-10-09', 'US', 'Columbus Day', TRUE),
('2028-11-10', 'US', 'Veterans Day (observed)', TRUE),
('2028-11-23', 'US', 'Thanksgiving Day', TRUE),
('2028-12-25', 'US', 'Christmas Day', TRUE),
('2029-01-01', 'US', 'New Year''s Day', TRUE),
('2029-01-15', 'US', 'Martin Luther King Jr. Day', TRUE),
('2029-02-19', 'US', 'Washington''s Birthday', TRUE),
('2029-05-28', 'US', 'Memorial Day', TRUE),
('2029-06-19', 'US', 'Juneteenth', TRUE),
('2029-07-04', 'US', 'Independence Day', TRUE),
('2029-09-03', 'US', 'Labor Day', TRUE),
('2029-10-08', 'US', 'Columbus Day', TRUE),
('2029-11-12', 'US', 'Veterans Day (observed)', TRUE),
('2029-11-22', 'US', 'Thanksgiving Day', TRUE),
('2029-12-25', 'US', 'Christmas Day', TRUE),
('2030-01-01', 'US', 'New Year''s Day', TRUE),
('2030-01-21', 'US', 'Martin Luther King Jr. Day', TRUE),
('2030-02-18', 'US', 'Washington''s Birthday', TRUE),
('2030-05-27', 'US', 'Memorial Day', TRUE),
('2030-06-19', 'US', 'Juneteenth', TRUE),
('2030-07-04', 'US', 'Independence Day', TRUE),
('2030-09-02', 'US', 'Labor Day', TRUE),
('2030-10-14', 'US', 'Columbus Day', TRUE),
('2030-11-11', 'US', 'Veterans Day', TRUE),
('2030-11-28', 'US', 'Thanksgiving Day', TRUE),
('2030-12-25', 'US', 'Christmas Day', TRUE)
ON CONFLICT (date, country_code) DO NOTHING;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_clients_workspace ON clients(workspace_id);
CREATE INDEX IF NOT EXISTS idx_brands_client ON brands(client_id);
CREATE INDEX IF NOT EXISTS idx_projects_brand ON projects(brand_id);

CREATE INDEX IF NOT EXISTS idx_tactics_status ON tactics(status);
CREATE INDEX IF NOT EXISTS idx_tactics_channel ON tactics(channel);
CREATE INDEX IF NOT EXISTS idx_tactics_kind ON tactics(tactic_kind);

CREATE INDEX IF NOT EXISTS idx_project_tactics_project ON project_tactics(project_key);
CREATE INDEX IF NOT EXISTS idx_project_tactics_project_status ON project_tactics(project_key, lifecycle_status);
CREATE INDEX IF NOT EXISTS idx_project_tactics_tactic ON project_tactics(tactic_id);

CREATE INDEX IF NOT EXISTS idx_runs_agent_created ON agent_runs(agent_key, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_runs_status_created ON agent_runs(status, created_at);
CREATE INDEX IF NOT EXISTS idx_agent_runs_parent ON agent_runs(parent_run_id);
CREATE INDEX IF NOT EXISTS idx_agent_runs_conversation ON agent_runs(conversation_id) WHERE conversation_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_artifacts_run ON artifacts(run_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_approvals_status ON approvals(status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_run_events_run_created ON run_events(run_id, created_at);
CREATE INDEX IF NOT EXISTS idx_project_items_project ON project_items(project_key, item_type, status);

CREATE INDEX IF NOT EXISTS holidays_country_date_idx ON holidays (country_code, date);

CREATE INDEX IF NOT EXISTS idx_chunks_text ON document_chunks USING gin (to_tsvector('english', content));

CREATE INDEX IF NOT EXISTS idx_memories_title_body ON memories USING gin (to_tsvector('english', title || ' ' || body));
CREATE INDEX IF NOT EXISTS idx_memories_workspace ON memories(workspace_key);
CREATE INDEX IF NOT EXISTS idx_memories_workspace_project ON memories(workspace_key, project_key);

CREATE INDEX IF NOT EXISTS idx_source_documents_project_list
  ON source_documents (project_key, created_at DESC)
  WHERE archived_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_source_documents_workspace
  ON source_documents (workspace_key)
  WHERE archived_at IS NULL;

-- Learning platform (enrollments, progress, competencies)
CREATE TABLE IF NOT EXISTS learning_enrollments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_sub TEXT NOT NULL,
  module_type TEXT NOT NULL CHECK (module_type IN ('pharma_knowledge', 'role_playbook')),
  playbook_id TEXT NOT NULL,
  playbook_version INT NOT NULL,
  agency_role TEXT CHECK (agency_role IS NULL OR agency_role IN ('account_management', 'project_management', 'creative', 'mlr_ops', 'dev_veeva')),
  vertical TEXT CHECK (vertical IS NULL OR vertical IN ('pharma', 'non_pharma')),
  brand_key TEXT,
  sandbox_project_key TEXT NOT NULL REFERENCES projects(key) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'abandoned')),
  current_step_id TEXT,
  branch_path JSONB NOT NULL DEFAULT '[]'::jsonb,
  recap_due_at TIMESTAMPTZ,
  content_seen_version INT,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_learning_enrollments_user_playbook_brand
  ON learning_enrollments (user_sub, playbook_id, COALESCE(brand_key, ''));

CREATE INDEX IF NOT EXISTS idx_learning_enrollments_user ON learning_enrollments (user_sub, status);
CREATE INDEX IF NOT EXISTS idx_learning_enrollments_playbook ON learning_enrollments (playbook_id, status);

CREATE TABLE IF NOT EXISTS learning_step_completions (
  enrollment_id UUID NOT NULL REFERENCES learning_enrollments(id) ON DELETE CASCADE,
  step_id TEXT NOT NULL,
  completed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  validation_kind TEXT NOT NULL DEFAULT 'manual',
  validation_ref JSONB NOT NULL DEFAULT '{}'::jsonb,
  PRIMARY KEY (enrollment_id, step_id)
);

CREATE TABLE IF NOT EXISTS learning_competencies (
  user_sub TEXT NOT NULL,
  competency_id TEXT NOT NULL,
  granted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  enrollment_id UUID REFERENCES learning_enrollments(id) ON DELETE SET NULL,
  PRIMARY KEY (user_sub, competency_id)
);

CREATE INDEX IF NOT EXISTS idx_learning_competencies_user ON learning_competencies (user_sub);

-- Phase 10: retrieval playground (see init/030_retrieval_v2.sql for migrations on existing DBs)
ALTER TABLE memories ADD COLUMN IF NOT EXISTS text_hash TEXT;

CREATE TABLE IF NOT EXISTS embeddings (
  source_type TEXT NOT NULL CHECK (source_type IN ('document_chunk', 'memory')),
  source_id UUID NOT NULL,
  embedder_id TEXT NOT NULL,
  dim INT NOT NULL CHECK (dim IN (768, 1024)),
  text_hash TEXT NOT NULL,
  embedding_768 vector(768),
  embedding_1024 vector(1024),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (source_type, source_id, embedder_id),
  CONSTRAINT embeddings_dim_vector CHECK (
    (dim = 768 AND embedding_768 IS NOT NULL AND embedding_1024 IS NULL)
    OR (dim = 1024 AND embedding_1024 IS NOT NULL AND embedding_768 IS NULL)
  )
);

CREATE TABLE IF NOT EXISTS embedder_catalog (
  embedder_id TEXT PRIMARY KEY,
  dim INT NOT NULL,
  backend TEXT NOT NULL DEFAULT 'ollama',
  ollama_tag TEXT NOT NULL,
  display_name TEXT NOT NULL,
  notes TEXT,
  enabled BOOLEAN NOT NULL DEFAULT true
);

CREATE TABLE IF NOT EXISTS reranker_catalog (
  reranker_id TEXT PRIMARY KEY,
  backend TEXT NOT NULL,
  endpoint TEXT,
  model_tag TEXT,
  display_name TEXT NOT NULL,
  notes TEXT,
  enabled BOOLEAN NOT NULL DEFAULT true
);

CREATE TABLE IF NOT EXISTS agent_retrieval_config (
  agent TEXT PRIMARY KEY,
  embedder_id TEXT NOT NULL REFERENCES embedder_catalog(embedder_id),
  reranker_id TEXT NOT NULL REFERENCES reranker_catalog(reranker_id),
  top_k_retrieve INT NOT NULL DEFAULT 60,
  top_k_rerank INT NOT NULL DEFAULT 12,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by TEXT
);

COMMIT;


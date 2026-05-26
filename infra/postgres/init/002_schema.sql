CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS agents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  default_model TEXT NOT NULL,
  system_prompt TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

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

CREATE INDEX IF NOT EXISTS idx_clients_workspace ON clients(workspace_id);

CREATE TABLE IF NOT EXISTS brands (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  key TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(client_id, key)
);

CREATE INDEX IF NOT EXISTS idx_brands_client ON brands(client_id);

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
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_projects_brand ON projects(brand_id);

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

CREATE INDEX IF NOT EXISTS idx_tactics_status ON tactics(status);
CREATE INDEX IF NOT EXISTS idx_tactics_channel ON tactics(channel);
CREATE INDEX IF NOT EXISTS idx_tactics_kind ON tactics(tactic_kind);

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

CREATE INDEX IF NOT EXISTS idx_project_tactics_project ON project_tactics(project_key);
CREATE INDEX IF NOT EXISTS idx_project_tactics_project_status ON project_tactics(project_key, lifecycle_status);
CREATE INDEX IF NOT EXISTS idx_project_tactics_tactic ON project_tactics(tactic_id);

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
  metadata JSONB NOT NULL DEFAULT '{}',
  ingested_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
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
  source_document_id UUID REFERENCES source_documents(id),
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

CREATE INDEX IF NOT EXISTS idx_memories_title_body ON memories USING gin (to_tsvector('english', title || ' ' || body));
CREATE INDEX IF NOT EXISTS idx_memories_workspace ON memories(workspace_key);
CREATE INDEX IF NOT EXISTS idx_memories_workspace_project ON memories(workspace_key, project_key);
CREATE INDEX IF NOT EXISTS idx_runs_agent_created ON agent_runs(agent_key, created_at DESC);

CREATE TABLE IF NOT EXISTS run_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id UUID NOT NULL REFERENCES agent_runs(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  message TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Existing DBs: see init/012_project_items_cost.sql (and prior item_type migrations).

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

CREATE INDEX IF NOT EXISTS idx_run_events_run_created ON run_events(run_id, created_at);
CREATE INDEX IF NOT EXISTS idx_project_items_project ON project_items(project_key, item_type, status);
CREATE INDEX IF NOT EXISTS idx_chunks_text ON document_chunks USING gin (to_tsvector('english', content));

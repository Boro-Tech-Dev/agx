-- Learning platform: enrollments, step completions, competencies (Phase 3).
-- Apply on existing DB: psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f infra/postgres/init/022_learning.sql

BEGIN;

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

COMMIT;

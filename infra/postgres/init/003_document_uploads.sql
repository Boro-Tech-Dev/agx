-- Project file uploads: hierarchy scope, processing lifecycle, PM classification

ALTER TABLE source_documents
  ADD COLUMN IF NOT EXISTS workspace_key TEXT REFERENCES workspaces(key) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS project_key TEXT REFERENCES projects(key) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS original_filename TEXT,
  ADD COLUMN IF NOT EXISTS processing_status TEXT NOT NULL DEFAULT 'ready',
  ADD COLUMN IF NOT EXISTS error_message TEXT,
  ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS document_kind TEXT NOT NULL DEFAULT 'general';

ALTER TABLE source_documents DROP CONSTRAINT IF EXISTS source_documents_processing_status_check;
ALTER TABLE source_documents ADD CONSTRAINT source_documents_processing_status_check
  CHECK (processing_status IN ('queued', 'processing', 'ready', 'failed'));

ALTER TABLE source_documents DROP CONSTRAINT IF EXISTS source_documents_document_kind_check;
ALTER TABLE source_documents ADD CONSTRAINT source_documents_document_kind_check
  CHECK (document_kind IN (
    'timeline', 'brief', 'estimate', 'concept', 'changeorder', 'contract', 'spec', 'general',
    'clinical_note', 'lab_report', 'imaging_report'
  ));

ALTER TABLE memories DROP CONSTRAINT IF EXISTS memories_source_document_id_fkey;
ALTER TABLE memories ADD CONSTRAINT memories_source_document_id_fkey
  FOREIGN KEY (source_document_id) REFERENCES source_documents(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_source_documents_project_list
  ON source_documents (project_key, created_at DESC)
  WHERE archived_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_source_documents_workspace
  ON source_documents (workspace_key)
  WHERE archived_at IS NULL;

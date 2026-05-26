-- Add document_kind omnichannel_plan (versioned JSON tactic mix for Tools → Scenario Planner).
-- Apply on existing databases: psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f infra/postgres/init/017_document_kind_omnichannel_plan.sql

ALTER TABLE source_documents DROP CONSTRAINT IF EXISTS source_documents_document_kind_check;
ALTER TABLE source_documents ADD CONSTRAINT source_documents_document_kind_check
  CHECK (document_kind IN (
    'timeline', 'brief', 'estimate', 'concept', 'changeorder', 'contract', 'spec', 'general',
    'clinical_note', 'lab_report', 'imaging_report', 'scenario', 'omnichannel_plan'
  ));

-- Add document_kind veeva_suite (Tools → Veeva Suite output ZIP attached to project).
-- Apply on existing databases: psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f infra/postgres/init/021_document_kind_veeva_suite.sql
ALTER TABLE source_documents DROP CONSTRAINT IF EXISTS source_documents_document_kind_check;
ALTER TABLE source_documents ADD CONSTRAINT source_documents_document_kind_check
  CHECK (document_kind IN (
    'timeline', 'brief', 'estimate', 'concept', 'changeorder', 'contract', 'spec', 'general',
    'clinical_note', 'lab_report', 'imaging_report', 'scenario', 'omnichannel_plan', 'veeva_suite'
  ));

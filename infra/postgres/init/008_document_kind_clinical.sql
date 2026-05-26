-- Extend document_kind for health-record uploads (clinical_note, lab_report, imaging_report).
-- Apply on existing databases: psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f infra/postgres/init/008_document_kind_clinical.sql

ALTER TABLE source_documents DROP CONSTRAINT IF EXISTS source_documents_document_kind_check;
ALTER TABLE source_documents ADD CONSTRAINT source_documents_document_kind_check
  CHECK (document_kind IN (
    'timeline', 'brief', 'estimate', 'concept', 'changeorder', 'contract', 'spec', 'general',
    'clinical_note', 'lab_report', 'imaging_report'
  ));

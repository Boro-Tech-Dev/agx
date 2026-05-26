-- Enforce canonical project_type slugs (see apps/agent-api/app/project_type_catalog.py).

UPDATE projects
SET project_type = 'other'
WHERE project_type IS NULL
   OR trim(project_type) = ''
   OR lower(trim(project_type)) NOT IN (
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
    );

UPDATE projects SET project_type = lower(trim(project_type));

ALTER TABLE projects ALTER COLUMN project_type SET DEFAULT 'other';

ALTER TABLE projects ALTER COLUMN project_type SET NOT NULL;

ALTER TABLE projects DROP CONSTRAINT IF EXISTS projects_project_type_check;

ALTER TABLE projects
    ADD CONSTRAINT projects_project_type_check CHECK (
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
    );

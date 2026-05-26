-- Allow timeline-derived project items (canonical schedule mapping from timeline uploads).

ALTER TABLE project_items DROP CONSTRAINT IF EXISTS project_items_item_type_check;
ALTER TABLE project_items ADD CONSTRAINT project_items_item_type_check CHECK (
  item_type IN (
    'task', 'risk', 'decision', 'dependency', 'milestone', 'idea', 'open_question', 'anomaly',
    'timeline_event'
  )
);

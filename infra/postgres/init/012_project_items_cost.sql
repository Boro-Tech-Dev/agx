-- Allow cost / scope-impact project items (distinct from delivery risks).

ALTER TABLE project_items DROP CONSTRAINT IF EXISTS project_items_item_type_check;
ALTER TABLE project_items ADD CONSTRAINT project_items_item_type_check CHECK (
  item_type IN (
    'task', 'risk', 'decision', 'dependency', 'milestone', 'idea', 'open_question', 'anomaly',
    'timeline_event', 'cost'
  )
);

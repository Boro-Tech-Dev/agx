'use client';

import { useMemo } from 'react';

import { ganttRowToTimelineRow, projectItemsToGanttRows } from '../../../lib/gantt/ganttModel';
import TimelineKeyDatesView from './TimelineKeyDatesView';

const WORKSPACE_TIMELINE_DESCRIPTION =
  'For PRB1 we submit layouts; for PRB2 coded (HTML) or mechanicalized files. All production is started in parallel with PRB1.';

export default function TimelineKeyDatesSection({ items }: { items: any[] }) {
  const rows = useMemo(
    () => projectItemsToGanttRows(items).map(ganttRowToTimelineRow),
    [items],
  );

  return (
    <TimelineKeyDatesView
      rows={rows}
      title="Key dates (timeline files)"
      description={WORKSPACE_TIMELINE_DESCRIPTION}
    />
  );
}

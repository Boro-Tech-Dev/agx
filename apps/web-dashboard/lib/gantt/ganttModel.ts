/**
 * Map persisted project_items (timeline_event) → vis-timeline DataSets.
 * Shared with Workspaces timeline mapping (same date fallbacks as TimelineKeyDatesSection).
 */

import { addCalendarDaysUTC, parseIsoDateUTC } from '../scenarioPlanner/dateCalendar';
import type { TimelineKeyDatesRow } from '../timelineKeyDatesModel';
import { isSparseTimelineMilestonePhase, timelineMilestoneKind } from '../timelineMilestones';

export type GanttGroupBy = 'phase_kind' | 'phase' | 'project' | 'flat';

export type GanttRow = TimelineKeyDatesRow & {
  project_key: string;
  project_name?: string;
  workspace_key?: string;
  status?: string;
  source_run_id?: string | null;
};

/** Raw API row (single-project items or timeline-events aggregate). */
export type ProjectItemLike = {
  id?: string;
  item_type?: string;
  title?: string;
  due_date?: string | null;
  metadata?: unknown;
  status?: string;
  source_run_id?: string | null;
  project_key?: string;
  project_name?: string;
  workspace_key?: string;
};

export function itemMetadata(it: unknown): Record<string, unknown> {
  const m = (it as { metadata?: unknown })?.metadata;
  if (m && typeof m === 'object' && !Array.isArray(m)) return m as Record<string, unknown>;
  return {};
}

/** Map one project_item row to a GanttRow (timeline_event only). */
export function projectItemToGanttRow(it: ProjectItemLike): GanttRow | null {
  if (String(it.item_type || '') !== 'timeline_event') return null;
  const md = itemMetadata(it);
  const s0 = typeof md.start_date_iso === 'string' ? String(md.start_date_iso).slice(0, 10) : '';
  const e0 = typeof md.end_date_iso === 'string' ? String(md.end_date_iso).slice(0, 10) : '';
  const due0 = it.due_date ? String(it.due_date).slice(0, 10) : '';
  const start_date_iso = s0 || due0 || e0 || '';
  const end_date_iso = e0 || due0 || s0 || '';
  if (!start_date_iso) return null;
  const raw_label = typeof md.raw_label === 'string' ? md.raw_label : '';
  const timeline_note = typeof md.timeline_note === 'string' ? md.timeline_note : '';
  const phase_id = typeof md.phase_id === 'string' ? md.phase_id : null;
  const phase_order = Number(md.phase_order) || 0;
  return {
    id: String(it.id ?? ''),
    title: String(it.title || ''),
    start_date_iso,
    end_date_iso,
    phase_id,
    phase_order,
    raw_label: raw_label || undefined,
    timeline_note: timeline_note || undefined,
    project_key: String(it.project_key ?? ''),
    project_name: typeof it.project_name === 'string' ? it.project_name : undefined,
    workspace_key: typeof it.workspace_key === 'string' ? it.workspace_key : undefined,
    status: typeof it.status === 'string' ? it.status : undefined,
    source_run_id: it.source_run_id ?? undefined,
  };
}

export function projectItemsToGanttRows(items: ProjectItemLike[]): GanttRow[] {
  const out: GanttRow[] = [];
  for (const it of items) {
    const row = projectItemToGanttRow(it);
    if (row?.id) out.push(row);
  }
  return out;
}

const PHASE_KIND_LABEL: Record<string, string> = {
  kickoff_vendor: 'Kickoff & release to vendors',
  client_review: 'Client reviews',
  internal_review: 'Internal reviews',
  prb_submission: 'PRB submissions',
  development_days: 'Development days',
  prb_review: 'PRB reviews',
  other: 'Other phases',
};

function groupIdAndLabel(row: GanttRow, groupBy: GanttGroupBy): { id: string; label: string; order: number } {
  if (groupBy === 'flat') {
    return { id: '__all__', label: 'Timeline', order: 0 };
  }
  if (groupBy === 'project') {
    const pk = row.project_key || 'unknown';
    const name = row.project_name?.trim() || pk;
    return { id: `p:${pk}`, label: `${name} (${pk})`, order: 0 };
  }
  if (groupBy === 'phase') {
    const pid = row.phase_id || 'unknown';
    return { id: `ph:${pid}`, label: pid.replace(/_/g, ' '), order: row.phase_order };
  }
  const kind = timelineMilestoneKind(row.phase_id) || 'other';
  const label = PHASE_KIND_LABEL[kind] ?? PHASE_KIND_LABEL.other;
  return {
    id: `k:${kind}`,
    label,
    order: [
      'kickoff_vendor',
      'client_review',
      'internal_review',
      'prb_submission',
      'development_days',
      'prb_review',
      'other',
    ].indexOf(kind),
  };
}

function milestoneClass(row: GanttRow): string {
  const k = timelineMilestoneKind(row.phase_id);
  if (!k) return 'gantt-bar-default';
  return `gantt-bar-${k}`;
}

/** Exclusive end instant for vis range (day after last inclusive day, noon UTC). */
export function rangeEndExclusiveUtc(endInclusiveIso: string): Date {
  return parseIsoDateUTC(addCalendarDaysUTC(endInclusiveIso.slice(0, 10), 1));
}

export type VisTimelineItem = {
  id: string;
  group: string;
  content: string;
  start: Date;
  end?: Date;
  type?: 'range' | 'point' | 'background';
  className?: string;
  title?: string;
  style?: string;
};

export type VisTimelineGroup = {
  id: string;
  content: string;
  order?: number;
};

export function sortGanttRows(rows: GanttRow[]): GanttRow[] {
  return [...rows].sort((a, b) => {
    if (a.phase_order !== b.phase_order) return a.phase_order - b.phase_order;
    const da = a.start_date_iso.slice(0, 10);
    const db = b.start_date_iso.slice(0, 10);
    return da.localeCompare(db);
  });
}

export function rowsToVis(
  rows: GanttRow[],
  groupBy: GanttGroupBy,
  opts?: { includeNotesInTitle?: boolean },
): { items: VisTimelineItem[]; groups: VisTimelineGroup[] } {
  const sorted = sortGanttRows(rows);
  const groupMap = new Map<string, { label: string; order: number }>();
  for (const row of sorted) {
    const gl = groupIdAndLabel(row, groupBy);
    if (!groupMap.has(gl.id)) {
      groupMap.set(gl.id, { label: gl.label, order: gl.order });
    }
  }
  const groupRows = Array.from(groupMap.entries())
    .map(([id, v]) => ({ id, label: v.label, order: v.order }))
    .sort((a, b) => {
      if (a.order !== b.order) return a.order - b.order;
      return a.label.localeCompare(b.label) || a.id.localeCompare(b.id);
    });
  const groups: VisTimelineGroup[] = groupRows.map((g, idx) => ({
    id: g.id,
    content: escapeHtml(g.label),
    order: idx,
  }));

  const items: VisTimelineItem[] = [];
  for (const row of sorted) {
    const { id: gid } = groupIdAndLabel(row, groupBy);
    const startIso = row.start_date_iso.slice(0, 10);
    const endIso = row.end_date_iso.slice(0, 10) || startIso;
    const start = parseIsoDateUTC(startIso);
    const sameDay = startIso === endIso;
    const cls = milestoneClass(row);
    const tipParts = opts?.includeNotesInTitle
      ? [row.title, row.timeline_note, row.raw_label].filter(Boolean)
      : [row.title];
    const title = tipParts.join(' — ');
    if (sameDay) {
      items.push({
        id: `it:${row.id}`,
        group: gid,
        content: escapeHtml(row.title || 'Phase'),
        start,
        type: 'point',
        className: cls,
        title: escapeHtml(title),
      });
    } else {
      const end = rangeEndExclusiveUtc(endIso);
      items.push({
        id: `it:${row.id}`,
        group: gid,
        content: escapeHtml(row.title || 'Phase'),
        start,
        end,
        type: 'range',
        className: cls,
        title: escapeHtml(title),
      });
    }
  }
  return { items, groups };
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Drop Gantt-only fields for calendar components. */
export function ganttRowToTimelineRow(r: GanttRow): TimelineKeyDatesRow {
  return {
    id: r.id,
    title: r.title,
    start_date_iso: r.start_date_iso,
    end_date_iso: r.end_date_iso,
    phase_id: r.phase_id,
    phase_order: r.phase_order,
    raw_label: r.raw_label,
    timeline_note: r.timeline_note,
  };
}

export type DateWindowPreset = '30' | '90' | '180' | 'quarter' | 'all';

/** Visible range: "next N days" forward from today (UTC), quarter = calendar quarter, all = wide band. */
export function dateWindowFromPreset(preset: DateWindowPreset, now = new Date()): { start: Date; end: Date } {
  const todayUtc = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0, 0));
  if (preset === 'all') {
    return {
      start: new Date(Date.UTC(now.getUTCFullYear() - 1, 0, 1, 0, 0, 0, 0)),
      end: new Date(Date.UTC(now.getUTCFullYear() + 2, 11, 31, 23, 59, 59, 999)),
    };
  }
  if (preset === 'quarter') {
    const q = Math.floor(now.getUTCMonth() / 3);
    const start = new Date(Date.UTC(now.getUTCFullYear(), q * 3, 1, 0, 0, 0, 0));
    const end = new Date(Date.UTC(now.getUTCFullYear(), q * 3 + 3, 0, 23, 59, 59, 999));
    return { start, end };
  }
  const days = preset === '30' ? 30 : preset === '90' ? 90 : 180;
  const end = new Date(todayUtc);
  end.setUTCDate(end.getUTCDate() + days);
  end.setUTCHours(23, 59, 59, 999);
  return { start: todayUtc, end };
}

export function rowOverlapsWindow(row: GanttRow, winStart: Date, winEnd: Date): boolean {
  const s = parseIsoDateUTC(row.start_date_iso.slice(0, 10)).getTime();
  const e0 = row.end_date_iso.slice(0, 10) || row.start_date_iso.slice(0, 10);
  const e = rangeEndExclusiveUtc(e0).getTime() - 1;
  const ws = winStart.getTime();
  const we = winEnd.getTime();
  return s <= we && e >= ws;
}

export function filterGanttRows(
  rows: GanttRow[],
  opts: {
    milestonesOnly: boolean;
    search: string;
    showResolved: boolean;
    window: { start: Date; end: Date };
  },
): GanttRow[] {
  const q = opts.search.trim().toLowerCase();
  return rows.filter((row) => {
    if (!rowOverlapsWindow(row, opts.window.start, opts.window.end)) return false;
    if (opts.milestonesOnly && !isSparseTimelineMilestonePhase(row.phase_id)) return false;
    if (!opts.showResolved && row.status === 'resolved') return false;
    if (q) {
      const hay = `${row.title} ${row.timeline_note ?? ''} ${row.raw_label ?? ''}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
}

import { isWeekendIso } from '../scenarioPlanner/workingDays';

/** Background span items (one per group per non-working day) for vis-timeline. */
export function backgroundItemsForNonWorkingDays(
  groupIds: string[],
  rangeStart: Date,
  rangeEnd: Date,
  holidayIsoSet: ReadonlySet<string>,
): VisTimelineItem[] {
  const items: VisTimelineItem[] = [];
  let cur = new Date(
    Date.UTC(rangeStart.getUTCFullYear(), rangeStart.getUTCMonth(), rangeStart.getUTCDate(), 0, 0, 0, 0),
  );
  const last = new Date(
    Date.UTC(rangeEnd.getUTCFullYear(), rangeEnd.getUTCMonth(), rangeEnd.getUTCDate(), 0, 0, 0, 0),
  );
  while (cur.getTime() <= last.getTime()) {
    const y = cur.getUTCFullYear();
    const mo = String(cur.getUTCMonth() + 1).padStart(2, '0');
    const d = String(cur.getUTCDate()).padStart(2, '0');
    const iso = `${y}-${mo}-${d}`;
    const nonWorking = isWeekendIso(iso) || holidayIsoSet.has(iso);
    if (nonWorking) {
      const dayStart = parseIsoDateUTC(iso);
      const dayEnd = rangeEndExclusiveUtc(iso);
      for (const gid of groupIds) {
        items.push({
          id: `nw:${gid}:${iso}`,
          group: gid,
          content: '',
          start: dayStart,
          end: dayEnd,
          type: 'background',
          style: 'background-color: rgba(120,120,140,0.12);',
        });
      }
    }
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
  return items;
}

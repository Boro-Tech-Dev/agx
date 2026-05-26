import type { DateWindowPreset } from '../gantt/ganttModel';
import type { VisTimelineGroup, VisTimelineItem } from '../gantt/ganttModel';

export type MemoryTimelineLayout = 'project' | 'flat';

export type MemoryRowLike = {
  id?: unknown;
  title?: unknown;
  body?: unknown;
  memory_type?: unknown;
  project_key?: unknown;
  created_at?: unknown;
  updated_at?: unknown;
};

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Parse `created_at` for timeline position; returns null if missing or invalid. */
export function parseMemoryCreatedAt(row: MemoryRowLike): Date | null {
  const raw = row.created_at;
  if (raw == null) return null;
  const s = typeof raw === 'string' ? raw : raw instanceof Date ? raw.toISOString() : String(raw);
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function memoryProjectKey(row: MemoryRowLike): string | null {
  const pk = row.project_key;
  if (pk == null) return null;
  const s = String(pk).trim();
  return s || null;
}

/** Client-side guard: API may change; only rows with a project and valid date become timeline points. */
export function filterMemoriesForTimeline(rows: MemoryRowLike[]): MemoryRowLike[] {
  return rows.filter((r) => memoryProjectKey(r) && parseMemoryCreatedAt(r));
}

export function memoryRowsSignature(rows: MemoryRowLike[]): string {
  const slim = filterMemoriesForTimeline(rows)
    .map((r) => ({
      id: String(r.id ?? ''),
      c: String(r.created_at ?? ''),
      u: String(r.updated_at ?? ''),
      t: String(r.title ?? '').slice(0, 120),
    }))
    .filter((x) => x.id)
    .sort((a, b) => a.id.localeCompare(b.id));
  return JSON.stringify(slim);
}

const FLAT_GROUP_ID = '__mem_flat';

/** Past-looking window: last N calendar days through end of today (UTC), plus quarter/all variants. */
export function pastDateWindowFromPreset(preset: DateWindowPreset, now = new Date()): { start: Date; end: Date } {
  const todayUtc = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0, 0));
  const endToday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 23, 59, 59, 999));

  if (preset === 'all') {
    return {
      start: new Date(Date.UTC(now.getUTCFullYear() - 1, 0, 1, 0, 0, 0, 0)),
      end: new Date(Date.UTC(now.getUTCFullYear() + 1, 11, 31, 23, 59, 59, 999)),
    };
  }
  if (preset === 'quarter') {
    const q = Math.floor(now.getUTCMonth() / 3);
    const start = new Date(Date.UTC(now.getUTCFullYear(), q * 3, 1, 0, 0, 0, 0));
    const end = new Date(Date.UTC(now.getUTCFullYear(), q * 3 + 3, 0, 23, 59, 59, 999));
    return { start, end };
  }
  const days = preset === '30' ? 30 : preset === '90' ? 90 : 180;
  const start = new Date(todayUtc);
  start.setUTCDate(start.getUTCDate() - days);
  return { start, end: endToday };
}

/** Union of preset past window and actual memory dates so older points stay visible. */
export function memoryTimelineVisibleWindow(
  preset: DateWindowPreset,
  memoryStarts: Date[],
  now = new Date(),
): { start: Date; end: Date } {
  const base = pastDateWindowFromPreset(preset, now);
  if (memoryStarts.length === 0) return base;
  const tMin = Math.min(...memoryStarts.map((d) => d.getTime()));
  const tMax = Math.max(...memoryStarts.map((d) => d.getTime()));
  const padMs = 3 * 86400000;
  const dataStart = new Date(tMin - padMs);
  const dataEnd = new Date(tMax + padMs);
  return {
    start: new Date(Math.min(base.start.getTime(), dataStart.getTime())),
    end: new Date(Math.max(base.end.getTime(), dataEnd.getTime())),
  };
}

export function memoriesToVisTimelineData(
  rows: MemoryRowLike[],
  projectNameByKey: Map<string, string>,
  layout: MemoryTimelineLayout,
): { items: VisTimelineItem[]; groups: VisTimelineGroup[] } {
  const usable = filterMemoriesForTimeline(rows)
    .map((r) => ({ r, at: parseMemoryCreatedAt(r)!, pk: memoryProjectKey(r)! }))
    .sort((a, b) => {
      const c = a.at.getTime() - b.at.getTime();
      if (c !== 0) return c;
      return String(a.r.id ?? '').localeCompare(String(b.r.id ?? ''));
    });

  if (layout === 'flat') {
    const groups: VisTimelineGroup[] = [{ id: FLAT_GROUP_ID, content: escapeHtml('All projects'), order: 0 }];
    const items: VisTimelineItem[] = usable.map(({ r, at, pk }) => {
      const title = String(r.title || 'Memory');
      const mt = String(r.memory_type || '');
      const body = String(r.body || '').slice(0, 400);
      const upRaw = r.updated_at;
      const upS = upRaw != null ? String(upRaw) : '';
      const crS = r.created_at != null ? String(r.created_at) : '';
      const tipParts = [title, mt, body, `project: ${pk}`];
      if (upS && crS && upS !== crS) tipParts.push(`updated: ${upS}`);
      return {
        id: `mem:${String(r.id)}`,
        group: FLAT_GROUP_ID,
        content: escapeHtml(title.length > 48 ? `${title.slice(0, 45)}…` : title),
        start: at,
        type: 'point' as const,
        className: 'memory-timeline-point',
        title: escapeHtml(tipParts.filter(Boolean).join(' — ')),
      };
    });
    return { items, groups };
  }

  const groupOrder = new Map<string, number>();
  const groupIds: string[] = [];
  for (const { pk } of usable) {
    if (!groupOrder.has(pk)) {
      groupOrder.set(pk, groupIds.length);
      groupIds.push(pk);
    }
  }
  groupIds.sort((a, b) => {
    const la = (projectNameByKey.get(a) || a).localeCompare(projectNameByKey.get(b) || b);
    if (la !== 0) return la;
    return a.localeCompare(b);
  });
  const groups: VisTimelineGroup[] = groupIds.map((id, idx) => ({
    id,
    content: escapeHtml(projectNameByKey.get(id) || id),
    order: idx,
  }));

  const items: VisTimelineItem[] = usable.map(({ r, at, pk }) => {
    const title = String(r.title || 'Memory');
    const mt = String(r.memory_type || '');
    const body = String(r.body || '').slice(0, 400);
    const crS = r.created_at != null ? String(r.created_at) : '';
    const upRaw = r.updated_at;
    const upS = upRaw != null ? String(upRaw) : '';
    const tipParts = [title, mt, body];
    if (upS && crS && upS !== crS) tipParts.push(`updated: ${upS}`);
    return {
      id: `mem:${String(r.id)}`,
      group: pk,
      content: escapeHtml(title.length > 48 ? `${title.slice(0, 45)}…` : title),
      start: at,
      type: 'point' as const,
      className: 'memory-timeline-point',
      title: escapeHtml(tipParts.filter(Boolean).join(' — ')),
    };
  });
  return { items, groups };
}

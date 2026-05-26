import {
  timelineMilestoneKind,
  timelineMilestoneLegend,
  timelineMilestonePalette,
  type TimelineMilestoneKind,
} from './timelineMilestones';

export type TimelineKeyDatesRow = {
  id: string;
  title: string;
  start_date_iso: string;
  end_date_iso: string;
  phase_id: string | null;
  phase_order: number;
  raw_label?: string;
  timeline_note?: string;
  /** When set (scenario planner), calendar drag maps row → `HalTimelineStep` index. */
  scenario_step_index?: number;
};

export function parseYMD(s: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s.trim());
  if (!m) return null;
  const d = new Date(+m[1], +m[2] - 1, +m[3], 12, 0, 0);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function startWeekday(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), 1).getDay();
}

export function daysInMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
}

/** First day of the month `n` months after `d` (local calendar). */
export function addCalendarMonths(d: Date, n: number): Date {
  return new Date(d.getFullYear(), d.getMonth() + n, 1);
}

/** Local calendar YYYY-MM-DD (matches `<input type="date">` and grid cells). */
export function localIsoYMD(y: number, monthIndex0: number, day: number): string {
  const mo = String(monthIndex0 + 1).padStart(2, '0');
  const d = String(day).padStart(2, '0');
  return `${y}-${mo}-${d}`;
}

/** Browser-local calendar date for `d` (default: now), same convention as `<input type="date">`. */
export function localIsoFromDate(d: Date = new Date()): string {
  return localIsoYMD(d.getFullYear(), d.getMonth(), d.getDate());
}

/** Tooltip / aria for weekend or federal holiday cells. */
export function nonWorkingDayMeta(
  y: number,
  monthIndex0: number,
  day: number,
  holidayNames: ReadonlyMap<string, string>,
): { dim: boolean; label: string | null } {
  const iso = localIsoYMD(y, monthIndex0, day);
  const cell = new Date(y, monthIndex0, day, 12, 0, 0);
  const dow = cell.getDay();
  const hol = holidayNames.get(iso);
  if (hol) return { dim: true, label: `${hol} (non-working)` };
  if (dow === 0) return { dim: true, label: 'Sunday (non-working)' };
  if (dow === 6) return { dim: true, label: 'Saturday (non-working)' };
  return { dim: false, label: null };
}

/** Calendar day numbers (1..dim) in `cursor`'s month that this row spans. */
export function dayNumbersInMonthForRow(row: TimelineKeyDatesRow, cursor: Date): number[] {
  const y = cursor.getFullYear();
  const mo = cursor.getMonth();
  const dim = daysInMonth(cursor);
  const s0 = row.start_date_iso.slice(0, 10);
  const e0 = row.end_date_iso.slice(0, 10);
  const start = parseYMD(s0);
  if (!start) return [];
  const endRaw = parseYMD(e0 || s0);
  const end = endRaw && endRaw >= start ? endRaw : start;
  const out: number[] = [];
  for (let day = 1; day <= dim; day++) {
    const cell = new Date(y, mo, day, 12, 0, 0);
    if (cell.getTime() >= start.getTime() && cell.getTime() <= end.getTime()) out.push(day);
  }
  return out;
}

export function calendarDayPresentation(list: TimelineKeyDatesRow[]): {
  cellClass: string;
  countClass: string;
  dots: TimelineMilestoneKind[];
  showPlainDot: boolean;
} {
  const kinds = list.map((it) => timelineMilestoneKind(String(it.phase_id ?? '')));
  const milestoneKinds = Array.from(new Set(kinds.filter((k): k is TimelineMilestoneKind => k !== null)));
  const hasPlain = kinds.some((k) => k === null);

  if (milestoneKinds.length === 1 && !hasPlain) {
    const p = timelineMilestonePalette[milestoneKinds[0]];
    return {
      cellClass: `${p.border} ${p.bg} text-app-text`,
      countClass: 'text-app-text',
      dots: [],
      showPlainDot: false,
    };
  }
  if (milestoneKinds.length === 0) {
    return {
      cellClass: 'border-cyan-600/40 bg-cyan-500/10 text-cyan-100',
      countClass: 'text-cyan-300',
      dots: [],
      showPlainDot: false,
    };
  }
  return {
    cellClass: 'border-app-border/80 bg-app-surface/70 text-app-text',
    countClass: 'text-app-muted',
    dots: milestoneKinds,
    showPlainDot: hasPlain,
  };
}

export function sortTimelineKeyDatesRows(rows: TimelineKeyDatesRow[]): TimelineKeyDatesRow[] {
  return [...rows].sort((a, b) => {
    const da = a.start_date_iso.slice(0, 10);
    const db = b.start_date_iso.slice(0, 10);
    if (!da && db) return 1;
    if (da && !db) return -1;
    if (da !== db) return da.localeCompare(db);
    return (a.phase_order || 0) - (b.phase_order || 0);
  });
}

export { timelineMilestoneLegend, timelineMilestonePalette, timelineMilestoneKind };

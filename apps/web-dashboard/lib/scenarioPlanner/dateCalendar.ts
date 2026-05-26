/** ISO date (YYYY-MM-DD) math in UTC to avoid DST surprises. */

const ISO = /^(\d{4})-(\d{2})-(\d{2})$/;

export function parseIsoDateUTC(iso: string): Date {
  const m = ISO.exec(iso.trim());
  if (!m) throw new Error(`Invalid ISO date: ${iso}`);
  return new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
}

export function formatIsoDateUTC(d: Date): string {
  const y = d.getUTCFullYear();
  const mo = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${mo}-${day}`;
}

export function addCalendarDaysUTC(iso: string, deltaDays: number): string {
  const d = parseIsoDateUTC(iso);
  d.setUTCDate(d.getUTCDate() + deltaDays);
  return formatIsoDateUTC(d);
}

/** Inclusive calendar-day count from start through end (same day => 1). */
export function inclusiveCalendarDaySpan(startIso: string, endIso: string): number {
  const s = parseIsoDateUTC(startIso).getTime();
  const e = parseIsoDateUTC(endIso).getTime();
  if (e < s) return 0;
  return Math.round((e - s) / 86400000) + 1;
}

/** Whole-day offset from date a to date b (b - a in calendar days). */
export function calendarDaysOffset(fromIso: string, toIso: string): number {
  const a = parseIsoDateUTC(fromIso).getTime();
  const b = parseIsoDateUTC(toIso).getTime();
  return Math.round((b - a) / 86400000);
}

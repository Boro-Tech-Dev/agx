import { addCalendarDaysUTC, parseIsoDateUTC } from './dateCalendar';

/** ISO YYYY-MM-DD strings present in DB federal-holiday set. */
export type HolidaySet = ReadonlySet<string>;

export function isWeekendIso(iso: string): boolean {
  const d = parseIsoDateUTC(iso);
  const wd = d.getUTCDay();
  return wd === 0 || wd === 6;
}

export function isWorkingDay(iso: string, holidays: HolidaySet): boolean {
  if (isWeekendIso(iso)) return false;
  return !holidays.has(iso);
}

/** First working day on or after `iso` (inclusive). */
export function nextWorkingDay(iso: string, holidays: HolidaySet): string {
  let cur = iso;
  while (!isWorkingDay(cur, holidays)) {
    cur = addCalendarDaysUTC(cur, 1);
  }
  return cur;
}

/** Last working day on or before `iso` (inclusive). Walks backward at most ~10 years. */
export function previousWorkingDayOnOrBefore(iso: string, holidays: HolidaySet): string {
  let cur = iso;
  let guard = 0;
  const maxGuard = 4000;
  while (!isWorkingDay(cur, holidays)) {
    cur = addCalendarDaysUTC(cur, -1);
    guard += 1;
    if (guard > maxGuard) {
      throw new Error('previousWorkingDayOnOrBefore: no working day found within search window');
    }
  }
  return cur;
}

/**
 * Move forward `delta` working days from `startIso`.
 * `startIso` must already be a working day. `delta` must be >= 0.
 * delta 0 returns startIso.
 */
export function addWorkingDaysUTC(startIso: string, delta: number, holidays: HolidaySet): string {
  if (delta < 0) throw new Error('addWorkingDaysUTC: delta must be non-negative');
  let cur = startIso;
  let left = delta;
  while (left > 0) {
    cur = addCalendarDaysUTC(cur, 1);
    if (isWorkingDay(cur, holidays)) left -= 1;
  }
  return cur;
}

/** Count working days from start through end inclusive. Returns 0 if end < start. */
export function inclusiveWorkingDaySpan(startIso: string, endIso: string, holidays: HolidaySet): number {
  const s = parseIsoDateUTC(startIso).getTime();
  const e = parseIsoDateUTC(endIso).getTime();
  if (e < s) return 0;
  let cur = startIso;
  let n = 0;
  while (true) {
    if (isWorkingDay(cur, holidays)) n += 1;
    if (cur === endIso) break;
    cur = addCalendarDaysUTC(cur, 1);
  }
  return n;
}

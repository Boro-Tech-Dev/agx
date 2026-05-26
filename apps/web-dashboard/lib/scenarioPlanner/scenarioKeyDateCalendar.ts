/**
 * Post-process key-date rows for scenario calendar preview: cap consecutive working-day
 * streaks (Complex default: 4 wd; Basic: 2 wd) and label working-day gaps before PRB
 * submissions as PRB prep.
 */

import { addCalendarDaysUTC } from './dateCalendar';
import { PHASE_CATALOG } from './phaseCatalog';
import { sortTimelineKeyDatesRows, type TimelineKeyDatesRow } from '../timelineKeyDatesModel';
import type { HolidaySet } from './workingDays';
import { isWorkingDay } from './workingDays';

export const PRB_PREP_PHASE_ID = 'prb_prep';

const SUBMIT_PRB_PHASE_IDS = new Set(['submit_prb1', 'submit_prb2', 'submit_prb3']);

/** Max consecutive working days per calendar segment for Complex scenario preview. */
export const COMPLEX_KEY_DATE_MAX_CONSECUTIVE_WD = 4;

/** Max consecutive working days per calendar segment for Basic scenario preview. */
export const BASIC_KEY_DATE_MAX_CONSECUTIVE_WD = 2;

function workingDaysInInclusiveRange(startIso: string, endIso: string, holidays: HolidaySet): string[] {
  if (startIso > endIso) return [];
  const out: string[] = [];
  let cur = startIso;
  while (true) {
    if (isWorkingDay(cur, holidays)) out.push(cur);
    if (cur === endIso) break;
    cur = addCalendarDaysUTC(cur, 1);
  }
  return out;
}

/** Contiguous working-day blocks within a calendar-day gap (weekends/holidays split runs). */
function workingDayRunsInGap(gapStart: string, gapEnd: string, holidays: HolidaySet): string[][] {
  if (gapStart > gapEnd) return [];
  const runs: string[][] = [];
  let curRun: string[] = [];
  let cur = gapStart;
  while (true) {
    if (isWorkingDay(cur, holidays)) {
      curRun.push(cur);
    } else if (curRun.length) {
      runs.push(curRun);
      curRun = [];
    }
    if (cur === gapEnd) break;
    cur = addCalendarDaysUTC(cur, 1);
  }
  if (curRun.length) runs.push(curRun);
  return runs;
}

function prepPhaseOrderBeforeSubmit(submitPhaseId: string): number {
  const cat = PHASE_CATALOG.find((r) => r.phase_id === submitPhaseId);
  return (cat?.order ?? 0) - 0.5;
}

function buildPrepRowsForGap(
  gapStart: string,
  gapEnd: string,
  holidays: HolidaySet,
  targetSubmitPhaseId: string,
  maxWd: number,
): TimelineKeyDatesRow[] {
  const runs = workingDayRunsInGap(gapStart, gapEnd, holidays);
  const phaseOrder = prepPhaseOrderBeforeSubmit(targetSubmitPhaseId);
  const out: TimelineKeyDatesRow[] = [];
  let seq = 0;
  for (const run of runs) {
    for (let i = 0; i < run.length; i += maxWd) {
      const slice = run.slice(i, i + maxWd);
      if (slice.length === 0) continue;
      const s = slice[0]!;
      const e = slice[slice.length - 1]!;
      out.push({
        id: `prb_prep-${targetSubmitPhaseId}-${s}-${e}-${seq++}`,
        title: 'PRB prep',
        start_date_iso: s,
        end_date_iso: e,
        phase_id: PRB_PREP_PHASE_ID,
        phase_order: phaseOrder,
        raw_label: 'PRB prep',
      });
    }
  }
  return out;
}

function splitRowByMaxWorkingDays(
  row: TimelineKeyDatesRow,
  holidays: HolidaySet,
  maxWd: number,
): TimelineKeyDatesRow[] {
  const s = row.start_date_iso.slice(0, 10);
  const e = row.end_date_iso.slice(0, 10);
  const wds = workingDaysInInclusiveRange(s, e, holidays);
  if (wds.length === 0 || wds.length <= maxWd) return [row];
  const chunks: TimelineKeyDatesRow[] = [];
  for (let i = 0; i < wds.length; i += maxWd) {
    const slice = wds.slice(i, i + maxWd);
    const cs = slice[0]!;
    const ce = slice[slice.length - 1]!;
    chunks.push({
      ...row,
      id: `${row.id}-wd${i}`,
      start_date_iso: cs,
      end_date_iso: ce,
    });
  }
  return chunks;
}

/**
 * Enrich key-date rows: no segment spans more than `maxWd` consecutive working days;
 * working-day calendar gaps immediately before each PRB submission become PRB prep rows.
 * Use {@link COMPLEX_KEY_DATE_MAX_CONSECUTIVE_WD} or {@link BASIC_KEY_DATE_MAX_CONSECUTIVE_WD}.
 */
export function enrichComplexScenarioKeyDateRows(
  rows: TimelineKeyDatesRow[],
  holidays: HolidaySet,
  maxWd: number = COMPLEX_KEY_DATE_MAX_CONSECUTIVE_WD,
): TimelineKeyDatesRow[] {
  const sorted = sortTimelineKeyDatesRows(rows);
  const out: TimelineKeyDatesRow[] = [];
  let lastEnd: string | null = null;

  for (const row of sorted) {
    const phaseId = row.phase_id;
    if (phaseId && SUBMIT_PRB_PHASE_IDS.has(phaseId) && lastEnd !== null) {
      const rowStart = row.start_date_iso.slice(0, 10);
      const gapStart = addCalendarDaysUTC(lastEnd, 1);
      const gapEnd = addCalendarDaysUTC(rowStart, -1);
      if (gapStart <= gapEnd) {
        out.push(...buildPrepRowsForGap(gapStart, gapEnd, holidays, phaseId, maxWd));
      }
    }

    const chunks = splitRowByMaxWorkingDays(row, holidays, maxWd);
    out.push(...chunks);
    lastEnd = chunks[chunks.length - 1]!.end_date_iso.slice(0, 10);
  }

  return sortTimelineKeyDatesRows(out);
}

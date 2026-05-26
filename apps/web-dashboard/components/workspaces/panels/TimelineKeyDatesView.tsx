'use client';

import { useEffect, useMemo, useState } from 'react';

import type { TimelineKeyDatesRow } from '../../../lib/timelineKeyDatesModel';
import { useHolidays } from '../../../hooks/useHolidays';
import { PanelChevron } from '../PanelChevron';
import {
  addCalendarMonths,
  calendarDayPresentation,
  dayNumbersInMonthForRow,
  daysInMonth,
  localIsoYMD,
  nonWorkingDayMeta,
  sortTimelineKeyDatesRows,
  startWeekday,
  timelineMilestoneKind,
  timelineMilestoneLegend,
  timelineMilestonePalette,
} from '../../../lib/timelineKeyDatesModel';

type Props = {
  rows: TimelineKeyDatesRow[];
  /** Section heading, e.g. "Key dates (timeline files)" on Workspaces. */
  title: string;
  /** Optional intro line under the title. */
  description?: string;
  /** Third table column header (default matches Workspaces ingested timelines). */
  detailColumnHeader?: string;
  /** Scenario planner: separate collapsible Calendar vs Key dates (table); persists to localStorage. */
  variant?: 'default' | 'scenario';
  /** When set with `variant="scenario"`, calendar day cells accept drops to move a phase start (preserves span). */
  calendarDragEdit?: {
    onShiftStepToDay: (stepIndex: number, targetIso: string) => void;
  };
};

const LS_CAL = 'dd.scenarioPlanner.calendarExpanded';
const LS_CAL_LEGACY = 'dd.halScenario.calendarExpanded';
const LS_TABLE = 'dd.scenarioPlanner.keyDatesTableExpanded';
const LS_TABLE_LEGACY = 'dd.halScenario.keyDatesTableExpanded';
const LS_MONTHS_VISIBLE = 'dd.scenarioPlanner.calendarMonthsVisible';

const WEEKDAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'] as const;

function readScenarioLsBool(primary: string, legacy: string, fallback: boolean): boolean {
  if (typeof window === 'undefined') return fallback;
  if (localStorage.getItem(primary) != null) return readLsBool(primary, fallback);
  if (localStorage.getItem(legacy) != null) return readLsBool(legacy, fallback);
  return fallback;
}

function readLsBool(key: string, fallback: boolean): boolean {
  if (typeof window === 'undefined') return fallback;
  const v = localStorage.getItem(key) ?? (fallback ? '1' : '0');
  return v === '1' || v === 'true';
}

function writeLsBool(key: string, value: boolean) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(key, value ? '1' : '0');
}

function clampMonthsVisible(n: number): number {
  if (!Number.isFinite(n)) return 3;
  const rounded = Math.round(n);
  return rounded >= 5 ? 6 : 3;
}

function readScenarioLsMonthsVisible(fallback: number): number {
  if (typeof window === 'undefined') return fallback;
  const v = localStorage.getItem(LS_MONTHS_VISIBLE);
  if (v == null) return fallback;
  return clampMonthsVisible(parseInt(v, 10));
}

function formatCalendarRangeLabel(first: Date, last: Date): string {
  if (first.getTime() === last.getTime()) {
    return first.toLocaleString(undefined, { month: 'long', year: 'numeric' });
  }
  if (first.getFullYear() === last.getFullYear()) {
    const a = first.toLocaleString(undefined, { month: 'long' });
    const b = last.toLocaleString(undefined, { month: 'long', year: 'numeric' });
    return `${a} – ${b}`;
  }
  const optShort = { month: 'short', year: 'numeric' } as const;
  return `${first.toLocaleString(undefined, optShort)} – ${last.toLocaleString(undefined, optShort)}`;
}

function cellMatchesRowStart(row: TimelineKeyDatesRow, y: number, monthIndex0: number, day: number): boolean {
  const s = row.start_date_iso.slice(0, 10);
  return s === localIsoYMD(y, monthIndex0, day);
}

export default function TimelineKeyDatesView({
  rows,
  title,
  description,
  detailColumnHeader = 'From file',
  variant = 'default',
  calendarDragEdit,
}: Props) {
  const [cursor, setCursor] = useState(() => {
    const t = new Date();
    return new Date(t.getFullYear(), t.getMonth(), 1);
  });

  const [monthsVisible, setMonthsVisible] = useState(() =>
    variant === 'scenario' ? readScenarioLsMonthsVisible(3) : 3,
  );

  const sorted = useMemo(() => sortTimelineKeyDatesRows(rows), [rows]);

  const monthStarts = useMemo(() => {
    const out: Date[] = [];
    for (let i = 0; i < monthsVisible; i++) {
      out.push(addCalendarMonths(cursor, i));
    }
    return out;
  }, [cursor, monthsVisible]);

  const lastVisibleMonth = monthStarts[monthStarts.length - 1] ?? cursor;
  const holidayFrom = localIsoYMD(cursor.getFullYear(), cursor.getMonth(), 1);
  const holidayTo = localIsoYMD(
    lastVisibleMonth.getFullYear(),
    lastVisibleMonth.getMonth(),
    daysInMonth(lastVisibleMonth),
  );
  const { holidayNames, loading: holidaysLoading, error: holidaysError } = useHolidays(holidayFrom, holidayTo);

  const rangeLabel = formatCalendarRangeLabel(cursor, lastVisibleMonth);

  const byDayByMonth = useMemo(() => {
    return monthStarts.map((monthDate) => {
      const m = new Map<number, TimelineKeyDatesRow[]>();
      for (const it of sorted) {
        for (const day of dayNumbersInMonthForRow(it, monthDate)) {
          const arr = m.get(day) || [];
          arr.push(it);
          m.set(day, arr);
        }
      }
      return m;
    });
  }, [sorted, monthStarts]);

  const prevWindow = () => setCursor(addCalendarMonths(cursor, -1));
  const nextWindow = () => setCursor(addCalendarMonths(cursor, 1));

  const [calendarExpanded, setCalendarExpanded] = useState(() => readScenarioLsBool(LS_CAL, LS_CAL_LEGACY, true));
  const [tableExpanded, setTableExpanded] = useState(() => readScenarioLsBool(LS_TABLE, LS_TABLE_LEGACY, true));
  const [dragOverDropKey, setDragOverDropKey] = useState<string | null>(null);

  useEffect(() => {
    if (variant !== 'scenario') return;
    writeLsBool(LS_CAL, calendarExpanded);
  }, [variant, calendarExpanded]);

  useEffect(() => {
    if (variant !== 'scenario') return;
    writeLsBool(LS_TABLE, tableExpanded);
  }, [variant, tableExpanded]);

  useEffect(() => {
    if (variant !== 'scenario') return;
    if (typeof window === 'undefined') return;
    localStorage.setItem(LS_MONTHS_VISIBLE, String(monthsVisible));
  }, [variant, monthsVisible]);

  const compact = monthsVisible >= 4;
  const weekdayClass = compact
    ? 'mt-1 grid grid-cols-7 gap-0.5 text-center text-[7px] font-semibold uppercase text-app-muted'
    : 'mt-1 grid grid-cols-7 gap-0.5 text-center text-[8px] font-semibold uppercase text-app-muted';
  const gridClass = compact ? 'grid grid-cols-7 gap-0.5 text-[8px]' : 'grid grid-cols-7 gap-0.5 text-[9px]';
  const cellMinH = compact ? 'min-h-[1.5rem]' : 'min-h-[1.75rem]';

  const calendarGrid = (
    <>
      <div className="mt-2 flex flex-wrap items-center justify-between gap-x-2 gap-y-1.5">
        <div className="flex min-w-0 flex-1 flex-wrap items-center justify-between gap-2 tablet:justify-center">
          <button
            type="button"
            className="rounded border border-app-border bg-app-surface px-1.5 py-0.5 text-[9px] font-semibold text-app-text hover:bg-app-fill"
            onClick={prevWindow}
          >
            Prev
          </button>
          <span className="min-w-0 truncate text-center text-[10px] font-semibold text-app-text">{rangeLabel}</span>
          <button
            type="button"
            className="rounded border border-app-border bg-app-surface px-1.5 py-0.5 text-[9px] font-semibold text-app-text hover:bg-app-fill"
            onClick={nextWindow}
          >
            Next
          </button>
        </div>
        <label className="flex shrink-0 items-center gap-1 text-[9px] text-app-muted">
          <span className="whitespace-nowrap">Months</span>
          <select
            className="max-w-[3.5rem] rounded border border-app-border bg-app-surface py-0.5 pl-1 pr-0.5 text-[9px] font-medium text-app-text"
            value={monthsVisible}
            onChange={(e) => setMonthsVisible(clampMonthsVisible(Number(e.target.value)))}
            aria-label="Months shown in calendar"
          >
            {[3, 6].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div
        className="mt-2 grid grid-cols-1 gap-3 tablet:grid-cols-2 desktop:grid-cols-3"
        role="list"
        aria-label="Calendar months"
      >
        {monthStarts.map((monthDate, mi) => {
          const byDay = byDayByMonth[mi]!;
          const pad = startWeekday(monthDate);
          const dim = daysInMonth(monthDate);
          const monthTitle = monthDate.toLocaleString(undefined, { month: 'long', year: 'numeric' });
          const y = monthDate.getFullYear();
          const mo = monthDate.getMonth();

          return (
            <div key={`${y}-${mo}`} className="min-w-0" role="listitem">
              <div className="mb-0.5 text-center text-[9px] font-semibold text-app-text">{monthTitle}</div>
              <div className={weekdayClass}>
                {WEEKDAYS.map((d) => (
                  <div key={d} className="py-0.5">
                    {d}
                  </div>
                ))}
              </div>
              <div className={gridClass}>
                {Array.from({ length: pad }, (_, i) => (
                  <div key={`pad-${y}-${mo}-${i}`} className={`${cellMinH} rounded bg-transparent`} />
                ))}
                {Array.from({ length: dim }, (_, i) => {
                  const day = i + 1;
                  const list = byDay.get(day) || [];
                  const has = list.length > 0;
                  const vis = has ? calendarDayPresentation(list) : null;
                  const titles = Array.from(new Map(list.map((x) => [x.id, String(x.title || '')])).values()).filter(
                    Boolean,
                  );
                  const nw = nonWorkingDayMeta(y, mo, day, holidayNames);
                  const dimNw = nw.dim && !holidaysLoading;
                  const baseCell =
                    has && vis ? vis.cellClass : 'border-app-border/60 bg-app-surface/50 text-app-muted';
                  const dimClass = dimNw ? 'opacity-60 bg-black/[0.04] dark:bg-white/[0.06]' : '';
                  const tipParts = [...titles, nw.label].filter(Boolean);
                  const monthBit = monthsVisible > 1 ? `${monthTitle} ` : '';
                  const dropIso = localIsoYMD(y, mo, day);
                  const dropKey = `${y}-${mo}-${day}`;
                  const dragEnabled = variant === 'scenario' && calendarDragEdit != null;
                  const isDropHover = dragEnabled && dragOverDropKey === dropKey;
                  return (
                    <div
                      key={day}
                      className={`flex ${cellMinH} flex-col items-center justify-center gap-0.5 rounded border px-0.5 py-0.5 ${baseCell} ${dimClass} ${isDropHover ? 'ring-2 ring-fuchsia-500/70 ring-offset-1' : ''}`}
                      title={tipParts.join(' · ')}
                      aria-label={
                        nw.label
                          ? `${monthBit}${day}: ${nw.label}${titles.length ? ` · ${titles.join(' · ')}` : ''}`
                          : has
                            ? `${monthBit}${day}: ${titles.join(' · ')}`
                            : `${monthBit}${day}`
                      }
                      onDragOver={
                        dragEnabled
                          ? (e) => {
                              e.preventDefault();
                              e.dataTransfer.dropEffect = 'move';
                              setDragOverDropKey(dropKey);
                            }
                          : undefined
                      }
                      onDragLeave={
                        dragEnabled
                          ? (e) => {
                              if (e.currentTarget === e.target || !(e.currentTarget as Node).contains(e.relatedTarget as Node)) {
                                setDragOverDropKey((k) => (k === dropKey ? null : k));
                              }
                            }
                          : undefined
                      }
                      onDrop={
                        dragEnabled
                          ? (e) => {
                              e.preventDefault();
                              setDragOverDropKey(null);
                              const raw =
                                e.dataTransfer.getData('application/x-scenario-step') ||
                                e.dataTransfer.getData('text/plain');
                              const stepIndex = parseInt(raw, 10);
                              if (!Number.isFinite(stepIndex)) return;
                              calendarDragEdit!.onShiftStepToDay(stepIndex, dropIso);
                            }
                          : undefined
                      }
                    >
                      <span className="font-semibold">{day}</span>
                      {has && vis ? (
                        <>
                          {vis.dots.length > 0 || vis.showPlainDot ? (
                            <span className="flex items-center justify-center gap-0.5">
                              {vis.dots.map((k) => (
                                <span
                                  key={k}
                                  className={`h-1.5 w-1.5 rounded-full ${timelineMilestonePalette[k].dot}`}
                                  title={k}
                                />
                              ))}
                              {vis.showPlainDot ? (
                                <span className="h-1.5 w-1.5 rounded-full bg-cyan-400/80" title="Other" />
                              ) : null}
                            </span>
                          ) : null}
                          <span className={`text-[8px] font-bold ${vis.countClass}`}>{list.length}</span>
                        </>
                      ) : null}
                      {dragEnabled ? (
                        <span className="flex max-w-full flex-wrap justify-center gap-0.5">
                          {list
                            .filter(
                              (r) =>
                                typeof r.scenario_step_index === 'number' &&
                                cellMatchesRowStart(r, y, mo, day),
                            )
                            .map((r) => (
                              <span
                                key={`drag-${r.id}`}
                                draggable
                                title={`Drag to move “${r.title}” start to another day`}
                                onDragStart={(e) => {
                                  const id = String(r.scenario_step_index);
                                  e.dataTransfer.setData('application/x-scenario-step', id);
                                  e.dataTransfer.setData('text/plain', id);
                                  e.dataTransfer.effectAllowed = 'move';
                                }}
                                onDragEnd={() => setDragOverDropKey(null)}
                                className="cursor-grab touch-none rounded border border-app-border/80 bg-app-surface/90 px-0.5 text-[7px] font-bold leading-none text-app-muted hover:bg-app-fill-hover active:cursor-grabbing"
                              >
                                ::
                              </span>
                            ))}
                        </span>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </>
  );

  const datesTable = (
    <div className="mt-2 overflow-x-auto">
      <table className="w-full min-w-[20rem] text-left text-[10px]">
        <thead className="border-b border-app-border text-[9px] uppercase tracking-wide text-app-muted">
          <tr>
            <th className="py-0.5 pr-1">Dates</th>
            <th className="py-0.5 pr-1">Phase</th>
            <th className="py-0.5">{detailColumnHeader}</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((it) => {
            const s0 = it.start_date_iso.slice(0, 10);
            const e0 = it.end_date_iso.slice(0, 10);
            let dateStr = '—';
            if (s0 && e0) dateStr = `${s0} → ${e0}`;
            else if (s0) dateStr = s0;
            else if (e0) dateStr = e0;
            const raw = it.raw_label?.trim() ?? '';
            const note = it.timeline_note?.trim() ?? '';
            const fromFile = [raw, note].filter(Boolean).join(' · ') || '—';
            const phaseId = it.phase_id ?? '';
            const mk = timelineMilestoneKind(phaseId);
            const rowAccent = mk ? timelineMilestonePalette[mk].row : '';
            return (
              <tr
                key={it.id}
                className={`border-t border-app-border align-top even:bg-app-fill/90 ${rowAccent} pl-0.5`}
              >
                <td className="whitespace-nowrap py-0.5 pr-1 text-app-muted">{dateStr}</td>
                <td className="max-w-[14rem] py-0.5 pr-1 font-medium text-app-text">
                  <span className="inline-flex items-center gap-1">
                    {mk ? (
                      <span
                        className={`h-1.5 w-1.5 shrink-0 rounded-sm ${timelineMilestonePalette[mk].dot}`}
                        title={mk.replace(/_/g, ' ')}
                      />
                    ) : null}
                    {it.title}
                  </span>
                </td>
                <td className="max-w-[12rem] truncate py-0.5 text-[9px] text-app-muted" title={fromFile}>
                  {fromFile}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );

  const introBlock = (
    <>
      <h4 className="text-[10px] font-semibold uppercase tracking-wide text-app-muted">{title}</h4>
      {description ? (
        <p className="mt-0.5 text-[9px] leading-snug text-app-muted">{description}</p>
      ) : null}
      {holidaysError ? (
        <p className="mt-0.5 text-[9px] text-amber-700 dark:text-amber-300">
          Holidays unavailable ({holidaysError}); weekends still shown as non-working.
        </p>
      ) : null}

      <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[8px] text-app-muted">
        <span className="font-semibold uppercase tracking-wide text-app-muted/90">Milestones</span>
        {timelineMilestoneLegend.map(({ kind, label: leg }) => (
          <span key={kind} className="inline-flex items-center gap-0.5">
            <span className={`h-1.5 w-1.5 shrink-0 rounded-sm ${timelineMilestonePalette[kind].dot}`} />
            {leg}
          </span>
        ))}
      </div>
    </>
  );

  if (variant === 'scenario') {
    return (
      <div className="mb-2 rounded border border-app-border bg-app-fill/60 p-2">
        {introBlock}

        <div className="mt-2 flex flex-wrap items-center justify-between gap-2 border-b border-fuchsia-900/15 pb-1.5 dark:border-fuchsia-100/15">
          <span className="text-[10px] font-semibold uppercase tracking-wide text-fuchsia-900 dark:text-fuchsia-100">
            Key dates calendar
          </span>
          <button
            type="button"
            className="flex shrink-0 items-center justify-center rounded px-1 py-0.5 text-app-muted hover:bg-app-fill-hover"
            aria-expanded={calendarExpanded}
            aria-controls="scenario-planner-tlk-calendar"
            aria-label={calendarExpanded ? 'Collapse key dates calendar' : 'Expand key dates calendar'}
            onClick={() => setCalendarExpanded((v) => !v)}
          >
            <PanelChevron expanded={calendarExpanded} />
          </button>
        </div>
        {calendarExpanded ? (
          <div id="scenario-planner-tlk-calendar" className="min-w-0">
            {calendarGrid}
          </div>
        ) : null}

        <div className="mt-2 flex flex-wrap items-center justify-between gap-2 border-b border-fuchsia-900/15 pb-1.5 dark:border-fuchsia-100/15">
          <span className="text-[10px] font-semibold uppercase tracking-wide text-fuchsia-900 dark:text-fuchsia-100">
            Key dates
          </span>
          <button
            type="button"
            className="flex shrink-0 items-center justify-center rounded px-1 py-0.5 text-app-muted hover:bg-app-fill-hover"
            aria-expanded={tableExpanded}
            aria-controls="scenario-planner-tlk-table"
            aria-label={tableExpanded ? 'Collapse key dates table' : 'Expand key dates table'}
            onClick={() => setTableExpanded((v) => !v)}
          >
            <PanelChevron expanded={tableExpanded} />
          </button>
        </div>
        {tableExpanded ? (
          <div id="scenario-planner-tlk-table" className="min-w-0">
            {datesTable}
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div className="mb-2 rounded border border-app-border bg-app-fill/60 p-2">
      {introBlock}
      {calendarGrid}
      {datesTable}
    </div>
  );
}

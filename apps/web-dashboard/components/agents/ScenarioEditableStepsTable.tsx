'use client';

import { useMemo } from 'react';

import type { HalTimelineStep } from '../../lib/halScenario';
import { parseIsoDateUTC } from '../../lib/scenarioPlanner/dateCalendar';
import { inclusiveWorkingDaySpan, type HolidaySet } from '../../lib/scenarioPlanner/workingDays';
import { shiftStepAndFollowing } from '../../lib/scenarioPlanner/scenarioStepShift';

function rowError(step: HalTimelineStep, index: number): string | null {
  const ctx = `Row ${index + 1}`;
  const iso = /^\d{4}-\d{2}-\d{2}$/;
  if (!step.task?.trim()) return `${ctx}: task is required`;
  if (!iso.test(step.start_date)) return `${ctx}: invalid start date`;
  if (!iso.test(step.end_date)) return `${ctx}: invalid end date`;
  try {
    if (parseIsoDateUTC(step.end_date).getTime() < parseIsoDateUTC(step.start_date).getTime()) {
      return `${ctx}: end must be on or after start`;
    }
  } catch {
    return `${ctx}: invalid dates`;
  }
  return null;
}

function dayNumberFromKickoff(kickoffIso: string, stepStartIso: string): number | null {
  try {
    const a = parseIsoDateUTC(kickoffIso).getTime();
    const b = parseIsoDateUTC(stepStartIso).getTime();
    return Math.round((b - a) / 86400000) + 1;
  } catch {
    return null;
  }
}

export function ScenarioEditableStepsTable({
  steps,
  kickoffRefIso,
  holidaySet,
  onStepChange,
  onStepsReplace,
}: {
  steps: HalTimelineStep[];
  /** First step start (or anchor) for “Day N from kickoff” hint. */
  kickoffRefIso: string;
  holidaySet: HolidaySet;
  onStepChange: (index: number, next: HalTimelineStep) => void;
  onStepsReplace: (next: HalTimelineStep[]) => void;
}) {
  const holidays = holidaySet;

  const rowErrors = useMemo(() => steps.map((s, i) => rowError(s, i)), [steps]);

  return (
    <div className="mt-2 rounded border border-app-border/80 bg-app-surface/40 p-2">
      <div className="border-b border-fuchsia-900/15 pb-1.5 text-[10px] font-semibold uppercase tracking-wide text-fuchsia-900 dark:border-fuchsia-100/15 dark:text-fuchsia-100">
        Edit schedule (manual)
      </div>
      <p className="mt-1 text-[9px] leading-snug text-app-muted">
        Dates are literal calendar days (not re-run through the planner worker). Optional: drag phase starts on the
        calendar above. “Shift later” moves this row and all following rows by ±1 calendar day.
      </p>
      <div className="mt-2 max-h-72 overflow-auto rounded border border-app-border/60">
        <table className="w-full min-w-[28rem] text-left text-[9px]">
          <thead className="sticky top-0 z-[1] bg-app-fill/95 text-app-muted">
            <tr>
              <th className="px-1 py-0.5">#</th>
              <th className="px-1 py-0.5">Phase</th>
              <th className="px-1 py-0.5">From kickoff</th>
              <th className="px-1 py-0.5">Start</th>
              <th className="px-1 py-0.5">End</th>
              <th className="px-1 py-0.5">wd*</th>
              <th className="px-1 py-0.5">Note</th>
              <th className="px-1 py-0.5">Shift later</th>
            </tr>
          </thead>
          <tbody>
            {steps.map((s, i) => {
              const err = rowErrors[i];
              const wd = inclusiveWorkingDaySpan(s.start_date, s.end_date, holidays);
              const dayN = dayNumberFromKickoff(kickoffRefIso, s.start_date);
              return (
                <tr key={`${i}-${s.task}`} className={`border-t border-app-border/60 ${err ? 'bg-rose-500/10' : ''}`}>
                  <td className="whitespace-nowrap px-1 py-0.5 text-app-muted">{i + 1}</td>
                  <td className="max-w-[10rem] px-1 py-0.5 font-medium text-app-text">{s.task}</td>
                  <td className="whitespace-nowrap px-1 py-0.5 text-app-muted">
                    {dayN != null ? `Day ${dayN}` : '—'}
                  </td>
                  <td className="px-1 py-0.5">
                    <input
                      type="date"
                      value={s.start_date.slice(0, 10)}
                      onChange={(e) => {
                        const v = e.target.value;
                        if (!v) return;
                        onStepChange(i, { ...s, start_date: v });
                      }}
                      className="max-w-[9.5rem] rounded border border-app-border bg-app-surface px-0.5 py-0.5 font-mono text-[9px] text-app-text"
                    />
                  </td>
                  <td className="px-1 py-0.5">
                    <input
                      type="date"
                      value={s.end_date.slice(0, 10)}
                      onChange={(e) => {
                        const v = e.target.value;
                        if (!v) return;
                        onStepChange(i, { ...s, end_date: v });
                      }}
                      className="max-w-[9.5rem] rounded border border-app-border bg-app-surface px-0.5 py-0.5 font-mono text-[9px] text-app-text"
                    />
                  </td>
                  <td className="whitespace-nowrap px-1 py-0.5 font-mono text-app-muted" title="Working days in range (advisory)">
                    {wd}
                  </td>
                  <td className="max-w-[12rem] px-1 py-0.5">
                    <input
                      type="text"
                      value={s.note ?? ''}
                      onChange={(e) => onStepChange(i, { ...s, note: e.target.value })}
                      className="w-full min-w-[6rem] rounded border border-app-border bg-app-surface px-0.5 py-0.5 text-[9px] text-app-text"
                      placeholder="—"
                    />
                  </td>
                  <td className="whitespace-nowrap px-1 py-0.5">
                    <div className="flex flex-wrap gap-0.5">
                      <button
                        type="button"
                        title="Shift this row and all later rows −1 calendar day"
                        className="rounded border border-app-border bg-app-fill px-1 py-0.5 text-[8px] font-semibold hover:bg-app-fill-hover"
                        onClick={() => onStepsReplace(shiftStepAndFollowing(steps, i, -1))}
                      >
                        −1d
                      </button>
                      <button
                        type="button"
                        title="Shift this row and all later rows +1 calendar day"
                        className="rounded border border-app-border bg-app-fill px-1 py-0.5 text-[8px] font-semibold hover:bg-app-fill-hover"
                        onClick={() => onStepsReplace(shiftStepAndFollowing(steps, i, 1))}
                      >
                        +1d
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {rowErrors.some(Boolean) ? (
        <ul className="mt-1 list-inside list-disc text-[9px] text-rose-700 dark:text-rose-300">
          {rowErrors.map((e, i) => (e ? <li key={i}>{e}</li> : null))}
        </ul>
      ) : null}
      <p className="mt-1 text-[8px] text-app-muted">*wd = working days in range (US federal holidays + weekends excluded).</p>
    </div>
  );
}

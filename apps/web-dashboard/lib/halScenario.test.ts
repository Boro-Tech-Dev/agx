import { describe, expect, it } from 'vitest';

import {
  halTimelineStepsEqual,
  halTimelineStepsToCsv,
  parseHalTimelineCsv,
  type HalTimelineStep,
} from './halScenario';

describe('halTimelineStepsEqual', () => {
  const a: HalTimelineStep[] = [
    { task: 'A', start_date: '2026-01-01', end_date: '2026-01-02', note: 'x', allow_non_working_days: true },
  ];
  it('returns true for identical copies', () => {
    expect(halTimelineStepsEqual(a, [...a])).toBe(true);
  });
  it('returns false when dates differ', () => {
    expect(halTimelineStepsEqual(a, [{ ...a[0]!, end_date: '2026-01-03' }])).toBe(false);
  });
});

describe('halTimelineStepsToCsv', () => {
  it('round-trips simple steps without allow column', () => {
    const steps: HalTimelineStep[] = [
      { task: 'Kickoff', start_date: '2026-03-02', end_date: '2026-03-02', note: 'Hello' },
      { task: 'Next', start_date: '2026-03-03', end_date: '2026-03-05' },
    ];
    const csv = halTimelineStepsToCsv(steps);
    const p = parseHalTimelineCsv(csv);
    expect(p.ok).toBe(true);
    if (!p.ok) return;
    expect(p.steps[0]).toMatchObject(steps[0]!);
    expect(p.steps[1]).toMatchObject({ ...steps[1]!, note: '' });
  });

  it('escapes commas and quotes in task and note', () => {
    const steps: HalTimelineStep[] = [
      {
        task: 'Say "hi", team',
        start_date: '2026-01-01',
        end_date: '2026-01-01',
        note: 'Line1\nLine2, ok',
      },
    ];
    const csv = halTimelineStepsToCsv(steps);
    const p = parseHalTimelineCsv(csv);
    expect(p.ok).toBe(true);
    if (!p.ok) return;
    expect(p.steps[0]!.task).toBe('Say "hi", team');
    expect(p.steps[0]!.note).toBe('Line1\nLine2, ok');
  });

  it('includes Allow non working days when any step is calendar-day', () => {
    const steps: HalTimelineStep[] = [
      { task: 'A', start_date: '2026-01-05', end_date: '2026-01-05', allow_non_working_days: true },
      { task: 'B', start_date: '2026-01-06', end_date: '2026-01-06' },
    ];
    const csv = halTimelineStepsToCsv(steps);
    expect(csv.split('\n')[0]).toContain('Allow non working days');
    const p = parseHalTimelineCsv(csv);
    expect(p.ok).toBe(true);
    if (!p.ok) return;
    expect(p.steps[0]!.allow_non_working_days).toBe(true);
    expect(p.steps[1]!.allow_non_working_days).toBeUndefined();
  });
});

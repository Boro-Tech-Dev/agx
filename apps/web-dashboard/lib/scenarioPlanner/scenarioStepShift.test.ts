import { describe, expect, it } from 'vitest';

import type { HalTimelineStep } from '../halScenario';
import { shiftStepAndFollowing, shiftStepCalendarDays, shiftStepToStartDate } from './scenarioStepShift';

const step: HalTimelineStep = {
  task: 'A',
  start_date: '2026-06-01',
  end_date: '2026-06-05',
  note: 'n',
  allow_non_working_days: true,
};

describe('shiftStepCalendarDays', () => {
  it('shifts start and end by the same delta', () => {
    const out = shiftStepCalendarDays(step, 3);
    expect(out.start_date).toBe('2026-06-04');
    expect(out.end_date).toBe('2026-06-08');
    expect(out.task).toBe('A');
    expect(out.note).toBe('n');
    expect(out.allow_non_working_days).toBe(true);
  });

  it('returns a shallow clone when delta is 0', () => {
    const out = shiftStepCalendarDays(step, 0);
    expect(out).not.toBe(step);
    expect(out.start_date).toBe(step.start_date);
  });

  it('handles negative delta', () => {
    const out = shiftStepCalendarDays(step, -1);
    expect(out.start_date).toBe('2026-05-31');
    expect(out.end_date).toBe('2026-06-04');
  });
});

describe('shiftStepToStartDate', () => {
  it('aligns start to target and preserves span', () => {
    const out = shiftStepToStartDate(step, '2026-06-10');
    expect(out.start_date).toBe('2026-06-10');
    expect(out.end_date).toBe('2026-06-14');
  });
});

describe('shiftStepAndFollowing', () => {
  it('shifts from index onward', () => {
    const steps: HalTimelineStep[] = [
      { task: '0', start_date: '2026-01-01', end_date: '2026-01-02' },
      { task: '1', start_date: '2026-01-10', end_date: '2026-01-12' },
      { task: '2', start_date: '2026-02-01', end_date: '2026-02-03' },
    ];
    const out = shiftStepAndFollowing(steps, 1, 2);
    expect(out[0]!.start_date).toBe('2026-01-01');
    expect(out[1]!.start_date).toBe('2026-01-12');
    expect(out[1]!.end_date).toBe('2026-01-14');
    expect(out[2]!.start_date).toBe('2026-02-03');
    expect(out[2]!.end_date).toBe('2026-02-05');
  });
});

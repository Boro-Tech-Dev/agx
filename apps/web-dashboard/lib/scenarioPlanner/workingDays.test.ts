import { describe, expect, it } from 'vitest';

import {
  addWorkingDaysUTC,
  inclusiveWorkingDaySpan,
  isWorkingDay,
  nextWorkingDay,
  previousWorkingDayOnOrBefore,
} from './workingDays';

const H = new Set(['2026-03-09']); // Mon holiday in test week

describe('workingDays', () => {
  it('isWorkingDay excludes weekends and holidays', () => {
    expect(isWorkingDay('2026-03-06', H)).toBe(true); // Fri
    expect(isWorkingDay('2026-03-07', H)).toBe(false); // Sat
    expect(isWorkingDay('2026-03-08', H)).toBe(false); // Sun
    expect(isWorkingDay('2026-03-09', H)).toBe(false); // holiday Mon
    expect(isWorkingDay('2026-03-10', H)).toBe(true); // Tue
  });

  it('nextWorkingDay advances across weekend and holiday', () => {
    expect(nextWorkingDay('2026-03-06', H)).toBe('2026-03-06'); // Fri OK
    expect(nextWorkingDay('2026-03-07', H)).toBe('2026-03-10'); // Sat -> Tue (skip Sun + Mon hol)
    expect(nextWorkingDay('2026-03-09', H)).toBe('2026-03-10');
  });

  it('addWorkingDaysUTC from a working start', () => {
    expect(addWorkingDaysUTC('2026-03-06', 0, H)).toBe('2026-03-06');
    // Fri +1 working = Tue (skip weekend + holiday Mon)
    expect(addWorkingDaysUTC('2026-03-06', 1, H)).toBe('2026-03-10');
  });

  it('inclusiveWorkingDaySpan counts only working days', () => {
    expect(inclusiveWorkingDaySpan('2026-03-06', '2026-03-06', H)).toBe(1);
    // Fri through Tue: Fri + Tue = 2 working (skip Sat Sun Mon hol)
    expect(inclusiveWorkingDaySpan('2026-03-06', '2026-03-10', H)).toBe(2);
  });

  it('inclusiveWorkingDaySpan returns 0 when end before start', () => {
    expect(inclusiveWorkingDaySpan('2026-03-10', '2026-03-06', H)).toBe(0);
  });

  it('addWorkingDaysUTC rejects negative delta', () => {
    expect(() => addWorkingDaysUTC('2026-03-06', -1, H)).toThrow();
  });

  it('previousWorkingDayOnOrBefore returns same day when working', () => {
    expect(previousWorkingDayOnOrBefore('2026-03-06', H)).toBe('2026-03-06');
  });

  it('previousWorkingDayOnOrBefore skips weekend and holiday', () => {
    expect(previousWorkingDayOnOrBefore('2026-03-10', H)).toBe('2026-03-10'); // Tue
    // Sunday -> Fri (skip Sat; Mon is holiday so skip to Fri)
    expect(previousWorkingDayOnOrBefore('2026-03-08', H)).toBe('2026-03-06');
    expect(previousWorkingDayOnOrBefore('2026-03-09', H)).toBe('2026-03-06');
  });
});

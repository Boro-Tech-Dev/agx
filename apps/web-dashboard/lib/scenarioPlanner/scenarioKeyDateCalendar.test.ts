import { describe, expect, it } from 'vitest';

import type { TimelineKeyDatesRow } from '../timelineKeyDatesModel';
import {
  BASIC_KEY_DATE_MAX_CONSECUTIVE_WD,
  COMPLEX_KEY_DATE_MAX_CONSECUTIVE_WD,
  enrichComplexScenarioKeyDateRows,
  PRB_PREP_PHASE_ID,
} from './scenarioKeyDateCalendar';

const NO_HOLIDAYS = new Set<string>();

describe('enrichComplexScenarioKeyDateRows', () => {
  it('splits a phase spanning more than four consecutive working days', () => {
    const rows: TimelineKeyDatesRow[] = [
      {
        id: 'prb1_review-18',
        title: 'PRB1 review',
        start_date_iso: '2026-06-01',
        end_date_iso: '2026-06-05',
        phase_id: 'prb1_review',
        phase_order: 18,
      },
    ];
    const out = enrichComplexScenarioKeyDateRows(rows, NO_HOLIDAYS);
    expect(out).toHaveLength(2);
    expect(out[0]!.start_date_iso.slice(0, 10)).toBe('2026-06-01');
    expect(out[0]!.end_date_iso.slice(0, 10)).toBe('2026-06-04');
    expect(out[1]!.start_date_iso.slice(0, 10)).toBe('2026-06-05');
    expect(out[1]!.end_date_iso.slice(0, 10)).toBe('2026-06-05');
    expect(out[0]!.phase_id).toBe('prb1_review');
    expect(out[1]!.phase_id).toBe('prb1_review');
  });

  it('fills working-day gaps before a PRB submission with PRB prep rows', () => {
    const rows: TimelineKeyDatesRow[] = [
      {
        id: 'prior-5',
        title: 'Prior phase',
        start_date_iso: '2026-06-01',
        end_date_iso: '2026-06-08',
        phase_id: 'client_review_1_manuscript',
        phase_order: 5,
      },
      {
        id: 'submit_prb2-40',
        title: 'Submit for PRB2',
        start_date_iso: '2026-06-15',
        end_date_iso: '2026-06-15',
        phase_id: 'submit_prb2',
        phase_order: 40,
      },
    ];
    const out = enrichComplexScenarioKeyDateRows(rows, NO_HOLIDAYS);
    const prep = out.filter((r) => r.phase_id === PRB_PREP_PHASE_ID);
    expect(prep.length).toBeGreaterThanOrEqual(1);
    expect(prep[0]!.title).toBe('PRB prep');
    expect(prep[0]!.start_date_iso.slice(0, 10)).toBe('2026-06-09');
    expect(prep[0]!.end_date_iso.slice(0, 10)).toBe('2026-06-12');
  });

  it('chunks PRB prep spans longer than four working days', () => {
    const rows: TimelineKeyDatesRow[] = [
      {
        id: 'prior-5',
        title: 'Prior phase',
        start_date_iso: '2026-06-01',
        end_date_iso: '2026-06-05',
        phase_id: 'client_review_1_manuscript',
        phase_order: 5,
      },
      {
        id: 'submit_prb2-40',
        title: 'Submit for PRB2',
        start_date_iso: '2026-06-14',
        end_date_iso: '2026-06-14',
        phase_id: 'submit_prb2',
        phase_order: 40,
      },
    ];
    const out = enrichComplexScenarioKeyDateRows(rows, NO_HOLIDAYS);
    const prep = out.filter((r) => r.phase_id === PRB_PREP_PHASE_ID);
    expect(prep).toHaveLength(2);
    expect(prep[0]!.start_date_iso.slice(0, 10)).toBe('2026-06-08');
    expect(prep[0]!.end_date_iso.slice(0, 10)).toBe('2026-06-11');
    expect(prep[1]!.start_date_iso.slice(0, 10)).toBe('2026-06-12');
    expect(prep[1]!.end_date_iso.slice(0, 10)).toBe('2026-06-12');
  });

  it('respects custom max consecutive working days', () => {
    const rows: TimelineKeyDatesRow[] = [
      {
        id: 'prb1_review-18',
        title: 'PRB1 review',
        start_date_iso: '2026-06-01',
        end_date_iso: '2026-06-03',
        phase_id: 'prb1_review',
        phase_order: 18,
      },
    ];
    const out = enrichComplexScenarioKeyDateRows(rows, NO_HOLIDAYS, BASIC_KEY_DATE_MAX_CONSECUTIVE_WD);
    expect(out).toHaveLength(2);
    expect(out[0]!.end_date_iso.slice(0, 10)).toBe('2026-06-02');
    expect(out[1]!.start_date_iso.slice(0, 10)).toBe('2026-06-03');
  });

  it('chunks PRB prep using maxWd (basic: two working days per segment)', () => {
    const rows: TimelineKeyDatesRow[] = [
      {
        id: 'prior-5',
        title: 'Prior phase',
        start_date_iso: '2026-06-01',
        end_date_iso: '2026-06-05',
        phase_id: 'client_review_1_manuscript',
        phase_order: 5,
      },
      {
        id: 'submit_prb2-40',
        title: 'Submit for PRB2',
        start_date_iso: '2026-06-14',
        end_date_iso: '2026-06-14',
        phase_id: 'submit_prb2',
        phase_order: 40,
      },
    ];
    const out = enrichComplexScenarioKeyDateRows(rows, NO_HOLIDAYS, BASIC_KEY_DATE_MAX_CONSECUTIVE_WD);
    const prep = out.filter((r) => r.phase_id === PRB_PREP_PHASE_ID);
    expect(prep).toHaveLength(3);
    expect(prep[0]!.start_date_iso.slice(0, 10)).toBe('2026-06-08');
    expect(prep[0]!.end_date_iso.slice(0, 10)).toBe('2026-06-09');
    expect(prep[1]!.start_date_iso.slice(0, 10)).toBe('2026-06-10');
    expect(prep[1]!.end_date_iso.slice(0, 10)).toBe('2026-06-11');
    expect(prep[2]!.start_date_iso.slice(0, 10)).toBe('2026-06-12');
    expect(prep[2]!.end_date_iso.slice(0, 10)).toBe('2026-06-12');
  });
});

describe('COMPLEX_KEY_DATE_MAX_CONSECUTIVE_WD', () => {
  it('is four', () => {
    expect(COMPLEX_KEY_DATE_MAX_CONSECUTIVE_WD).toBe(4);
  });
});

describe('BASIC_KEY_DATE_MAX_CONSECUTIVE_WD', () => {
  it('is two', () => {
    expect(BASIC_KEY_DATE_MAX_CONSECUTIVE_WD).toBe(2);
  });
});

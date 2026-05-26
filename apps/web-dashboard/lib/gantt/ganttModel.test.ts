import { describe, expect, it } from 'vitest';

import {
  backgroundItemsForNonWorkingDays,
  filterGanttRows,
  projectItemToGanttRow,
  projectItemsToGanttRows,
  rowsToVis,
  sortGanttRows,
} from './ganttModel';

describe('projectItemToGanttRow', () => {
  it('maps timeline_event with ISO dates', () => {
    const r = projectItemToGanttRow({
      id: 'a1',
      item_type: 'timeline_event',
      title: 'Kickoff',
      metadata: {
        start_date_iso: '2026-03-02',
        end_date_iso: '2026-03-02',
        phase_id: 'kickoff',
        phase_order: 1,
      },
      project_key: 'proj-1',
    });
    expect(r).not.toBeNull();
    expect(r!.start_date_iso).toBe('2026-03-02');
    expect(r!.end_date_iso).toBe('2026-03-02');
    expect(r!.project_key).toBe('proj-1');
  });

  it('falls back to due_date when ISO missing', () => {
    const r = projectItemToGanttRow({
      id: 'b2',
      item_type: 'timeline_event',
      title: 'X',
      due_date: '2026-05-15',
      metadata: {},
      project_key: 'p',
    });
    expect(r!.start_date_iso).toBe('2026-05-15');
    expect(r!.end_date_iso).toBe('2026-05-15');
  });

  it('returns null for non-timeline item', () => {
    expect(projectItemToGanttRow({ id: '1', item_type: 'task', title: 'T', project_key: 'p' })).toBeNull();
  });
});

describe('rowsToVis', () => {
  it('uses point type for same-day span', () => {
    const rows = [
      {
        id: '1',
        title: 'One day',
        start_date_iso: '2026-06-01',
        end_date_iso: '2026-06-01',
        phase_id: 'kickoff',
        phase_order: 1,
        project_key: 'p',
      },
    ];
    const { items } = rowsToVis(rows as any, 'flat');
    expect(items).toHaveLength(1);
    expect(items[0]!.type).toBe('point');
  });

  it('uses range for multi-day', () => {
    const rows = [
      {
        id: '2',
        title: 'Span',
        start_date_iso: '2026-06-01',
        end_date_iso: '2026-06-05',
        phase_id: 'manuscript_development',
        phase_order: 2,
        project_key: 'p',
      },
    ];
    const { items } = rowsToVis(rows as any, 'flat');
    expect(items[0]!.type).toBe('range');
    expect(items[0]!.end).toBeDefined();
  });

  it('tags kickoff and vendor release for fuchsia vis bar styling', () => {
    const rows = [
      {
        id: 'ko',
        title: 'Kickoff',
        start_date_iso: '2026-06-01',
        end_date_iso: '2026-06-01',
        phase_id: 'kickoff',
        phase_order: 1,
        project_key: 'p',
      },
      {
        id: 'rv',
        title: 'Release',
        start_date_iso: '2026-06-10',
        end_date_iso: '2026-06-10',
        phase_id: 'release_assets_vendors',
        phase_order: 33,
        project_key: 'p',
      },
    ];
    const { items } = rowsToVis(rows as any, 'flat');
    expect(items[0]!.className).toBe('gantt-bar-kickoff_vendor');
    expect(items[1]!.className).toBe('gantt-bar-kickoff_vendor');
  });

  it('tags internal review phases for vis bar styling', () => {
    const rows = [
      {
        id: 'ir',
        title: 'IR',
        start_date_iso: '2026-06-01',
        end_date_iso: '2026-06-01',
        phase_id: 'internal_review_manuscript',
        phase_order: 3,
        project_key: 'p',
      },
    ];
    const { items } = rowsToVis(rows as any, 'flat');
    expect(items[0]!.className).toBe('gantt-bar-internal_review');
  });

  it('builds one group for flat mode', () => {
    const rows = [
      {
        id: '1',
        title: 'A',
        start_date_iso: '2026-06-01',
        end_date_iso: '2026-06-01',
        phase_id: 'kickoff',
        phase_order: 2,
        project_key: 'p',
      },
      {
        id: '2',
        title: 'B',
        start_date_iso: '2026-06-02',
        end_date_iso: '2026-06-02',
        phase_id: 'internal_review',
        phase_order: 1,
        project_key: 'p',
      },
    ];
    const { groups, items } = rowsToVis(rows as any, 'flat');
    expect(groups).toHaveLength(1);
    expect(groups[0]!.id).toBe('__all__');
    expect(items).toHaveLength(2);
  });

  it('groups by project', () => {
    const rows = [
      {
        id: '1',
        title: 'A',
        start_date_iso: '2026-06-01',
        end_date_iso: '2026-06-01',
        phase_id: 'kickoff',
        phase_order: 1,
        project_key: 'alpha',
        project_name: 'Alpha',
      },
      {
        id: '2',
        title: 'B',
        start_date_iso: '2026-06-02',
        end_date_iso: '2026-06-02',
        phase_id: 'kickoff',
        phase_order: 1,
        project_key: 'beta',
      },
    ];
    const { groups } = rowsToVis(rows as any, 'project');
    expect(groups.length).toBe(2);
  });
});

describe('sortGanttRows', () => {
  it('orders by phase_order then start date', () => {
    const rows = [
      {
        id: '2',
        title: 'b',
        start_date_iso: '2026-01-01',
        end_date_iso: '2026-01-01',
        phase_id: 'x',
        phase_order: 2,
        project_key: 'p',
      },
      {
        id: '1',
        title: 'a',
        start_date_iso: '2026-02-01',
        end_date_iso: '2026-02-01',
        phase_id: 'y',
        phase_order: 1,
        project_key: 'p',
      },
    ];
    const s = sortGanttRows(rows as any);
    expect(s[0]!.phase_order).toBe(1);
    expect(s[1]!.phase_order).toBe(2);
  });
});

describe('filterGanttRows', () => {
  const win = { start: new Date(Date.UTC(2026, 0, 1)), end: new Date(Date.UTC(2026, 11, 31, 23, 59, 59, 999)) };
  it('filters milestones only', () => {
    const rows = [
      {
        id: '1',
        title: 'CR',
        start_date_iso: '2026-06-01',
        end_date_iso: '2026-06-02',
        phase_id: 'client_review_1_manuscript',
        phase_order: 1,
        project_key: 'p',
      },
      {
        id: '2',
        title: 'Other',
        start_date_iso: '2026-06-10',
        end_date_iso: '2026-06-10',
        phase_id: 'kickoff',
        phase_order: 0,
        project_key: 'p',
      },
    ];
    const out = filterGanttRows(rows as any, {
      milestonesOnly: true,
      search: '',
      showResolved: true,
      window: win,
    });
    expect(out).toHaveLength(1);
    expect(out[0]!.phase_id).toBe('client_review_1_manuscript');
  });
});

describe('backgroundItemsForNonWorkingDays', () => {
  it('adds weekend backgrounds per group', () => {
    const bg = backgroundItemsForNonWorkingDays(
      ['g1'],
      new Date(Date.UTC(2026, 5, 5, 0, 0, 0, 0)), // Fri 5 Jun 2026
      new Date(Date.UTC(2026, 5, 7, 23, 59, 59, 999)),
      new Set(),
    );
    expect(bg.some((x) => x.id.includes('2026-06-06'))).toBe(true); // Sat
  });
});

describe('projectItemsToGanttRows', () => {
  it('skips invalid rows', () => {
    const rows = projectItemsToGanttRows([
      { id: '1', item_type: 'task', title: 'x', project_key: 'p' },
      { id: '2', item_type: 'timeline_event', title: 't', due_date: '2026-01-05', metadata: {}, project_key: 'p' },
    ]);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.id).toBe('2');
  });
});

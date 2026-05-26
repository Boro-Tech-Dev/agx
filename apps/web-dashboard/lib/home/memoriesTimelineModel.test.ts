import { describe, expect, it } from 'vitest';

import {
  filterMemoriesForTimeline,
  memoriesToVisTimelineData,
  memoryRowsSignature,
  memoryTimelineVisibleWindow,
  parseMemoryCreatedAt,
  pastDateWindowFromPreset,
  type MemoryRowLike,
} from './memoriesTimelineModel';

describe('parseMemoryCreatedAt', () => {
  it('returns null for missing or invalid', () => {
    expect(parseMemoryCreatedAt({})).toBeNull();
    expect(parseMemoryCreatedAt({ created_at: 'nope' })).toBeNull();
  });

  it('parses ISO string', () => {
    const d = parseMemoryCreatedAt({ created_at: '2026-04-30T12:00:00.000Z' });
    expect(d).not.toBeNull();
    expect(d!.toISOString()).toBe('2026-04-30T12:00:00.000Z');
  });
});

describe('filterMemoriesForTimeline', () => {
  it('drops null project_key and invalid dates', () => {
    const rows: MemoryRowLike[] = [
      { id: '1', project_key: 'p1', created_at: '2026-01-01T00:00:00Z', title: 'a' },
      { id: '2', project_key: null, created_at: '2026-01-02T00:00:00Z', title: 'b' },
      { id: '3', project_key: 'p1', created_at: 'bad', title: 'c' },
    ];
    expect(filterMemoriesForTimeline(rows)).toHaveLength(1);
    expect(filterMemoriesForTimeline(rows)[0].id).toBe('1');
  });
});

describe('memoryRowsSignature', () => {
  it('is stable for same logical rows', () => {
    const a: MemoryRowLike[] = [{ id: 'x', project_key: 'p', created_at: '2026-01-01T00:00:00Z', title: 't' }];
    const b: MemoryRowLike[] = [{ id: 'x', project_key: 'p', created_at: '2026-01-01T00:00:00Z', title: 't' }];
    expect(memoryRowsSignature(a)).toBe(memoryRowsSignature(b));
  });
});

describe('pastDateWindowFromPreset + memoryTimelineVisibleWindow', () => {
  it('expands window when memory dates are older than preset', () => {
    const now = new Date(Date.UTC(2026, 5, 15, 12, 0, 0, 0));
    const base = pastDateWindowFromPreset('30', now);
    const old = new Date(Date.UTC(2025, 0, 1, 0, 0, 0, 0));
    const win = memoryTimelineVisibleWindow('30', [old], now);
    expect(win.start.getTime()).toBeLessThan(base.start.getTime());
    expect(win.end.getTime()).toBeGreaterThanOrEqual(base.end.getTime());
  });
});

describe('memoriesToVisTimelineData', () => {
  const rows: MemoryRowLike[] = [
    {
      id: 'm1',
      project_key: 'proj_a',
      title: 'Hello',
      memory_type: 'note',
      body: 'Body',
      created_at: '2026-02-01T10:00:00Z',
      updated_at: '2026-02-02T10:00:00Z',
    },
  ];
  const names = new Map([['proj_a', 'Project A']]);

  it('builds one group per project in project layout', () => {
    const { items, groups } = memoriesToVisTimelineData(rows, names, 'project');
    expect(groups).toHaveLength(1);
    expect(groups[0].id).toBe('proj_a');
    expect(items).toHaveLength(1);
    expect(items[0].group).toBe('proj_a');
    expect(items[0].type).toBe('point');
    expect(items[0].id).toBe('mem:m1');
    expect(String(items[0].title || '')).toContain('updated:');
  });

  it('uses single lane for flat layout', () => {
    const { items, groups } = memoriesToVisTimelineData(rows, names, 'flat');
    expect(groups).toHaveLength(1);
    expect(items[0].group).toBe(groups[0].id);
  });
});

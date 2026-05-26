'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { DataSet } from 'vis-data';
import { Timeline } from 'vis-timeline/standalone';
import 'vis-timeline/styles/vis-timeline-graph2d.min.css';

import type { DateWindowPreset } from '../../lib/gantt/ganttModel';
import { listMemory, listProjects } from '../../lib/api';
import {
  filterMemoriesForTimeline,
  memoryRowsSignature,
  memoriesToVisTimelineData,
  memoryTimelineVisibleWindow,
  parseMemoryCreatedAt,
  type MemoryRowLike,
  type MemoryTimelineLayout,
} from '../../lib/home/memoriesTimelineModel';
import { PanelChevron } from '../workspaces/PanelChevron';

const LS = {
  sectionExpanded: 'dd.homeMemories.sectionExpanded',
  datePreset: 'dd.homeMemories.datePreset',
  layout: 'dd.homeMemories.layout',
  optionsOpen: 'dd.homeMemories.optionsOpen',
} as const;

function readLs(key: string, fallback: string): string {
  if (typeof window === 'undefined') return fallback;
  return localStorage.getItem(key) ?? fallback;
}

function readLsBool(key: string, fallback: boolean): boolean {
  const v = readLs(key, fallback ? '1' : '0');
  return v === '1' || v === 'true';
}

function writeLs(key: string, value: string) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(key, value);
}

export function HomeMemoriesTimelinePanel({
  embedded = false,
  initialProjects,
}: {
  embedded?: boolean;
  initialProjects?: unknown[];
} = {}) {
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement>(null);
  const projectByMemoryItemIdRef = useRef<Map<string, string>>(new Map());
  const lastSigRef = useRef<string>('');

  const [fullScreen, setFullScreen] = useState(false);
  const [sectionExpanded, setSectionExpanded] = useState(() => readLsBool(LS.sectionExpanded, true));
  const [datePreset, setDatePreset] = useState<DateWindowPreset>(
    () => (readLs(LS.datePreset, '90') as DateWindowPreset) || '90',
  );
  const [layout, setLayout] = useState<MemoryTimelineLayout>(() =>
    readLs(LS.layout, 'project') === 'flat' ? 'flat' : 'project',
  );
  const [optionsOpen, setOptionsOpen] = useState(() => readLsBool(LS.optionsOpen, false));

  const [projects, setProjects] = useState<any[]>(() =>
    Array.isArray(initialProjects) ? (initialProjects as any[]) : [],
  );
  const [memories, setMemories] = useState<MemoryRowLike[]>([]);
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    writeLs(LS.sectionExpanded, sectionExpanded ? '1' : '0');
  }, [sectionExpanded]);
  useEffect(() => {
    writeLs(LS.datePreset, datePreset);
  }, [datePreset]);
  useEffect(() => {
    writeLs(LS.layout, layout);
  }, [layout]);
  useEffect(() => {
    writeLs(LS.optionsOpen, optionsOpen ? '1' : '0');
  }, [optionsOpen]);

  useEffect(() => {
    if (!sectionExpanded && fullScreen) setFullScreen(false);
  }, [sectionExpanded, fullScreen]);

  const projectNameByKey = useMemo(() => {
    const m = new Map<string, string>();
    for (const p of projects) {
      const k = p?.key;
      if (typeof k === 'string' && k) m.set(k, typeof p?.name === 'string' && p.name ? p.name : k);
    }
    return m;
  }, [projects]);

  const filteredMemories = useMemo(() => filterMemoriesForTimeline(memories), [memories]);

  const memoryStarts = useMemo(
    () =>
      filteredMemories
        .map((r) => parseMemoryCreatedAt(r))
        .filter((d): d is Date => d != null),
    [filteredMemories],
  );

  const dateWin = useMemo(
    () => memoryTimelineVisibleWindow(datePreset, memoryStarts),
    [datePreset, memoryStarts],
  );

  const { items, groups } = useMemo(
    () => memoriesToVisTimelineData(filteredMemories, projectNameByKey, layout),
    [filteredMemories, projectNameByKey, layout],
  );

  useEffect(() => {
    const m = new Map<string, string>();
    for (const row of filteredMemories) {
      const id = row.id != null ? String(row.id) : '';
      const pk = row.project_key != null ? String(row.project_key).trim() : '';
      if (id && pk) m.set(`mem:${id}`, pk);
    }
    projectByMemoryItemIdRef.current = m;
  }, [filteredMemories]);

  const loadData = useCallback(async () => {
    setLoadErr(null);
    try {
      const [memRows, prows] = await Promise.all([
        listMemory({ projectScopedOnly: true, limit: 300 }),
        listProjects(),
      ]);
      setProjects(Array.isArray(prows) ? prows : []);
      const sig = memoryRowsSignature(memRows as MemoryRowLike[]);
      if (sig !== lastSigRef.current) {
        lastSigRef.current = sig;
        setMemories(memRows as MemoryRowLike[]);
      }
    } catch (e: unknown) {
      lastSigRef.current = '';
      setMemories([]);
      setLoadErr(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    lastSigRef.current = '';
    void loadData();
  }, [loadData]);

  useEffect(() => {
    const t = window.setInterval(() => {
      void loadData();
    }, 4000);
    return () => window.clearInterval(t);
  }, [loadData]);

  const onRefresh = useCallback(() => {
    setLoading(true);
    lastSigRef.current = '';
    void loadData();
  }, [loadData]);

  useEffect(() => {
    const el = containerRef.current;
    if (!sectionExpanded || !el || groups.length === 0) return;

    const itemsDs = new DataSet(items as any);
    const groupsDs = new DataSet(groups as any);
    const options = {
      stack: true,
      orientation: 'top' as const,
      zoomMin: 1000 * 60 * 60 * 2,
      verticalScroll: true,
      maxHeight: fullScreen ? '88vh' : '300px',
      showCurrentTime: true,
      selectable: true,
      multiselect: false,
      editable: false,
    };

    const tl = new Timeline(el, itemsDs as any, groupsDs as any, options);
    tl.setWindow(dateWin.start, dateWin.end);

    const onClick = (props: { item?: string | null }) => {
      const id = props.item;
      if (!id || typeof id !== 'string' || !id.startsWith('mem:')) return;
      const pk = projectByMemoryItemIdRef.current.get(id);
      if (!pk) return;
      const wk = projects.find((p: any) => p.key === pk)?.workspace_key || '';
      const qs = new URLSearchParams();
      qs.set('project', pk);
      if (wk) qs.set('workspace', wk);
      router.push(`/workspaces?${qs.toString()}`);
    };
    tl.on('click', onClick as any);

    return () => {
      tl.destroy();
    };
  }, [sectionExpanded, items, groups, fullScreen, dateWin.start, dateWin.end, router, projects]);

  const topPad = embedded ? 'mt-0' : 'mt-3';
  const panelClass = fullScreen
    ? 'fixed inset-3 z-[60] flex flex-col rounded-lg border border-app-border bg-app-surface p-2 shadow-2xl'
    : `${topPad} flex flex-col rounded-lg border border-app-border bg-app-surface p-2 shadow-xs`;

  const bodyId = 'home-memories-timeline-body';

  return (
    <section className={panelClass}>
      <div className="flex flex-wrap items-start justify-between gap-2 border-b border-app-border pb-2">
        <div>
          <h2 className="text-sm font-semibold text-app-text">Project memories</h2>
          <p className="text-[10px] text-app-muted">
            Scoped memories by <code className="rounded bg-app-fill px-0.5">created_at</code>.{' '}
            <Link href="/memory" className="font-semibold text-cyan-600 hover:underline dark:text-cyan-400">
              Memory
            </Link>{' '}
            for search and ingest.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            className="rounded border border-app-border bg-app-fill px-2 py-0.5 text-[10px] font-semibold text-app-text hover:bg-app-fill-hover disabled:opacity-50"
            onClick={onRefresh}
            disabled={loading}
            aria-label="Reload memories from server"
          >
            Refresh
          </button>
          <button
            type="button"
            className="rounded border border-app-border bg-app-fill px-2 py-0.5 text-[10px] font-semibold text-app-text hover:bg-app-fill-hover"
            onClick={() => setOptionsOpen((o) => !o)}
          >
            {optionsOpen ? 'Hide options' : 'Options'}
          </button>
          <button
            type="button"
            className="rounded border border-app-border bg-app-fill px-2 py-0.5 text-[10px] font-semibold text-app-text hover:bg-app-fill-hover"
            onClick={() => setFullScreen((f) => !f)}
          >
            {fullScreen ? 'Exit full screen' : 'Full screen'}
          </button>
          <button
            type="button"
            className="flex shrink-0 items-center justify-center rounded px-1 py-0.5 text-app-muted hover:bg-app-fill-hover"
            aria-label={sectionExpanded ? 'Collapse memories timeline' : 'Expand memories timeline'}
            aria-expanded={sectionExpanded}
            aria-controls={bodyId}
            onClick={() => setSectionExpanded((v) => !v)}
          >
            <PanelChevron expanded={sectionExpanded} />
          </button>
        </div>
      </div>

      {sectionExpanded ? (
        <div id={bodyId} className="min-w-0">
          {optionsOpen ? (
            <div className="mt-2 grid max-h-40 grid-cols-1 gap-2 overflow-y-auto text-[10px] tablet:grid-cols-2">
              <label className="flex flex-col gap-0.5 text-app-muted">
                Date window (UTC, past-leaning)
                <select
                  value={datePreset}
                  onChange={(e) => setDatePreset(e.target.value as DateWindowPreset)}
                  className="rounded border border-app-border bg-app-canvas p-1 text-app-text"
                >
                  <option value="30">Last 30 days + data extent</option>
                  <option value="90">Last 90 days + data extent</option>
                  <option value="180">Last 180 days + data extent</option>
                  <option value="quarter">This quarter (UTC) + data extent</option>
                  <option value="all">Wide + data extent</option>
                </select>
              </label>
              <label className="flex flex-col gap-0.5 text-app-muted">
                Group by
                <select
                  value={layout}
                  onChange={(e) => setLayout(e.target.value as MemoryTimelineLayout)}
                  className="rounded border border-app-border bg-app-canvas p-1 text-app-text"
                >
                  <option value="project">Project</option>
                  <option value="flat">Flat (single lane)</option>
                </select>
              </label>
            </div>
          ) : null}

          {loadErr ? (
            <p className="mt-2 text-[10px] text-amber-800 dark:text-amber-200">{loadErr}</p>
          ) : null}

          {filteredMemories.length === 0 && !loading ? (
            <p className="mt-2 text-[11px] text-app-muted">
              No project-scoped memories yet. Save lines from Workspaces project items as memory, or widen the date
              window.
            </p>
          ) : (
            <div className="relative mt-2 min-h-[200px] w-full min-w-0 flex-1">
              {loading && !memories.length ? (
                <div
                  className="pointer-events-none absolute inset-0 z-10 animate-pulse rounded bg-app-fill/80"
                  aria-hidden
                />
              ) : null}
              <div ref={containerRef} className="min-h-[200px] w-full min-w-0 overflow-hidden" />
            </div>
          )}
        </div>
      ) : null}
    </section>
  );
}

'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { DataSet } from 'vis-data';
import { Timeline } from 'vis-timeline/standalone';
import 'vis-timeline/styles/vis-timeline-graph2d.min.css';

import { useHolidays } from '../../hooks/useHolidays';
import {
  backgroundItemsForNonWorkingDays,
  dateWindowFromPreset,
  filterGanttRows,
  type DateWindowPreset,
  type GanttGroupBy,
  type GanttRow,
  projectItemsToGanttRows,
  rowsToVis,
} from '../../lib/gantt/ganttModel';
import { getProjectItems, listProjects, listTimelineEvents } from '../../lib/api';
import { PanelChevron } from '../workspaces/PanelChevron';

const LS = {
  sectionExpanded: 'dd.homeGantt.sectionExpanded',
  mode: 'dd.homeGantt.mode',
  projectKey: 'dd.homeGantt.projectKey',
  workspaceKey: 'dd.homeGantt.workspaceKey',
  datePreset: 'dd.homeGantt.datePreset',
  groupBy: 'dd.homeGantt.groupBy',
  milestonesOnly: 'dd.homeGantt.milestonesOnly',
  search: 'dd.homeGantt.search',
  showResolved: 'dd.homeGantt.showResolved',
  workingShade: 'dd.homeGantt.workingShade',
  stack: 'dd.homeGantt.stack',
  notesTooltip: 'dd.homeGantt.notesTooltip',
  optionsOpen: 'dd.homeGantt.optionsOpen',
} as const;

type Mode = 'single' | 'overview';

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

/** Cheap equality check to skip redundant `setRawRows` when the API returns unchanged data. */
function timelineRowsSignature(rows: GanttRow[]): string {
  const slim = rows
    .map((r) => ({
      id: r.id,
      s: r.start_date_iso,
      e: r.end_date_iso,
      st: r.status ?? '',
      ph: r.phase_id ?? '',
      t: r.title,
    }))
    .sort((a, b) => a.id.localeCompare(b.id));
  return JSON.stringify(slim);
}

export function HomeGanttPanel({
  embedded = false,
  initialProjects,
}: {
  embedded?: boolean;
  initialProjects?: unknown[];
} = {}) {
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement>(null);
  const rowsRef = useRef<Map<string, GanttRow>>(new Map());

  const [mode, setMode] = useState<Mode>(() => (readLs(LS.mode, 'single') === 'overview' ? 'overview' : 'single'));
  const [projectKey, setProjectKey] = useState(() => readLs(LS.projectKey, ''));
  const [workspaceKey, setWorkspaceKey] = useState(() => readLs(LS.workspaceKey, ''));
  const [datePreset, setDatePreset] = useState<DateWindowPreset>(
    () => (readLs(LS.datePreset, '90') as DateWindowPreset) || '90',
  );
  const [groupBy, setGroupBy] = useState<GanttGroupBy>(() => {
    const m0 = readLs(LS.mode, 'single');
    const g = readLs(LS.groupBy, '') as GanttGroupBy;
    if (g === 'phase_kind' || g === 'phase' || g === 'project' || g === 'flat') {
      if (m0 === 'overview' && g === 'phase_kind') return 'project';
      return g;
    }
    return m0 === 'overview' ? 'project' : 'phase_kind';
  });
  const [milestonesOnly, setMilestonesOnly] = useState(() => readLsBool(LS.milestonesOnly, false));
  const [search, setSearch] = useState(() => readLs(LS.search, ''));
  const [showResolved, setShowResolved] = useState(() => readLsBool(LS.showResolved, false));
  const [workingShade, setWorkingShade] = useState(() => readLsBool(LS.workingShade, true));
  const [stack, setStack] = useState(() => readLsBool(LS.stack, true));
  const [notesTooltip, setNotesTooltip] = useState(() => readLsBool(LS.notesTooltip, true));
  const [optionsOpen, setOptionsOpen] = useState(() => readLsBool(LS.optionsOpen, false));
  const [fullScreen, setFullScreen] = useState(false);
  const [sectionExpanded, setSectionExpanded] = useState(() => readLsBool(LS.sectionExpanded, true));

  const [projects, setProjects] = useState<any[]>(() =>
    Array.isArray(initialProjects) ? (initialProjects as any[]) : [],
  );
  const projectsSsrConsumed = useRef(false);
  const [rawRows, setRawRows] = useState<GanttRow[]>([]);
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const lastRowsSigRef = useRef<string>('');

  const dateWin = useMemo(() => dateWindowFromPreset(datePreset), [datePreset]);

  const holFrom = useMemo(() => {
    const y = dateWin.start.getUTCFullYear();
    const m = String(dateWin.start.getUTCMonth() + 1).padStart(2, '0');
    const d = String(dateWin.start.getUTCDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }, [dateWin.start]);
  const holTo = useMemo(() => {
    const y = dateWin.end.getUTCFullYear();
    const m = String(dateWin.end.getUTCMonth() + 1).padStart(2, '0');
    const d = String(dateWin.end.getUTCDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }, [dateWin.end]);
  const { holidaySet } = useHolidays(holFrom, holTo);

  const workspaceKeys = useMemo(() => {
    const s = new Set<string>();
    for (const p of projects) {
      const wk = p?.workspace_key;
      if (typeof wk === 'string' && wk) s.add(wk);
    }
    return Array.from(s).sort();
  }, [projects]);

  const effectiveGroupBy = groupBy;

  const filteredRows = useMemo(
    () =>
      filterGanttRows(rawRows, {
        milestonesOnly,
        search,
        showResolved,
        window: dateWin,
      }),
    [rawRows, milestonesOnly, search, showResolved, dateWin],
  );

  const { items: mainItems, groups } = useMemo(
    () => rowsToVis(filteredRows, effectiveGroupBy, { includeNotesInTitle: notesTooltip }),
    [filteredRows, effectiveGroupBy, notesTooltip],
  );

  const mergedItems = useMemo(() => {
    if (!workingShade || groups.length === 0) return mainItems;
    const gids = groups.map((g) => g.id);
    const bg = backgroundItemsForNonWorkingDays(gids, dateWin.start, dateWin.end, holidaySet);
    return [...mainItems, ...bg];
  }, [workingShade, groups, mainItems, dateWin, holidaySet]);

  useEffect(() => {
    writeLs(LS.mode, mode);
  }, [mode]);
  useEffect(() => {
    writeLs(LS.projectKey, projectKey);
  }, [projectKey]);
  useEffect(() => {
    writeLs(LS.workspaceKey, workspaceKey);
  }, [workspaceKey]);
  useEffect(() => {
    writeLs(LS.datePreset, datePreset);
  }, [datePreset]);
  useEffect(() => {
    writeLs(LS.groupBy, groupBy);
  }, [groupBy]);
  useEffect(() => {
    writeLs(LS.milestonesOnly, milestonesOnly ? '1' : '0');
  }, [milestonesOnly]);
  useEffect(() => {
    writeLs(LS.search, search);
  }, [search]);
  useEffect(() => {
    writeLs(LS.showResolved, showResolved ? '1' : '0');
  }, [showResolved]);
  useEffect(() => {
    writeLs(LS.workingShade, workingShade ? '1' : '0');
  }, [workingShade]);
  useEffect(() => {
    writeLs(LS.stack, stack ? '1' : '0');
  }, [stack]);
  useEffect(() => {
    writeLs(LS.notesTooltip, notesTooltip ? '1' : '0');
  }, [notesTooltip]);
  useEffect(() => {
    writeLs(LS.optionsOpen, optionsOpen ? '1' : '0');
  }, [optionsOpen]);
  useEffect(() => {
    writeLs(LS.sectionExpanded, sectionExpanded ? '1' : '0');
  }, [sectionExpanded]);

  useEffect(() => {
    if (!sectionExpanded && fullScreen) setFullScreen(false);
  }, [sectionExpanded, fullScreen]);

  const loadProjects = useCallback(async () => {
    try {
      if (!projectsSsrConsumed.current && initialProjects !== undefined) {
        projectsSsrConsumed.current = true;
        const rows = Array.isArray(initialProjects) ? (initialProjects as any[]) : [];
        if (rows.length > 0) {
          setProjects(rows);
          setProjectKey((prev) => {
            const keys = rows.map((p) => p.key);
            if (prev && keys.includes(prev)) return prev;
            const saved = readLs(LS.projectKey, '');
            if (saved && keys.includes(saved)) return saved;
            return keys[0] || '';
          });
          return;
        }
      }
      const rows = await listProjects();
      setProjects(Array.isArray(rows) ? rows : []);
      setProjectKey((prev) => {
        const keys = (rows as any[]).map((p) => p.key);
        if (prev && keys.includes(prev)) return prev;
        const saved = readLs(LS.projectKey, '');
        if (saved && keys.includes(saved)) return saved;
        return keys[0] || '';
      });
    } catch {
      setProjects([]);
    }
  }, [initialProjects]);

  const loadTimelineData = useCallback(async () => {
    setLoadErr(null);
    try {
      if (mode === 'single') {
        const pk = projectKey;
        if (!pk) {
          lastRowsSigRef.current = '';
          setRawRows([]);
          setLoading(false);
          return;
        }
        const items = await getProjectItems(pk);
        const rows = projectItemsToGanttRows(
          (Array.isArray(items) ? items : []).map((it: any) => ({ ...it, project_key: it.project_key ?? pk })),
        );
        const sig = timelineRowsSignature(rows);
        if (sig !== lastRowsSigRef.current) {
          lastRowsSigRef.current = sig;
          setRawRows(rows);
        }
      } else {
        const rows = projectItemsToGanttRows(
          await listTimelineEvents(workspaceKey || undefined),
        );
        const sig = timelineRowsSignature(rows);
        if (sig !== lastRowsSigRef.current) {
          lastRowsSigRef.current = sig;
          setRawRows(rows);
        }
      }
    } catch (e: unknown) {
      lastRowsSigRef.current = '';
      setRawRows([]);
      setLoadErr(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [mode, projectKey, workspaceKey]);

  useEffect(() => {
    void loadProjects();
  }, [loadProjects]);

  useEffect(() => {
    setLoading(true);
    lastRowsSigRef.current = '';
    void loadTimelineData();
  }, [loadTimelineData]);

  const onRefresh = useCallback(() => {
    setLoading(true);
    lastRowsSigRef.current = '';
    void loadTimelineData();
  }, [loadTimelineData]);

  useEffect(() => {
    const m = new Map<string, GanttRow>();
    for (const r of filteredRows) m.set(r.id, r);
    rowsRef.current = m;
  }, [filteredRows]);

  useEffect(() => {
    const el = containerRef.current;
    if (!sectionExpanded || !el || groups.length === 0) return;

    const itemsDs = new DataSet(mergedItems as any);
    const groupsDs = new DataSet(groups as any);
    const options = {
      stack,
      orientation: 'top' as const,
      zoomMin: 1000 * 60 * 60 * 6,
      verticalScroll: true,
      maxHeight: fullScreen ? '88vh' : '320px',
      showCurrentTime: true,
      selectable: true,
      multiselect: false,
      editable: false,
    };

    const tl = new Timeline(el, itemsDs as any, groupsDs as any, options);
    tl.setWindow(dateWin.start, dateWin.end);

    const onClick = (props: { item?: string | null }) => {
      const id = props.item;
      if (!id || typeof id !== 'string' || id.startsWith('nw:')) return;
      const rowId = id.startsWith('it:') ? id.slice(3) : id;
      const row = rowsRef.current.get(rowId);
      const pk = row?.project_key || projectKey;
      const wk = row?.workspace_key || projects.find((p: any) => p.key === pk)?.workspace_key || '';
      if (pk) {
        const qs = new URLSearchParams();
        qs.set('project', pk);
        if (wk) qs.set('workspace', wk);
        router.push(`/workspaces?${qs.toString()}`);
      }
    };
    tl.on('click', onClick as any);

    return () => {
      tl.destroy();
    };
  }, [sectionExpanded, mergedItems, groups, stack, fullScreen, dateWin.start, dateWin.end, router, projectKey]);

  const topPad = embedded ? 'mt-0' : 'mt-3';
  const panelClass = fullScreen
    ? 'fixed inset-3 z-[60] flex flex-col rounded-lg border border-app-border bg-app-surface p-2 shadow-2xl'
    : `${topPad} flex flex-col rounded-lg border border-app-border bg-app-surface p-2 shadow-xs`;

  const ganttBodyId = 'home-gantt-panel-body';

  return (
    <section className={panelClass}>
      <div className="flex flex-wrap items-start justify-between gap-2 border-b border-app-border pb-2">
        <div>
          <h2 className="text-sm font-semibold text-app-text">Delivery timeline (Gantt)</h2>
          <p className="text-[10px] text-app-muted">
            From ingested <code className="rounded bg-app-fill px-0.5">timeline_event</code> items.{' '}
            <Link href="/workspaces" className="font-semibold text-cyan-600 hover:underline dark:text-cyan-400">
              Workspaces
            </Link>{' '}
            to add or edit projects.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            className="rounded border border-app-border bg-app-fill px-2 py-0.5 text-[10px] font-semibold text-app-text hover:bg-app-fill-hover disabled:opacity-50"
            onClick={onRefresh}
            disabled={loading}
            aria-label="Reload timeline from server"
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
            aria-label={sectionExpanded ? 'Collapse delivery timeline' : 'Expand delivery timeline'}
            aria-expanded={sectionExpanded}
            aria-controls={ganttBodyId}
            onClick={() => setSectionExpanded((v) => !v)}
          >
            <PanelChevron expanded={sectionExpanded} />
          </button>
        </div>
      </div>

      {sectionExpanded ? (
        <div id={ganttBodyId} className="min-w-0">
          {optionsOpen ? (
        <div className="mt-2 grid max-h-48 grid-cols-1 gap-2 overflow-y-auto text-[10px] tablet:grid-cols-2 desktop:grid-cols-3">
          <label className="flex flex-col gap-0.5 text-app-muted">
            Mode
            <select
              value={mode}
              onChange={(e) => {
                const m = e.target.value as Mode;
                setMode(m);
                if (m === 'overview') setGroupBy('project');
                else setGroupBy('phase_kind');
              }}
              className="rounded border border-app-border bg-app-canvas p-1 text-app-text"
            >
              <option value="single">Single project</option>
              <option value="overview">Overview (all projects)</option>
            </select>
          </label>
          {mode === 'single' ? (
            <label className="flex flex-col gap-0.5 text-app-muted">
              Project
              <select
                value={projectKey}
                onChange={(e) => setProjectKey(e.target.value)}
                className="rounded border border-app-border bg-app-canvas p-1 text-app-text"
              >
                <option value="">—</option>
                {projects.map((p: any) => (
                  <option key={p.key} value={p.key}>
                    {p.name || p.key} ({p.key})
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <label className="flex flex-col gap-0.5 text-app-muted">
              Workspace filter
              <select
                value={workspaceKey}
                onChange={(e) => setWorkspaceKey(e.target.value)}
                className="rounded border border-app-border bg-app-canvas p-1 text-app-text"
              >
                <option value="">All workspaces</option>
                {workspaceKeys.map((wk) => (
                  <option key={wk} value={wk}>
                    {wk}
                  </option>
                ))}
              </select>
            </label>
          )}
          <label className="flex flex-col gap-0.5 text-app-muted">
            Date window
            <select
              value={datePreset}
              onChange={(e) => setDatePreset(e.target.value as DateWindowPreset)}
              className="rounded border border-app-border bg-app-canvas p-1 text-app-text"
            >
              <option value="30">Next 30 days</option>
              <option value="90">Next 90 days</option>
              <option value="180">Next 180 days</option>
              <option value="quarter">This quarter (UTC)</option>
              <option value="all">All (wide)</option>
            </select>
          </label>
          <label className="flex flex-col gap-0.5 text-app-muted">
            Group by
            <select
              value={effectiveGroupBy}
              onChange={(e) => setGroupBy(e.target.value as GanttGroupBy)}
              className="rounded border border-app-border bg-app-canvas p-1 text-app-text"
            >
              <option value="phase_kind">Phase kind (milestones)</option>
              <option value="phase">Phase id</option>
              <option value="project">Project</option>
              <option value="flat">Flat (single lane)</option>
            </select>
          </label>
          <label className="flex flex-col gap-0.5 text-app-muted">
            Search title / notes
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="rounded border border-app-border bg-app-canvas p-1 text-app-text"
              placeholder="Substring…"
            />
          </label>
          <label className="inline-flex items-center gap-1.5 text-app-muted">
            <input type="checkbox" checked={milestonesOnly} onChange={(e) => setMilestonesOnly(e.target.checked)} />
            Milestones only
          </label>
          <label className="inline-flex items-center gap-1.5 text-app-muted">
            <input type="checkbox" checked={showResolved} onChange={(e) => setShowResolved(e.target.checked)} />
            Show resolved
          </label>
          <label className="inline-flex items-center gap-1.5 text-app-muted">
            <input type="checkbox" checked={workingShade} onChange={(e) => setWorkingShade(e.target.checked)} />
            Working-day shading
          </label>
          <label className="inline-flex items-center gap-1.5 text-app-muted">
            <input type="checkbox" checked={stack} onChange={(e) => setStack(e.target.checked)} />
            Stack overlaps
          </label>
          <label className="inline-flex items-center gap-1.5 text-app-muted">
            <input type="checkbox" checked={notesTooltip} onChange={(e) => setNotesTooltip(e.target.checked)} />
            Notes in tooltips
          </label>
        </div>
          ) : null}

          {loadErr ? (
            <p className="mt-2 text-[10px] text-amber-800 dark:text-amber-200">{loadErr}</p>
          ) : null}

          {filteredRows.length === 0 && !loading ? (
            <p className="mt-2 text-[11px] text-app-muted">
              No timeline rows in this window. Upload a timeline document in Workspaces or widen the date window.
            </p>
          ) : (
            <div className="relative mt-2 min-h-[200px] w-full min-w-0 flex-1">
              {loading && !rawRows.length ? (
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

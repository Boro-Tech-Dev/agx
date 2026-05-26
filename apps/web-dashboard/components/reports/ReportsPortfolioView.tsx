'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { getHierarchyTree, listPortfolioItems } from '../../lib/api';
import { toolRouteHref } from '../../lib/toolCatalog';
import { displayItemTypeLabel, isPersonalPm } from '../../lib/pmMode';
import { itemTypePill, priorityChip, statusChip } from '../../lib/workspaces/chips';
import { projectItemPrimary, projectItemSecondary } from '../../lib/workspaces/projectItems';

type PortfolioRow = Record<string, unknown> & {
  id?: string;
  item_type?: string;
  project_key?: string;
  project_name?: string;
  workspace_key?: string;
  client_key?: string;
  brand_key?: string;
  project_pm_kind?: string | null;
  source_run_id?: string | null;
  created_at?: string | null;
};

function workspacesDeepLink(projectKey: string, workspaceKey: string): string {
  const q = new URLSearchParams();
  q.set('project', projectKey);
  if (workspaceKey) q.set('workspace', workspaceKey);
  return `/workspaces?${q.toString()}`;
}

function hottestProject(rows: PortfolioRow[]): { key: string; name: string; n: number } | null {
  const counts = new Map<string, { name: string; n: number }>();
  for (const r of rows) {
    const k = String(r.project_key || '');
    if (!k) continue;
    const name = String(r.project_name || k);
    const cur = counts.get(k);
    if (cur) cur.n += 1;
    else counts.set(k, { name, n: 1 });
  }
  let best: { key: string; name: string; n: number } | null = null;
  for (const [key, v] of Array.from(counts.entries())) {
    if (!best || v.n > best.n) best = { key, name: v.name, n: v.n };
  }
  return best;
}

function LaneCard({
  title,
  subtitle,
  borderClass,
  headerTint,
  children,
}: {
  title: string;
  subtitle: string;
  borderClass: string;
  headerTint: string;
  children: ReactNode;
}) {
  return (
    <section
      className={`flex min-h-[12rem] flex-col rounded-lg border border-app-border bg-app-surface shadow-xs ${borderClass}`}
    >
      <div className={`border-b border-app-border px-2.5 py-2 ${headerTint}`}>
        <h2 className="text-[12px] font-bold tracking-tight text-app-text">{title}</h2>
        <p className="text-[9px] leading-snug text-app-muted">{subtitle}</p>
      </div>
      <div className="flex flex-1 flex-col gap-1.5 p-2">{children}</div>
    </section>
  );
}

function PortfolioRowCard({ row }: { row: PortfolioRow }) {
  const personalPm = isPersonalPm({ pm_kind: row.project_pm_kind });
  const primary = projectItemPrimary(row);
  const secondary = projectItemSecondary(row, primary);
  const pk = String(row.project_key || '');
  const wk = String(row.workspace_key || '');
  const runId = row.source_run_id ? String(row.source_run_id) : '';

  return (
    <article className="rounded-md border border-app-border bg-app-fill/80 p-2 text-[10px] shadow-inner">
      <div className="flex flex-wrap items-center gap-1">
        <span
          className={`inline-block rounded px-1 py-0.5 text-[9px] font-semibold capitalize ${itemTypePill(row.item_type)}`}
        >
          {displayItemTypeLabel(row.item_type, personalPm)}
        </span>
        <span className={`rounded px-1 py-0.5 text-[9px] font-semibold ${priorityChip(String(row.priority ?? ''))}`}>
          {String(row.priority ?? '—')}
        </span>
        <span className={`rounded px-1 py-0.5 text-[9px] font-semibold ${statusChip(String(row.status ?? ''))}`}>
          {String(row.status ?? '—')}
        </span>
      </div>
      <div className="mt-1 font-semibold leading-snug text-app-text">{primary}</div>
      {secondary ? <div className="mt-0.5 line-clamp-4 text-[9px] leading-snug text-app-muted">{secondary}</div> : null}
      <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[9px] text-app-muted">
        <span className="font-medium text-app-text">{String(row.project_name || pk)}</span>
        <span className="text-app-muted">·</span>
        <span className="font-mono">{wk || '—'}</span>
      </div>
      <div className="mt-1.5 flex flex-wrap gap-2">
        {pk ? (
          <Link
            href={workspacesDeepLink(pk, wk)}
            className="font-semibold text-cyan-700 hover:text-cyan-900 hover:underline dark:text-cyan-400 dark:hover:text-cyan-200"
          >
            Open project
          </Link>
        ) : null}
        {runId ? (
          <a href={`/runs/${runId}`} className="font-semibold text-violet-700 hover:underline dark:text-violet-400">
            Run
          </a>
        ) : null}
      </div>
    </article>
  );
}

export function ReportsPortfolioView() {
  const [rows, setRows] = useState<PortfolioRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [workspaceKeys, setWorkspaceKeys] = useState<string[]>([]);
  const [workspaceFilter, setWorkspaceFilter] = useState('');

  const loadTree = useCallback(async () => {
    try {
      const t = await getHierarchyTree();
      const keys = (t.workspaces || [])
        .map((w: { workspace?: { key?: string } }) => w.workspace?.key)
        .filter((k: string | undefined): k is string => Boolean(k));
      setWorkspaceKeys(keys);
    } catch {
      setWorkspaceKeys([]);
    }
  }, []);

  const loadPortfolio = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const data = await listPortfolioItems({
        workspaceKey: workspaceFilter || undefined,
        limit: 2000,
      });
      setRows(Array.isArray(data) ? (data as PortfolioRow[]) : []);
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : String(e));
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [workspaceFilter]);

  useEffect(() => {
    void loadTree();
  }, [loadTree]);

  useEffect(() => {
    void loadPortfolio();
  }, [loadPortfolio]);

  const { anomalies, risks, costs } = useMemo(() => {
    const anomalies: PortfolioRow[] = [];
    const risks: PortfolioRow[] = [];
    const costs: PortfolioRow[] = [];
    for (const r of rows) {
      const t = String(r.item_type || '').toLowerCase();
      if (t === 'anomaly') anomalies.push(r);
      else if (t === 'risk') risks.push(r);
      else if (t === 'cost') costs.push(r);
    }
    return { anomalies, risks, costs };
  }, [rows]);

  const hot = useMemo(() => hottestProject(rows), [rows]);

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-2 tablet:flex-row tablet:items-end tablet:justify-between">
        <div className="min-w-0">
          <label className="text-[9px] font-semibold uppercase tracking-wide text-app-muted">Workspace</label>
          <select
            value={workspaceFilter}
            onChange={(e) => setWorkspaceFilter(e.target.value)}
            className="mt-0.5 block w-full max-w-xs rounded-md border border-app-border bg-app-surface px-2 py-1 text-[11px] text-app-text tablet:w-auto"
          >
            <option value="">All workspaces</option>
            {workspaceKeys.map((k) => (
              <option key={k} value={k}>
                {k}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href={toolRouteHref('learning', 'team')}
            className="rounded-md border border-teal-500/30 bg-teal-500/10 px-2.5 py-1 text-[11px] font-semibold text-teal-900 hover:bg-teal-500/20 dark:text-teal-100"
          >
            Learning team progress
          </Link>
          <button
            type="button"
            onClick={() => void loadPortfolio()}
            className="rounded-md border border-app-border bg-app-fill px-2.5 py-1 text-[11px] font-semibold text-app-text hover:bg-app-fill/80"
          >
            Refresh
          </button>
        </div>
      </div>

      {err ? (
        <div className="rounded-lg border border-rose-200 bg-rose-50 p-2.5 text-[11px] text-rose-900 dark:border-rose-500/35 dark:bg-rose-500/10 dark:text-rose-100">
          {err}
        </div>
      ) : null}

      {loading ? (
        <p className="text-[12px] text-app-muted">Loading portfolio signals…</p>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-2 tablet:grid-cols-3">
            <div className="rounded-lg border border-amber-300/60 bg-amber-50/90 p-2.5 dark:border-amber-500/30 dark:bg-amber-500/10">
              <div className="text-[9px] font-semibold uppercase tracking-wide text-amber-900 dark:text-amber-200">
                Anomalies
              </div>
              <div className="mt-0.5 text-2xl font-bold tabular-nums text-app-text">{anomalies.length}</div>
              <p className="mt-0.5 text-[9px] text-app-muted">Unexpected drift or inconsistencies.</p>
            </div>
            <div className="rounded-lg border border-rose-300/60 bg-rose-50/90 p-2.5 dark:border-rose-500/30 dark:bg-rose-500/10">
              <div className="text-[9px] font-semibold uppercase tracking-wide text-rose-900 dark:text-rose-200">Risks</div>
              <div className="mt-0.5 text-2xl font-bold tabular-nums text-app-text">{risks.length}</div>
              <p className="mt-0.5 text-[9px] text-app-muted">Impact and likelihood from structured PM output.</p>
            </div>
            <div className="rounded-lg border border-teal-300/60 bg-teal-50/90 p-2.5 dark:border-teal-500/30 dark:bg-teal-500/10">
              <div className="text-[9px] font-semibold uppercase tracking-wide text-teal-900 dark:text-teal-200">Costs</div>
              <div className="mt-0.5 text-2xl font-bold tabular-nums text-app-text">{costs.length}</div>
              <p className="mt-0.5 text-[9px] text-app-muted">Spend signals captured from runs.</p>
            </div>
          </div>

          {hot && rows.length > 0 ? (
            <div className="rounded-lg border border-app-border bg-app-fill/80 px-2.5 py-2 text-[11px]">
              <span className="font-semibold text-app-text">Most signals: </span>
              <Link
                href={workspacesDeepLink(hot.key, rows.find((r) => r.project_key === hot.key)?.workspace_key as string)}
                className="text-cyan-700 hover:underline dark:text-cyan-400"
              >
                {hot.name}
              </Link>
              <span className="text-app-muted"> ({hot.n} items)</span>
            </div>
          ) : null}

          <div className="grid grid-cols-1 gap-2 desktop:grid-cols-3">
            <LaneCard
              title="Anomalies"
              subtitle="Things that do not match the plan or baseline."
              borderClass="border-l-4 border-l-amber-500"
              headerTint="bg-amber-50/80 dark:bg-amber-500/10"
            >
              {anomalies.length === 0 ? (
                <p className="text-[11px] text-app-muted">No anomalies in this view — portfolio looks steady.</p>
              ) : (
                anomalies.map((r) => <PortfolioRowCard key={String(r.id)} row={r} />)
              )}
            </LaneCard>
            <LaneCard
              title="Risks"
              subtitle="Threats to schedule, scope, or outcomes."
              borderClass="border-l-4 border-l-rose-500"
              headerTint="bg-rose-50/80 dark:bg-rose-500/10"
            >
              {risks.length === 0 ? (
                <p className="text-[11px] text-app-muted">No risks recorded — or filter to another workspace.</p>
              ) : (
                risks.map((r) => <PortfolioRowCard key={String(r.id)} row={r} />)
              )}
            </LaneCard>
            <LaneCard
              title="Costs"
              subtitle="Budget lines and cost drivers from agent analysis."
              borderClass="border-l-4 border-l-teal-600"
              headerTint="bg-teal-50/80 dark:bg-teal-500/10"
            >
              {costs.length === 0 ? (
                <p className="text-[11px] text-app-muted">No cost items yet — costs appear after PM runs persist them.</p>
              ) : (
                costs.map((r) => <PortfolioRowCard key={String(r.id)} row={r} />)
              )}
            </LaneCard>
          </div>
        </>
      )}
    </div>
  );
}

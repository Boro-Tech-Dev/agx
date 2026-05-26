'use client';

import { useCallback, useRef, useState } from 'react';

import { pullModelStream } from '../../lib/api';
import { getModelCatalogEntry } from '../../lib/modelCatalog';
import {
  agentsUsingModel,
  deriveTileState,
  modelFamilyClasses,
  type RequiredModelRow,
} from '../../lib/modelStatusTypes';
import { CatalogDetailSection } from './CatalogDetailSection';

type Props = {
  row: RequiredModelRow;
  routes: Record<string, string>;
  embedModel: string;
  ollamaReachable: boolean;
  pullEnabled: boolean;
  onRefresh: () => Promise<void>;
};

function stateLabel(state: ReturnType<typeof deriveTileState>): string {
  switch (state) {
    case 'ready':
      return 'Ready';
    case 'missing':
      return 'Missing';
    case 'probe_failed':
      return 'Probe failed';
    default:
      return 'Unknown';
  }
}

function stateDotClass(state: ReturnType<typeof deriveTileState>): string {
  switch (state) {
    case 'ready':
      return 'bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.6)]';
    case 'missing':
      return 'bg-amber-400 shadow-[0_0_10px_rgba(251,191,36,0.45)] motion-safe:animate-pulse';
    case 'probe_failed':
      return 'bg-rose-400 shadow-[0_0_10px_rgba(251,113,133,0.5)]';
    default:
      return 'bg-slate-400';
  }
}

export function ModelTile({ row, routes, embedModel, ollamaReachable, pullEnabled, onRefresh }: Props) {
  const state = deriveTileState(row);
  const fam = modelFamilyClasses(row.id);
  const catalog = getModelCatalogEntry(row.id);
  const agents = agentsUsingModel(routes, row.id);
  const isEmbed = row.id === embedModel;
  const [pullBusy, setPullBusy] = useState(false);
  const [pullLine, setPullLine] = useState<string | null>(null);
  const [pullFrac, setPullFrac] = useState<number | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const handlePull = useCallback(async () => {
    if (!pullEnabled || !ollamaReachable || pullBusy) return;
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;
    setPullBusy(true);
    setPullLine('Connecting…');
    setPullFrac(null);
    try {
      await pullModelStream(
        row.id,
        (ev) => {
          if (ev.status) setPullLine(ev.status);
          if (ev.completed != null && ev.total != null && ev.total > 0) {
            setPullFrac(Math.min(1, Math.max(0, ev.completed / ev.total)));
          }
          if (ev.error) setPullLine(ev.error);
        },
        ac.signal,
      );
      setPullLine('Done');
      await onRefresh();
    } catch (e) {
      if ((e as Error)?.name === 'AbortError') {
        setPullLine('Cancelled');
      } else {
        const msg = e instanceof Error ? e.message : String(e);
        setPullLine(msg);
      }
    } finally {
      setPullBusy(false);
      abortRef.current = null;
    }
  }, [onRefresh, ollamaReachable, pullBusy, pullEnabled, row.id]);

  const showPull = state === 'missing' && pullEnabled && ollamaReachable;

  return (
    <div
      className={`group relative overflow-hidden rounded-xl border border-app-border bg-gradient-to-br ${fam.glow} to-app-surface p-4 shadow-xs ring-1 ring-inset ring-transparent transition-[box-shadow,ring-color] ${fam.ring}`}
    >
      <div className={`pointer-events-none absolute right-3 top-3 h-2 w-2 rounded-full ${stateDotClass(state)}`} />
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 pr-6">
        <div className="min-w-0 shrink font-mono text-[13px] font-semibold tracking-tight text-app-text">{row.id}</div>
        <div className="flex flex-wrap items-center gap-1.5">
          <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${fam.chip}`}>
            {isEmbed ? 'Embedding' : 'Chat / LLM'}
          </span>
          <span className="rounded bg-app-fill px-1.5 py-0.5 text-[10px] font-medium text-app-muted">{row.backend}</span>
          <span
            className={`rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
              state === 'ready'
                ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-200'
                : state === 'missing'
                  ? 'bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-200'
                  : 'bg-rose-100 text-rose-800 dark:bg-rose-500/20 dark:text-rose-200'
            }`}
          >
            {stateLabel(state)}
          </span>
        </div>
        {agents.length > 0 ? (
          <span className="min-w-0 text-[11px] text-app-muted">
            <span className="font-medium text-app-text">Agents</span>
            <span className="ml-1 font-mono text-app-muted">{agents.join(', ')}</span>
          </span>
        ) : null}
      </div>

      {catalog ? <CatalogDetailSection catalog={catalog} /> : null}

      {state === 'probe_failed' && row.run_error ? (
        <p className="mt-2 line-clamp-3 rounded-md bg-rose-50 p-2 text-[11px] leading-snug text-rose-800 dark:bg-rose-500/10 dark:text-rose-200">
          {row.run_error}
        </p>
      ) : null}

      {showPull ? (
        <div className="mt-3 space-y-2">
          <button
            type="button"
            disabled={pullBusy}
            onClick={() => void handlePull()}
            className="w-full rounded-lg bg-sky-600 px-3 py-1.5 text-[12px] font-semibold text-white shadow hover:bg-sky-500 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {pullBusy ? 'Pulling…' : 'Pull model'}
          </button>
          {pullBusy || pullLine ? (
            <div className="space-y-1">
              {pullFrac != null ? (
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-app-fill">
                  <div
                    className="h-full rounded-full bg-sky-400 transition-[width] duration-300"
                    style={{ width: `${Math.round(pullFrac * 100)}%` }}
                  />
                </div>
              ) : pullBusy ? (
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-app-fill">
                  <div className="h-full w-2/5 rounded-full bg-sky-500/70 motion-safe:animate-pulse" />
                </div>
              ) : null}
              {pullLine ? <p className="font-mono text-[10px] text-app-muted">{pullLine}</p> : null}
            </div>
          ) : null}
        </div>
      ) : null}

      {!pullEnabled && state === 'missing' ? (
        <p className="mt-2 text-[10px] text-app-muted">In-dashboard pull is disabled (server).</p>
      ) : null}
    </div>
  );
}

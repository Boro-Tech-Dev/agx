'use client';

import { useCallback, useRef, useState } from 'react';

import { pullModelStream } from '../../lib/api';
import type { EmbedderCatalogRow, ModelOverviewPayload } from '../../lib/modelOverviewTypes';
import { getEmbedderCatalogEntry } from '../../lib/retrievalCatalog';
import {
  agentsByEmbedder,
  deriveEmbedderTileState,
  embedderBadgeClass,
  embedderPullTag,
  embedderStateDotClass,
  embedderStateLabel,
  isEmbedderModelMissing,
  retrievalFamilyClasses,
} from '../../lib/retrievalTileState';
import { CatalogDetailSection } from './CatalogDetailSection';

type Props = {
  embedder: EmbedderCatalogRow;
  overview: ModelOverviewPayload;
  agents: string[];
  onRefresh: () => Promise<void>;
};

export function EmbedderTile({ embedder, overview, agents, onRefresh }: Props) {
  const state = deriveEmbedderTileState(embedder, overview);
  const fam = retrievalFamilyClasses(embedder.embedder_id, 'embedder');
  const catalog = getEmbedderCatalogEntry(embedder.embedder_id);
  const tag = embedderPullTag(embedder);
  const missing = overview.retrieval.missing_embeddings[embedder.embedder_id] ?? 0;

  const ollamaReachable = overview.ollama.backends.ollama?.reachable === true;
  const pullEnabled = overview.ollama.features.ollama_pull_enabled !== false;
  const modelMissing = isEmbedderModelMissing(embedder, overview);

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
        tag,
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
  }, [onRefresh, ollamaReachable, pullBusy, pullEnabled, tag]);

  const showPull = modelMissing && pullEnabled && ollamaReachable;

  return (
    <div
      className={`group relative overflow-hidden rounded-xl border border-app-border bg-gradient-to-br ${fam.glow} to-app-surface p-4 shadow-xs ring-1 ring-inset ring-transparent transition-[box-shadow,ring-color] ${fam.ring}`}
    >
      <div className={`pointer-events-none absolute right-3 top-3 h-2 w-2 rounded-full ${embedderStateDotClass(state)}`} />
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 pr-6">
        <div className="min-w-0 shrink font-mono text-[13px] font-semibold tracking-tight text-app-text">
          {embedder.embedder_id}
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${fam.chip}`}>Embedding</span>
          <span className="rounded bg-app-fill px-1.5 py-0.5 text-[10px] font-medium text-app-muted tabular-nums">
            {embedder.dim}d
          </span>
          <span className="rounded bg-app-fill px-1.5 py-0.5 text-[10px] font-medium text-app-muted">
            {embedder.backend ?? 'ollama'}
          </span>
          <span
            className={`rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${embedderBadgeClass(state)}`}
          >
            {embedderStateLabel(state)}
          </span>
        </div>
        {agents.length > 0 ? (
          <span className="min-w-0 text-[11px] text-app-muted">
            <span className="font-medium text-app-text">Agents</span>
            <span className="ml-1 font-mono text-app-muted">{agents.join(', ')}</span>
          </span>
        ) : null}
      </div>

      <div className="mt-2 space-y-0.5 text-[11px] text-app-muted">
        <p>
          <span className="font-medium text-app-text">Ollama tag</span>{' '}
          <span className="font-mono">{tag}</span>
        </p>
        {missing > 0 ? (
          <p className="text-amber-700 dark:text-amber-300">
            Missing {missing} embedding{missing === 1 ? '' : 's'}
          </p>
        ) : null}
        {embedder.display_name && embedder.display_name !== embedder.embedder_id ? (
          <p className="text-[10px]">{embedder.display_name}</p>
        ) : null}
      </div>

      {catalog ? <CatalogDetailSection catalog={catalog} /> : null}

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

      {!pullEnabled && modelMissing ? (
        <p className="mt-2 text-[10px] text-app-muted">In-dashboard pull is disabled (server).</p>
      ) : null}
    </div>
  );
}

export function EmbedderTilesGrid({
  overview,
  onRefresh,
}: {
  overview: ModelOverviewPayload;
  onRefresh: () => Promise<void>;
}) {
  const embedders =
    overview.catalog.embedders.length > 0 ? overview.catalog.embedders : overview.retrieval.embedders;
  const agentMap = agentsByEmbedder(overview.retrieval.agents);

  return (
    <div className="grid grid-cols-1 gap-3 tablet:grid-cols-2 xl:grid-cols-3">
      {embedders.map((embedder) => (
        <EmbedderTile
          key={embedder.embedder_id}
          embedder={embedder}
          overview={overview}
          agents={agentMap.get(embedder.embedder_id) ?? []}
          onRefresh={onRefresh}
        />
      ))}
    </div>
  );
}

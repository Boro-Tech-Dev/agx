'use client';

import { useMemo } from 'react';

import { ArchitectureFlow } from '../visual/ArchitectureFlow';
import { MiniStatSparkline } from '../visual/MiniStatSparkline';
import { VizSurface } from '../visual/VizSurface';
import { requestPathNodesAndEdges, storagePathNodesAndEdges } from '../../lib/home/dossierFlows';
import { useHomeKpiMetricsOptional } from './HomeKpiMetricsProvider';

export default function HomeProjectDossierViz() {
  const req = useMemo(() => requestPathNodesAndEdges(), []);
  const store = useMemo(() => storagePathNodesAndEdges(), []);
  const metrics = useHomeKpiMetricsOptional();

  const queueRows = metrics?.sparkline('queuePressure') ?? [];
  const activeRows = metrics?.sparkline('activeRuns') ?? [];
  const hasLiveChart = queueRows.length >= 2;

  return (
    <VizSurface className="p-2.5 tablet:p-3">
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <ArchitectureFlow
          flowId="dossier-request-path"
          title="How a request travels"
          subtitle="Pan and zoom. The worker pulls jobs from Redis, calls the router, then Ollama; uploads fan out to the ingestion worker."
          height={320}
          nodes={req.nodes}
          edges={req.edges}
        />
        <ArchitectureFlow
          flowId="dossier-storage"
          title="Where data lives"
          subtitle="Postgres holds structured state and vectors; Redis is for queues; MinIO stores blobs. All are local containers in the default stack."
          height={320}
          nodes={store.nodes}
          edges={store.edges}
        />
      </div>
      <div className="mt-4 border-t border-app-border pt-3">
        {hasLiveChart ? (
          <MiniStatSparkline
            data={queueRows}
            caption="Queue pressure (pending + processing) — last ~8 min from live monitoring"
            height={80}
          />
        ) : (
          <p className="text-[10px] text-app-muted">
            Queue sparkline appears after a second monitoring sample (~20s on this page).
          </p>
        )}
        {activeRows.length >= 2 ? (
          <div className="mt-3">
            <MiniStatSparkline
              data={activeRows}
              caption="Active runs over the same window"
              height={64}
            />
          </div>
        ) : null}
      </div>
    </VizSurface>
  );
}

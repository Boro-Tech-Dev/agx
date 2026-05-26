'use client';

import Link from 'next/link';
import { ModelAgentRoutesTable } from '../../components/model/ModelAgentRoutesTable';
import { ModelEmbeddersPanel } from '../../components/model/ModelEmbeddersPanel';
import { ModelEvalHarness } from '../../components/model/ModelEvalHarness';
import { ModelIntegrationMap } from '../../components/model/ModelIntegrationMap';
import { ModelLanesCard } from '../../components/model/ModelLanesCard';
import { ModelMcpToolsCard } from '../../components/model/ModelMcpToolsCard';
import { ModelOverviewHero } from '../../components/model/ModelOverviewHero';
import { ModelStatusHero } from '../../components/model/ModelStatusHero';
import { ModelRerankersPanel } from '../../components/model/ModelRerankersPanel';
import { ModelRouterFlagsCard } from '../../components/model/ModelRouterFlagsCard';
import { ModelTechnicalDetails } from '../../components/model/ModelTechnicalDetails';
import { ModelTilesGrid } from '../../components/model/ModelTilesGrid';
import { DashboardShell } from '../../components/DashboardShell';
import { SubpageHeader } from '../../components/SubpageHeader';
import { useModelOverview } from '../../hooks/useModelOverview';
import { useModelStatus } from '../../hooks/useModelStatus';

export function ModelPageClient() {
  const overview = useModelOverview();
  const status = useModelStatus();

  const data = overview.data?.ollama ?? status.data;
  const loading = overview.loading && !overview.data && !status.data;
  const error = overview.error && !overview.data && !status.data ? overview.error : null;

  const refresh = async () => {
    await Promise.all([overview.refresh(), status.refresh()]);
  };

  if (loading) {
    return (
      <DashboardShell header={<SubpageHeader badge="AI stack" title="Models" />} activeTool="model">
        <div className="space-y-4">
          <div className="h-24 animate-pulse rounded-xl border border-app-border bg-app-surface/80" />
          <div className="grid grid-cols-1 gap-3 tablet:grid-cols-2 xl:grid-cols-3">
            {[1, 2, 3].map((k) => (
              <div key={k} className="h-40 animate-pulse rounded-xl border border-app-border bg-app-surface/80" />
            ))}
          </div>
        </div>
      </DashboardShell>
    );
  }

  if (error && !data) {
    return (
      <DashboardShell header={<SubpageHeader badge="AI stack" title="Models" />} activeTool="model">
        <div className="rounded-xl border border-rose-300 bg-rose-50 p-4 text-sm text-rose-900 dark:border-rose-500/35 dark:bg-rose-500/10 dark:text-rose-100">
          <p className="font-semibold">Could not load model status</p>
          <p className="mt-1 font-mono text-[12px] text-rose-800 dark:text-rose-200/90">{error}</p>
          <p className="mt-2 text-[12px] text-app-muted">Check that agent-api is reachable and model-router is up.</p>
        </div>
      </DashboardShell>
    );
  }

  if (!data) {
    return null;
  }

  const lastUpdated = overview.lastUpdated ?? status.lastUpdated;
  const overviewData = overview.data;

  return (
    <DashboardShell
      header={
        <SubpageHeader
          badge="AI stack"
          title="Models"
          trailing={
            lastUpdated ? (
              <span className="text-[11px] tabular-nums text-app-muted">
                Updated {new Date(lastUpdated).toLocaleTimeString()}
              </span>
            ) : null
          }
        />
      }
      activeTool="model"
    >
      <div className="space-y-5">
        {overview.error && !overviewData ? (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[12px] text-amber-900 dark:border-amber-500/35 dark:bg-amber-500/10 dark:text-amber-100">
            Extended stack overview unavailable ({overview.error}). Showing Ollama status only.
          </div>
        ) : null}

        {overviewData ? <ModelOverviewHero data={overviewData} /> : <ModelStatusHero data={data} />}

        <p className="text-[13px] text-app-muted">
          Per-agent embedder and reranker settings:{' '}
          <Link href="/admin/retrieval" className="font-medium text-primary underline-offset-2 hover:underline">
            Retrieval playground
          </Link>
        </p>

        {data.required.length > 0 ? (
          <div>
            <h2 className="mb-2 text-sm font-semibold text-app-text">Ollama chat models</h2>
            <ModelTilesGrid data={data} onRefresh={refresh} />
          </div>
        ) : (
          <p className="rounded-lg border border-app-border bg-app-surface/60 p-4 text-[13px] text-app-muted">
            No required model rows in the status payload.
          </p>
        )}

        {overviewData ? (
          <>
            <ModelAgentRoutesTable data={overviewData} />
            <ModelRouterFlagsCard features={overviewData.router.features} />
            <ModelEmbeddersPanel data={overviewData} onRefresh={refresh} />
            <ModelRerankersPanel data={overviewData} />
            <ModelMcpToolsCard data={overviewData} />
            <ModelLanesCard data={overviewData} />
            <ModelEvalHarness />
            <ModelIntegrationMap />
            {overview.raw != null ? <ModelTechnicalDetails raw={overview.raw} /> : null}
          </>
        ) : null}
      </div>
    </DashboardShell>
  );
}

import {
  getQueueMonitoring,
  listAgents,
  listApprovals,
  listProjects,
  listRuns,
  listWorkspaces,
  type AgentCatalogRow,
} from '../../lib/api';
import { isAgentCatalogDisabled } from '../../lib/agents';
import type { HomeOverviewAgent, HomeOverviewStrip } from '../../lib/home/homeOverviewTypes';
import { SHELL_AGENTS_SECTION } from '../../lib/shellClasses';
import { DashboardShell } from '../DashboardShell';
import { HomeDashboardHub } from './HomeDashboardHub';
import { HomeHeaderClient } from './HomeHeaderClient';
import { HomeHero } from './HomeHero';
import { HomeKpiMetricsProvider } from './HomeKpiMetricsProvider';
import { HomeMainStage } from './HomeMainStage';
import { HomeSystemStrip } from './HomeSystemStrip';

const KNOWN_ORDER = ['pm', 'synergy', 'clinic', 'builder', 'canon', 'forge', 'kitt', 'eddie', 'bubs'];

function accentFromRow(row: AgentCatalogRow): string {
  const u = row.ui;
  if (u && typeof u === 'object' && typeof (u as { accent?: string }).accent === 'string') {
    return String((u as { accent: string }).accent);
  }
  return 'slate';
}

function orderFromRow(row: AgentCatalogRow, key: string): number {
  const u = row.ui;
  if (u && typeof u === 'object' && typeof (u as { order?: number }).order === 'number') {
    return (u as { order: number }).order;
  }
  const i = KNOWN_ORDER.indexOf(key);
  return i >= 0 ? i : 99;
}

function homeAgentsFromApi(rows: AgentCatalogRow[]): HomeOverviewAgent[] {
  return [...rows]
    .map((r) => ({
      key: r.key,
      name: r.name,
      desc: r.description,
      accent: accentFromRow(r),
      order: orderFromRow(r, r.key),
    }))
    .sort((a, b) => (a.order !== b.order ? a.order - b.order : a.key.localeCompare(b.key)))
    .map(({ key, name, desc }) => ({ key, name, desc }));
}

function countPendingApprovals(rows: unknown[]): number {
  let n = 0;
  for (const r of rows) {
    if (typeof r === 'object' && r !== null && 'status' in r && (r as { status: unknown }).status === 'pending') {
      n += 1;
    }
  }
  return n;
}

export default async function HomeOverview() {
  const settled = await Promise.allSettled([
    listRuns(),
    listAgents(),
    getQueueMonitoring(),
    listApprovals(),
    listProjects(),
    listWorkspaces(),
  ]);

  const runsResult = settled[0];
  const agentsResult = settled[1];
  const monitoringResult = settled[2];
  const approvalsResult = settled[3];
  const projectsResult = settled[4];
  const workspacesResult = settled[5];

  const runs: any[] = runsResult.status === 'fulfilled' ? runsResult.value : [];
  const runsError = runsResult.status === 'rejected' ? String((runsResult.reason as Error)?.message || runsResult.reason) : null;

  const catalog =
    agentsResult.status === 'fulfilled'
      ? (agentsResult.value as AgentCatalogRow[]).filter((r) => !isAgentCatalogDisabled(r.ui))
      : [];
  const agentsError =
    agentsResult.status === 'rejected' ? String((agentsResult.reason as Error)?.message || agentsResult.reason) : null;
  const agents = homeAgentsFromApi(catalog);

  const monitoring =
    monitoringResult.status === 'fulfilled' ? monitoringResult.value : null;
  const monitoringError =
    monitoringResult.status === 'rejected'
      ? String((monitoringResult.reason as Error)?.message || monitoringResult.reason)
      : null;

  const approvalsRows = approvalsResult.status === 'fulfilled' ? approvalsResult.value : null;
  const approvalsError =
    approvalsResult.status === 'rejected'
      ? String((approvalsResult.reason as Error)?.message || approvalsResult.reason)
      : null;
  const approvalsArr = Array.isArray(approvalsRows) ? (approvalsRows as unknown[]) : [];
  const pendingApprovals = approvalsError ? null : countPendingApprovals(approvalsArr);
  const approvalsTotal = approvalsError ? null : approvalsArr.length;

  const projectsRows = projectsResult.status === 'fulfilled' ? projectsResult.value : null;
  const projectsError =
    projectsResult.status === 'rejected'
      ? String((projectsResult.reason as Error)?.message || projectsResult.reason)
      : null;
  const projectsCount =
    projectsError != null ? null : Array.isArray(projectsRows) ? (projectsRows as unknown[]).length : null;

  const workspacesRows = workspacesResult.status === 'fulfilled' ? workspacesResult.value : null;
  const workspacesError =
    workspacesResult.status === 'rejected'
      ? String((workspacesResult.reason as Error)?.message || workspacesResult.reason)
      : null;
  const workspacesCount =
    workspacesError != null ? null : Array.isArray(workspacesRows) ? (workspacesRows as unknown[]).length : null;

  const u = monitoring?.llm_usage;
  const tokensConsumed =
    monitoringError != null ? null : u != null ? Math.max(0, Math.floor(Number(u.total_tokens) || 0)) : 0;
  const estimatedSavingsUsd =
    monitoringError != null ? null : u != null ? Math.max(0, Number(u.estimated_savings_usd) || 0) : 0;

  const strip: HomeOverviewStrip = {
    monitoring,
    monitoringError,
    projectsCount,
    projectsError,
    workspacesCount,
    workspacesError,
    pendingApprovals,
    approvalsTotal,
    approvalsError,
    tokensConsumed,
    estimatedSavingsUsd,
  };

  const cmdkAgents = agents.map(({ key, name }) => ({ key, name }));
  const initialProjects = Array.isArray(projectsRows) ? (projectsRows as unknown[]) : [];

  return (
    <DashboardShell
      header={
        <HomeHeaderClient
          agents={cmdkAgents}
          title="RagTag 1.0"
          subtitle="Retrieval augmented generation and multi-agent operator grid"
        />
      }
    >
      {(runsError || agentsError) && (
        <div className="mb-1 rounded-md border border-rose-200 bg-rose-50 p-2 text-[10px] text-rose-900 dark:border-rose-500/35 dark:bg-rose-500/10 dark:text-rose-100">
          {runsError && (
            <div>
              <span className="font-semibold">Recent runs:</span> {runsError}
            </div>
          )}
          {agentsError && (
            <div className={runsError ? 'mt-1' : ''}>
              <span className="font-semibold">Agent catalog:</span> {agentsError}
            </div>
          )}
        </div>
      )}

      <HomeKpiMetricsProvider initialMonitoring={monitoring} monitoringError={monitoringError}>
        <HomeHero />

        <HomeSystemStrip data={strip} />

        <section className={`mt-1.5 ${SHELL_AGENTS_SECTION}`} aria-label="Platform overview">
          <HomeDashboardHub />
        </section>

        <HomeMainStage runs={runs} initialProjects={initialProjects} />
      </HomeKpiMetricsProvider>
    </DashboardShell>
  );
}

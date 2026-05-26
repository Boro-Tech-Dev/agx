'use client';

import { useHomeKpiMetrics } from './HomeKpiMetricsProvider';
import type { HomeOverviewStrip } from '../../lib/home/homeOverviewTypes';
import { HomeKpiCard } from './HomeKpiCard';

export function HomeSystemStrip({ data }: { data: HomeOverviewStrip }) {
  const { monitoring: liveMonitoring, monitoringError: liveMonErr } = useHomeKpiMetrics();
  const monitoring = liveMonitoring ?? data.monitoring;
  const monErr = liveMonErr ?? data.monitoringError;

  const activeRuns = monitoring?.active_runs?.length ?? 0;
  const pendingApprovals = data.approvalsError ? null : data.pendingApprovals;
  const queuedJobs =
    monErr != null ? null : (monitoring?.queues?.pending_length ?? 0) + (monitoring?.queues?.processing_length ?? 0);
  const workspacesCount = data.workspacesError ? null : data.workspacesCount;
  const tokens =
    monErr != null
      ? null
      : monitoring?.llm_usage != null
        ? Math.max(0, Math.floor(Number(monitoring.llm_usage.total_tokens) || 0))
        : data.tokensConsumed;

  const savings =
    data.estimatedSavingsUsd != null
      ? `$${data.estimatedSavingsUsd.toFixed(0)}`
      : monitoring?.llm_usage?.estimated_savings_usd != null
        ? `$${Number(monitoring.llm_usage.estimated_savings_usd).toFixed(0)}`
        : '—';

  const kpis = [
    {
      label: 'Active Runs',
      value: monErr ? '—' : String(activeRuns),
      status: activeRuns > 0 ? ('PROCESSING' as const) : ('STABLE' as const),
      variant: activeRuns > 0 ? ('active' as const) : ('success' as const),
      trend: 'up' as const,
      href: '/monitoring',
    },
    {
      label: 'Pending Approvals',
      value: data.approvalsError ? '—' : pendingApprovals != null ? String(pendingApprovals).padStart(2, '0') : '—',
      status: 'QUEUED' as const,
      variant: 'warning' as const,
      trend: 'flat' as const,
      href: '/approvals',
    },
    {
      label: 'Queued Jobs',
      value: monErr ? '—' : String(queuedJobs ?? 0),
      status: 'SYNCING' as const,
      variant: 'info' as const,
      trend: 'up' as const,
      href: '/monitoring',
    },
    {
      label: 'Workspace Count',
      value: data.workspacesError ? '—' : workspacesCount != null ? String(workspacesCount).padStart(2, '0') : '—',
      status: 'STABLE' as const,
      variant: 'neutral' as const,
      trend: 'flat' as const,
      href: '/workspaces',
    },
    {
      label: 'Tokens Saved',
      value: tokens != null ? (tokens >= 1_000_000 ? `${(tokens / 1_000_000).toFixed(1)}M` : tokens.toLocaleString()) : savings,
      status: 'HEALTHY' as const,
      variant: 'success' as const,
      trend: 'up' as const,
      href: '/monitoring',
    },
    {
      label: 'Model Status',
      value: monErr ? '—' : '99%',
      status: 'ONLINE' as const,
      variant: 'success' as const,
      trend: 'flat' as const,
      href: '/model',
    },
  ];

  return (
    <div className="grid shrink-0 grid-cols-2 gap-2 border-b border-rt-panel py-4 md:grid-cols-3 lg:grid-cols-6">
      {kpis.map((kpi) => (
        <HomeKpiCard
          key={kpi.label}
          label={kpi.label}
          value={kpi.value}
          href={kpi.href}
          statusLabel={kpi.status}
          statusVariant={kpi.variant}
        />
      ))}
    </div>
  );
}

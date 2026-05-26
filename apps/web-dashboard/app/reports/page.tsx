'use client';

import { DashboardShell } from '../../components/DashboardShell';
import { ReportsPortfolioView } from '../../components/reports/ReportsPortfolioView';
import { SubpageHeader } from '../../components/SubpageHeader';

export default function ReportsPage() {
  return (
    <DashboardShell
      header={
        <SubpageHeader badge="Signals" title="Reports" />
      }
      activeTool="reports"
    >
      <p className="mb-3 text-[11px] leading-relaxed text-app-muted">
        Cross-project view of anomalies, risks, and costs persisted from agent runs. Filter by workspace or open a project to
        triage in Workspaces.
      </p>
      <ReportsPortfolioView />
    </DashboardShell>
  );
}

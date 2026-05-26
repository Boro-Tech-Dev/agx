'use client';

import { DashboardShell } from '../../components/DashboardShell';
import { MonitoringQueueView } from '../../components/monitoring/MonitoringQueueView';
import { SubpageHeader } from '../../components/SubpageHeader';

export default function MonitoringPage() {
  return (
    <DashboardShell
      header={
        <SubpageHeader badge="Queue" badgeTone="accent" title="Queue & compute" dashboardHref="/" />
      }
      activeTool="monitoring"
    >
      <MonitoringQueueView />
    </DashboardShell>
  );
}

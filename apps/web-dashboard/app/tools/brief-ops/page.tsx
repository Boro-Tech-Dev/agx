'use client';

import { DashboardShell } from '../../../components/DashboardShell';
import { SubpageHeader } from '../../../components/SubpageHeader';
import { BriefOpsPage } from '../../../components/tools/BriefOpsPage';

export default function BriefOpsRoute() {
  return (
    <DashboardShell header={<SubpageHeader badge="Tools" title="Brief ops" />} activeTool="brief_ops">
      <BriefOpsPage />
    </DashboardShell>
  );
}

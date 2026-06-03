import { DashboardShell } from '../../../components/DashboardShell';
import { GovernancePage } from '../../../components/governance/GovernancePage';
import { SubpageHeader } from '../../../components/SubpageHeader';

export default function GovernanceRoute() {
  return (
    <DashboardShell
      header={<SubpageHeader badge="Ops" badgeTone="muted" title="Governance" />}
      activeTool="governance"
    >
      <GovernancePage />
    </DashboardShell>
  );
}

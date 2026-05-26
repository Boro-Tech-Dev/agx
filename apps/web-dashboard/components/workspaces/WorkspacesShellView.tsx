'use client';

import { SubpageHeader } from '../SubpageHeader';
import { DashboardShell } from '../DashboardShell';
import { WorkspacesLayoutProvider } from './WorkspacesLayoutContext';
import { WorkspacesSortablePanels } from './WorkspacesSortablePanels';
import { WorkspacesPanelToolbar } from './WorkspacesPanelToolbar';
import { useWorkspacesData } from './WorkspacesDataContext';
import { renderWorkspacePanel } from './panels/workspacePanelRegistry';

export function WorkspacesShellView() {
  const { msg, err } = useWorkspacesData();

  return (
    <DashboardShell
      header={<SubpageHeader badge="Plan" title="Workspaces" />}
      activeTool="workspaces"
    >
      <WorkspacesLayoutProvider>
        <WorkspacesPanelToolbar />
        <WorkspacesSortablePanels renderPanel={(id) => renderWorkspacePanel(id)} />
      </WorkspacesLayoutProvider>
      {msg ? <p className="mt-2 text-[11px] font-medium text-emerald-700">{msg}</p> : null}
      {err ? <p className="mt-2 text-[11px] text-rose-700">{err}</p> : null}
    </DashboardShell>
  );
}

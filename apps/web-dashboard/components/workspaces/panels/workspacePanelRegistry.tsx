'use client';

import type { ReactNode } from 'react';
import type { WorkspacesPanelId } from '../../../lib/workspaces/layoutSchema';
import CurrentProjectChromePanel from './CurrentProjectChromePanel';
import TacticsPanel from './TacticsPanel';
import ProjectItemsPanel from './ProjectItemsPanel';
import ProjectFilesPanel from './ProjectFilesPanel';
import NarrativePanel from './NarrativePanel';
import SetupHierarchyPanel from './SetupHierarchyPanel';
import BulkImportPanel from './BulkImportPanel';
import WorkspaceAdminPanel from './WorkspaceAdminPanel';
import HierarchyOverviewPanel from './HierarchyOverviewPanel';
import RawJsonPanel from './RawJsonPanel';

const REGISTRY: Record<WorkspacesPanelId, React.FC> = {
  currentProjectChrome: CurrentProjectChromePanel,
  tactics: TacticsPanel,
  projectItems: ProjectItemsPanel,
  projectFiles: ProjectFilesPanel,
  narrative: NarrativePanel,
  setupHierarchy: SetupHierarchyPanel,
  bulkImport: BulkImportPanel,
  workspaceAdmin: WorkspaceAdminPanel,
  hierarchyOverview: HierarchyOverviewPanel,
  rawJson: RawJsonPanel,
};

export function renderWorkspacePanel(panelId: WorkspacesPanelId): ReactNode {
  const Comp = REGISTRY[panelId];
  return Comp ? <Comp /> : null;
}

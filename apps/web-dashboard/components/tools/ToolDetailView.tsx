'use client';

import { Suspense } from 'react';

import { getToolCatalogEntry, humanizeToolLabel, type ToolCatalogId } from '../../lib/toolCatalog';
import { LearningCompetencyBanner } from './learning/LearningCompetencyBanner';
import { LearningMissionBanner } from './learning/LearningMissionBanner';
import { dashboardToolKeyForCatalog } from '../../lib/navConfig';
import { LearningTeamPanel, renderLazyToolPanel } from '../../lib/tools/lazyToolPanels';
import { useToolsProject } from '../../lib/tools/toolsProjectContext';
import { ToolDetailChrome } from './ToolDetailChrome';
import { ToolPanelDualView } from './ToolPanelDualView';
import { ToolsCadenceBanner } from './ToolsCadenceBanner';
import { ToolsHubShell } from './ToolsHubShell';

function AllToolsLink() {
  return (
    <a href="/tools" className="text-[11px] font-medium text-app-muted hover:text-app-text">
      ← All tools
    </a>
  );
}

function ToolDetailBody({ toolId }: { toolId: ToolCatalogId }) {
  const { projectKey, toolsScenarioTactic, handleToolsTimingChange, projectCadenceContext } =
    useToolsProject();
  const entry = getToolCatalogEntry(toolId);
  const showCadenceBanner = entry.requiresCadence === true && toolsScenarioTactic == null;

  const usePanel = renderLazyToolPanel(toolId, projectKey, {
    scenarioTactic: toolsScenarioTactic,
    onScenarioTacticChange: handleToolsTimingChange,
    projectCadenceContext,
  });

  const teamPanel = toolId === 'learning' ? <LearningTeamPanel /> : undefined;

  return (
    <>
      <Suspense fallback={null}>
        <LearningMissionBanner />
      </Suspense>
      <LearningCompetencyBanner toolId={toolId} />
      <ToolDetailChrome toolId={toolId} />
      {showCadenceBanner ? <ToolsCadenceBanner /> : null}
      <Suspense fallback={<p className="text-[11px] text-app-muted">Loading tool…</p>}>
        <ToolPanelDualView toolId={toolId} usePanel={usePanel} teamPanel={teamPanel} />
      </Suspense>
    </>
  );
}

export function ToolDetailView({ toolId }: { toolId: ToolCatalogId }) {
  const title = humanizeToolLabel(getToolCatalogEntry(toolId).slug);

  return (
    <ToolsHubShell
      activeTool={dashboardToolKeyForCatalog(toolId)}
      title={title}
      trailing={<AllToolsLink />}
    >
      <ToolDetailBody toolId={toolId} />
    </ToolsHubShell>
  );
}

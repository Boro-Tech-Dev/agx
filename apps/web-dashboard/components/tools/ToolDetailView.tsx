'use client';

import { Suspense } from 'react';

import { getToolCatalogEntry, humanizeToolLabel, type ToolCatalogId } from '../../lib/toolCatalog';
import { LearningCompetencyBanner } from './learning/LearningCompetencyBanner';
import { LearningMissionBanner } from './learning/LearningMissionBanner';
import { dashboardToolKeyForCatalog } from '../../lib/navConfig';
import { useToolsProject } from '../../lib/tools/toolsProjectContext';
import { AskClarifierPanel } from './AskClarifierPanel';
import { BriefGeneratorPanel } from './BriefGeneratorPanel';
import { LaunchpadPanel } from './LaunchpadPanel';
import { OmnichannelPlannerPanel } from './OmnichannelPlannerPanel';
import { ReplyCoachPanel } from './ReplyCoachPanel';
import { ScenarioPlannerPanel } from './ScenarioPlannerPanel';
import { ToolDetailChrome } from './ToolDetailChrome';
import { ToolPanelDualView } from './ToolPanelDualView';
import { ToolsCadenceBanner } from './ToolsCadenceBanner';
import { ToolsHubShell } from './ToolsHubShell';
import { VeevaSuitePanel } from './VeevaSuitePanel';
import { LearningToolPanel } from './learning/LearningToolPanel';
import { LearningTeamPanel } from './learning/LearningTeamPanel';
import { WebCapturePanel } from './WebCapturePanel';
import { WebSearchPanel } from './WebSearchPanel';

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

  const usePanel = (() => {
    switch (toolId) {
      case 'ask_clarifier':
        return <AskClarifierPanel projectKey={projectKey} />;
      case 'brief_generator':
        return <BriefGeneratorPanel projectKey={projectKey} />;
      case 'launchpad':
        return <LaunchpadPanel projectKey={projectKey} />;
      case 'reply_coach':
        return <ReplyCoachPanel projectKey={projectKey} />;
      case 'omnichannel':
        return (
          <OmnichannelPlannerPanel
            projectKey={projectKey}
            scenarioTactic={toolsScenarioTactic}
            onScenarioTacticChange={handleToolsTimingChange}
            projectCadenceContext={projectCadenceContext}
          />
        );
      case 'scenario':
        return (
          <ScenarioPlannerPanel
            projectKey={projectKey}
            scenarioTactic={toolsScenarioTactic}
            onScenarioTacticChange={handleToolsTimingChange}
            projectCadenceContext={projectCadenceContext}
          />
        );
      case 'veeva_suite':
        return <VeevaSuitePanel projectKey={projectKey} />;
      case 'web_capture':
        return <WebCapturePanel projectKey={projectKey} />;
      case 'web_search':
        return <WebSearchPanel projectKey={projectKey} />;
      case 'learning':
        return <LearningToolPanel />;
    }
  })();

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

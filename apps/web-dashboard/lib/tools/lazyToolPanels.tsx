'use client';

import dynamic from 'next/dynamic';
import type { ComponentType } from 'react';

import type { ProjectHierarchyKeys } from './inferTimingProfileFromProject';
import type { ScenarioTactic } from '../scenarioPlanner/tactics';
import type { ToolCatalogId } from '../toolCatalog';

function ToolPanelLoading() {
  return <p className="text-[11px] text-app-muted">Loading tool…</p>;
}

function lazyPanel<P extends { projectKey: string }>(
  loader: () => Promise<{ default: ComponentType<P> }>,
) {
  return dynamic(loader, { ssr: false, loading: ToolPanelLoading });
}

const AskClarifierPanel = lazyPanel(() =>
  import('../../components/tools/AskClarifierPanel').then((m) => ({ default: m.AskClarifierPanel })),
);
const BriefGeneratorPanel = lazyPanel(() =>
  import('../../components/tools/BriefGeneratorPanel').then((m) => ({ default: m.BriefGeneratorPanel })),
);
const LaunchpadPanel = lazyPanel(() =>
  import('../../components/tools/LaunchpadPanel').then((m) => ({ default: m.LaunchpadPanel })),
);
const OmnichannelPlannerPanel = lazyPanel(() =>
  import('../../components/tools/OmnichannelPlannerPanel').then((m) => ({
    default: m.OmnichannelPlannerPanel,
  })),
);
const ReplyCoachPanel = lazyPanel(() =>
  import('../../components/tools/ReplyCoachPanel').then((m) => ({ default: m.ReplyCoachPanel })),
);
const ScenarioPlannerPanel = lazyPanel(() =>
  import('../../components/tools/ScenarioPlannerPanel').then((m) => ({ default: m.ScenarioPlannerPanel })),
);
const VeevaSuitePanel = lazyPanel(() =>
  import('../../components/tools/VeevaSuitePanel').then((m) => ({ default: m.VeevaSuitePanel })),
);
const WebCapturePanel = lazyPanel(() =>
  import('../../components/tools/WebCapturePanel').then((m) => ({ default: m.WebCapturePanel })),
);
const WebSearchPanel = lazyPanel(() =>
  import('../../components/tools/WebSearchPanel').then((m) => ({ default: m.WebSearchPanel })),
);

const LearningToolPanel = dynamic(
  () => import('../../components/tools/learning/LearningToolPanel').then((m) => ({ default: m.LearningToolPanel })),
  { ssr: false, loading: ToolPanelLoading },
);

const LearningTeamPanel = dynamic(
  () => import('../../components/tools/learning/LearningTeamPanel').then((m) => ({ default: m.LearningTeamPanel })),
  { ssr: false, loading: ToolPanelLoading },
);

export type ToolPanelExtraProps = {
  scenarioTactic?: ScenarioTactic | null;
  onScenarioTacticChange?: (tactic: ScenarioTactic) => void;
  projectCadenceContext?: ProjectHierarchyKeys | null;
};

export function renderLazyToolPanel(
  toolId: ToolCatalogId,
  projectKey: string,
  extra?: ToolPanelExtraProps,
) {
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
          scenarioTactic={extra?.scenarioTactic}
          onScenarioTacticChange={extra?.onScenarioTacticChange}
          projectCadenceContext={extra?.projectCadenceContext}
        />
      );
    case 'scenario':
      return (
        <ScenarioPlannerPanel
          projectKey={projectKey}
          scenarioTactic={extra?.scenarioTactic}
          onScenarioTacticChange={extra?.onScenarioTacticChange}
          projectCadenceContext={extra?.projectCadenceContext}
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
    default:
      return null;
  }
}

export { LearningTeamPanel };

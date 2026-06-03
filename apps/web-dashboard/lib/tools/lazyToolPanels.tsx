'use client';

import dynamic from 'next/dynamic';
import type { ComponentType, ReactNode } from 'react';

import type { ProjectHierarchyKeys } from './inferTimingProfileFromProject';
import type { ScenarioTactic } from '../scenarioPlanner/tactics';
import type { ToolCatalogId } from '../toolCatalog';

function ToolPanelLoading() {
  return <p className="text-[11px] text-app-muted">Loading tool…</p>;
}

type ProjectPanelProps = {
  projectKey: string;
  scenarioTactic?: ScenarioTactic | null;
  onScenarioTacticChange?: (tactic: ScenarioTactic) => void;
  projectCadenceContext?: ProjectHierarchyKeys | null;
};

type PanelLoader = () => Promise<{ default: ComponentType<ProjectPanelProps> }>;

const PANEL_LOADERS: Record<ToolCatalogId, PanelLoader | null> = {
  ask_clarifier: () =>
    import('../../components/tools/AskClarifierPanel').then((m) => ({ default: m.AskClarifierPanel })),
  brief_generator: () =>
    import('../../components/tools/BriefGeneratorPanel').then((m) => ({ default: m.BriefGeneratorPanel })),
  launchpad: () =>
    import('../../components/tools/LaunchpadPanel').then((m) => ({ default: m.LaunchpadPanel })),
  omnichannel: () =>
    import('../../components/tools/OmnichannelPlannerPanel').then((m) => ({
      default: m.OmnichannelPlannerPanel,
    })),
  reply_coach: () =>
    import('../../components/tools/ReplyCoachPanel').then((m) => ({ default: m.ReplyCoachPanel })),
  scenario: () =>
    import('../../components/tools/ScenarioPlannerPanel').then((m) => ({ default: m.ScenarioPlannerPanel })),
  veeva_suite: () =>
    import('../../components/tools/VeevaSuitePanel').then((m) => ({ default: m.VeevaSuitePanel })),
  web_capture: () =>
    import('../../components/tools/WebCapturePanel').then((m) => ({ default: m.WebCapturePanel })),
  web_search: () =>
    import('../../components/tools/WebSearchPanel').then((m) => ({ default: m.WebSearchPanel })),
  learning: () =>
    import('../../components/tools/learning/LearningToolPanel').then((m) => ({
      default: m.LearningToolPanel as ComponentType<ProjectPanelProps>,
    })),
};

const panelCache = new Map<ToolCatalogId, ComponentType<ProjectPanelProps>>();

function getToolPanel(toolId: ToolCatalogId): ComponentType<ProjectPanelProps> | null {
  const cached = panelCache.get(toolId);
  if (cached) return cached;

  const loader = PANEL_LOADERS[toolId];
  if (!loader) return null;

  const Panel = dynamic(loader, { ssr: false, loading: ToolPanelLoading });
  panelCache.set(toolId, Panel);
  return Panel;
}

let learningTeamPanel: ComponentType | null = null;

export function getLearningTeamPanel(): ComponentType {
  if (!learningTeamPanel) {
    learningTeamPanel = dynamic(
      () =>
        import('../../components/tools/learning/LearningTeamPanel').then((m) => ({
          default: m.LearningTeamPanel,
        })),
      { ssr: false, loading: ToolPanelLoading },
    );
  }
  return learningTeamPanel;
}

export type ToolPanelExtraProps = {
  scenarioTactic?: ScenarioTactic | null;
  onScenarioTacticChange?: (tactic: ScenarioTactic) => void;
  projectCadenceContext?: ProjectHierarchyKeys | null;
};

export function renderLazyToolPanel(
  toolId: ToolCatalogId,
  projectKey: string,
  extra?: ToolPanelExtraProps,
): ReactNode {
  const Panel = getToolPanel(toolId);
  if (!Panel) return null;

  if (toolId === 'omnichannel' || toolId === 'scenario') {
    return (
      <Panel
        projectKey={projectKey}
        scenarioTactic={extra?.scenarioTactic}
        onScenarioTacticChange={extra?.onScenarioTacticChange}
        projectCadenceContext={extra?.projectCadenceContext}
      />
    );
  }

  if (toolId === 'learning') {
    return <Panel projectKey={projectKey} />;
  }

  return <Panel projectKey={projectKey} />;
}

export function LearningTeamPanel() {
  const Panel = getLearningTeamPanel();
  return <Panel />;
}

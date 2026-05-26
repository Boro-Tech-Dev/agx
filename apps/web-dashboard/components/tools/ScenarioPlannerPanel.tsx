'use client';

import { useCallback, useState } from 'react';

import { patchBrand, patchProject } from '../../lib/api';
import { useLearningMissionParams } from '../../lib/learning/useLearningMissionParams';
import { validateLearningAfterSave } from '../../lib/learning/validateAfterToolSave';
import { useToolsProject } from '../../lib/tools/toolsProjectContext';

import type { HalTimelineScenarioPayload } from '../../lib/halScenario';
import type { ScenarioTactic } from '../../lib/scenarioPlanner/tactics';
import type { ProjectHierarchyKeys } from '../../lib/tools/inferTimingProfileFromProject';
import { ScenarioPanel } from '../agents/ScenarioPanel';

export function ScenarioPlannerPanel({
  projectKey,
  scenarioTactic,
  onScenarioTacticChange,
  projectCadenceContext = null,
}: {
  projectKey: string;
  scenarioTactic?: ScenarioTactic | null;
  onScenarioTacticChange?: (tactic: ScenarioTactic) => void;
  projectCadenceContext?: ProjectHierarchyKeys | null;
}) {
  const mission = useLearningMissionParams();
  const [saveMsg, setSaveMsg] = useState<string | null>(null);
  const [saveErr, setSaveErr] = useState<string | null>(null);
  const [cadenceAdminMsg, setCadenceAdminMsg] = useState<string | null>(null);

  const {
    brandId,
    cadenceSource,
    brandTimingProfileId,
    projectTimingProfileId,
    reloadHierarchy,
    clearSessionTimingOverride,
  } = useToolsProject();

  const onScenarioChange = useCallback((_payload: HalTimelineScenarioPayload | null) => {
    // Tool-only: preview + file actions live inside the scenario panel; no model injection here.
  }, []);

  const onSaveCadenceAsBrandDefault = useCallback(
    async (profileId: ScenarioTactic) => {
      if (!brandId) return;
      setCadenceAdminMsg(null);
      await patchBrand(brandId, { timing_profile_id: profileId });
      clearSessionTimingOverride();
      await reloadHierarchy();
      setCadenceAdminMsg(`Saved ${profileId} as default cadence for this brand.`);
    },
    [brandId, reloadHierarchy, clearSessionTimingOverride],
  );

  const onSaveCadenceAsProjectDefault = useCallback(
    async (profileId: ScenarioTactic) => {
      if (!projectKey.trim()) return;
      setCadenceAdminMsg(null);
      await patchProject(projectKey.trim(), { timing_profile_id: profileId });
      clearSessionTimingOverride();
      await reloadHierarchy();
      setCadenceAdminMsg(`Saved ${profileId} as cadence override for this project.`);
    },
    [projectKey, reloadHierarchy, clearSessionTimingOverride],
  );

  return (
    <div className="rounded border border-app-border bg-app-fill/70 p-2">
      <ScenarioPanel
        enabled
        onScenarioChange={onScenarioChange}
        projectKey={projectKey}
        scenarioTactic={scenarioTactic}
        onScenarioTacticChange={onScenarioTacticChange}
        projectCadenceContext={projectCadenceContext}
        brandId={brandId}
        cadenceSource={cadenceSource}
        brandTimingProfileId={brandTimingProfileId}
        projectTimingProfileId={projectTimingProfileId}
        onSaveCadenceAsBrandDefault={brandId ? onSaveCadenceAsBrandDefault : undefined}
        onSaveCadenceAsProjectDefault={projectKey.trim() ? onSaveCadenceAsProjectDefault : undefined}
        onScenarioProjectSave={async (m) => {
          setSaveErr(null);
          const validated = await validateLearningAfterSave(mission.enrollmentId, mission.stepId);
          setSaveMsg(validated ? `${m} ${validated}` : m);
        }}
        onScenarioProjectSaveError={(m) => {
          setSaveMsg(null);
          setSaveErr(m);
        }}
      />
      {cadenceAdminMsg ? (
        <div className="mt-2 rounded-md border border-indigo-200 bg-indigo-50/90 p-2 text-[10px] text-indigo-950 dark:border-indigo-500/35 dark:bg-indigo-500/10 dark:text-indigo-100">
          {cadenceAdminMsg}
        </div>
      ) : null}
      {saveMsg ? (
        <div className="mt-2 rounded-md border border-emerald-200 bg-emerald-50/90 p-2 text-[10px] text-emerald-950 dark:border-emerald-500/35 dark:bg-emerald-500/10 dark:text-emerald-100">
          {saveMsg}
        </div>
      ) : null}
      {saveErr ? (
        <div className="mt-2 rounded-md border border-rose-200 bg-rose-50 p-2 text-[10px] text-rose-800 dark:border-rose-500/35 dark:bg-rose-500/10 dark:text-rose-100">
          Could not save scenario to project: {saveErr}
        </div>
      ) : null}
    </div>
  );
}

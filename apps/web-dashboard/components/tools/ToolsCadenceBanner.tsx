'use client';

import { SCENARIO_TACTICS, scenarioTacticLabel, type ScenarioTactic } from '../../lib/scenarioPlanner/tactics';
import { useToolsProject } from '../../lib/tools/toolsProjectContext';

export function ToolsCadenceBanner() {
  const { projectKey, toolsScenarioTactic, handleToolsTimingChange } = useToolsProject();

  if (!projectKey.trim() || toolsScenarioTactic !== null) return null;

  return (
    <div className="mb-3 rounded-lg border border-amber-200 bg-amber-50/90 p-3 dark:border-amber-500/40 dark:bg-amber-500/10">
      <p className="text-[11px] font-medium text-amber-950 dark:text-amber-100">
        {`No default PRB cadence is defined for this project's workspace and client (or none is saved yet). `}
        Choose a timing profile to use for Omnichannel Planner and Scenario Planner.
      </p>
      <label className="mt-2 block text-[10px] font-semibold uppercase tracking-wide text-amber-900/90 dark:text-amber-100/90">
        Timing profile
        <select
          value=""
          onChange={(e) => {
            const v = e.target.value as ScenarioTactic;
            if (v) handleToolsTimingChange(v);
          }}
          className="mt-1 w-full max-w-md rounded-md border border-amber-300/80 bg-app-surface p-2 text-xs text-app-text dark:border-amber-500/35"
        >
          <option value="" disabled>
            Select…
          </option>
          {SCENARIO_TACTICS.map((t) => (
            <option key={t} value={t}>
              {scenarioTacticLabel(t)}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}


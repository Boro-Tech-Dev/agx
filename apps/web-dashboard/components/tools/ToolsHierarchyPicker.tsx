'use client';

import { scenarioTacticLabel } from '../../lib/scenarioPlanner/tactics';
import { useToolsProject, type CadenceSource } from '../../lib/tools/toolsProjectContext';

const PROJECT_NONE = '';

function cadenceSourceLabel(source: CadenceSource): string {
  switch (source) {
    case 'brand':
      return 'Brand default';
    case 'project':
      return 'Project override';
    case 'session':
      return 'Session override';
    default:
      return 'No default';
  }
}

export function ToolsHierarchyPicker() {
  const {
    hierarchyLoading,
    hierarchyError,
    workspaceKey,
    setWorkspaceKey,
    clientKey,
    setClientKey,
    brandKey,
    setBrandKey,
    projectKey,
    setProjectKey,
    workspaceNodes,
    clientNodes,
    brandNodes,
    projectOptions,
    toolsScenarioTactic,
    cadenceSource,
    brandTimingProfileId,
    reloadHierarchy,
  } = useToolsProject();

  const selectClass =
    'mt-1 w-full max-w-full rounded-md border border-app-border bg-app-fill p-2 text-[11px] text-app-text outline-none focus:border-indigo-400 focus:bg-app-surface dark:focus:border-indigo-500';

  if (hierarchyLoading) {
    return (
      <div className="rounded-lg border border-app-border bg-app-surface p-2 shadow-xs">
        <p className="text-[10px] text-app-muted">Loading workspace hierarchy…</p>
      </div>
    );
  }

  return (
    <div className="space-y-2 rounded-lg border border-app-border bg-app-surface p-2 shadow-xs">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[10px] font-semibold uppercase tracking-wide text-app-muted">Context</span>
        <button
          type="button"
          className="text-[9px] font-medium text-app-muted underline hover:text-app-text"
          onClick={() => void reloadHierarchy()}
        >
          Refresh
        </button>
      </div>

      <label className="block text-[10px] font-semibold uppercase tracking-wide text-app-muted">
        Workspace
        <select value={workspaceKey} onChange={(e) => setWorkspaceKey(e.target.value)} className={selectClass}>
          {workspaceNodes.length === 0 && <option value="">No workspaces</option>}
          {workspaceNodes.map((n) => (
            <option key={n.workspace.key} value={n.workspace.key}>
              {n.workspace.name} ({n.workspace.key})
            </option>
          ))}
        </select>
      </label>

      <label className="block text-[10px] font-semibold uppercase tracking-wide text-app-muted">
        Client
        <select
          value={clientKey}
          onChange={(e) => setClientKey(e.target.value)}
          className={selectClass}
          disabled={!clientNodes.length}
        >
          {clientNodes.length === 0 && <option value="">No clients</option>}
          {clientNodes.map((n) => (
            <option key={n.client.id} value={n.client.key}>
              {n.client.name} ({n.client.key})
            </option>
          ))}
        </select>
      </label>

      <label className="block text-[10px] font-semibold uppercase tracking-wide text-app-muted">
        Brand
        <select
          value={brandKey}
          onChange={(e) => setBrandKey(e.target.value)}
          className={selectClass}
          disabled={!brandNodes.length}
        >
          {brandNodes.length === 0 && <option value="">No brands</option>}
          {brandNodes.map((n) => (
            <option key={n.brand.id} value={n.brand.key}>
              {n.brand.name} ({n.brand.key})
            </option>
          ))}
        </select>
      </label>

      {toolsScenarioTactic || cadenceSource !== 'none' ? (
        <p className="text-[9px] leading-snug text-app-muted">
          <span className="font-medium text-app-text">{cadenceSourceLabel(cadenceSource)}</span>
          {toolsScenarioTactic ? (
            <>
              {' '}
              · {scenarioTacticLabel(toolsScenarioTactic)} (
              <span className="font-mono">{toolsScenarioTactic}</span>)
            </>
          ) : null}
          {cadenceSource === 'none' && !brandTimingProfileId ? (
            <span className="block mt-0.5 text-amber-800 dark:text-amber-200">
              No default cadence for this brand. Set one in Workspaces or pick a cadence in the tool.
            </span>
          ) : null}
        </p>
      ) : brandKey && !brandTimingProfileId ? (
        <p className="text-[9px] leading-snug text-amber-800 dark:text-amber-200">
          No default cadence for this brand. Set one in Workspaces or pick below in the tool.
        </p>
      ) : null}

      <label className="block text-[10px] font-semibold uppercase tracking-wide text-app-muted">
        Project <span className="font-normal normal-case text-app-muted">(optional)</span>
        <select
          value={projectKey || PROJECT_NONE}
          onChange={(e) => setProjectKey(e.target.value === PROJECT_NONE ? '' : e.target.value)}
          className={selectClass}
          disabled={!projectOptions.length}
        >
          <option value={PROJECT_NONE}>— No project (brand-only planning) —</option>
          {projectOptions.map((p) => (
            <option key={p.key} value={p.key}>
              {p.name} ({p.key})
            </option>
          ))}
        </select>
      </label>

      {hierarchyError ? (
        <p className="rounded border border-rose-200 bg-rose-50 p-2 text-[10px] text-rose-800 dark:border-rose-500/35 dark:bg-rose-500/10 dark:text-rose-100">
          Could not load hierarchy: {hierarchyError}
        </p>
      ) : null}
    </div>
  );
}

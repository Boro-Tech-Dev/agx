'use client';

import { TimingProfileCadenceSelect } from '../../scenarioPlanner/TimingProfileCadenceSelect';
import { allowsStructuredBreakdown } from '../../../lib/projectTypes';
import { timingProfileLabel } from '../../../lib/scenarioPlanner/timingProfiles';
import { btnDanger, inputClass } from '../../../lib/workspaces/styles';
import { ProjectHierarchyPicker } from '../ProjectHierarchyPicker';
import { useWorkspacesData } from '../WorkspacesDataContext';


export default function CurrentProjectChromePanel() {
  const d = useWorkspacesData();
  const typeRows =
    d.projectTypeCatalog.length > 0
      ? d.projectTypeCatalog
      : [{ value: 'other', label: 'Other', capture_mode: 'action' }];
  const currentType = (d.selectedProject as { project_type?: string } | undefined)?.project_type || 'other';
  return (
      <section className="mb-2 rounded-lg border border-app-border border-t-4 border-t-stone-600 dark:border-t-stone-500 bg-app-fill/80 p-2 shadow-inner">
        <h2 className="text-xs font-bold uppercase tracking-wide text-app-text">Current project</h2>
        <p className="text-[10px] text-app-muted">Tactics and breakdown items use the selection here.</p>
        <div className="mt-1.5 flex flex-col gap-2 tablet:flex-row tablet:flex-wrap tablet:items-end">
          <ProjectHierarchyPicker
            tree={d.tree}
            projects={d.projects}
            selectedKey={d.selectedKey}
            workspaceKey={d.clientWsKey}
            clientId={d.pickClientId}
            brandId={d.pickBrandId}
            onWorkspaceChange={d.setClientWsKey}
            onClientChange={d.setPickClientId}
            onBrandChange={d.setPickBrandId}
            onSelectKey={(key) => {
              d.setSelectedKey(key);
              d.setProjectDeleteOpen(false);
              d.setProjectDeleteConfirm('');
            }}
            onWorkspaceKeyForForms={(wk) => d.setClientWsKey(wk)}
          />
          {d.selectedKey ? (
            <div className="w-full min-w-0 space-y-2 rounded-md border border-app-border bg-app-surface/90 p-2 tablet:max-w-md">
              <div>
                <label className="text-[9px] font-semibold uppercase tracking-wide text-app-muted">Work kind</label>
                <select
                  value={d.personalPm ? 'personal' : 'business'}
                  onChange={(e) => void d.onChangeProjectPmKind(e.target.value as 'business' | 'personal')}
                  className={`${inputClass} mt-1 w-full`}
                >
                  <option value="business">Business / delivery</option>
                  <option value="personal">Personal / creative</option>
                </select>
              </div>
              <div>
                <label className="text-[9px] font-semibold uppercase tracking-wide text-app-muted">Project type</label>
                <select
                  value={typeRows.some((r) => r.value === currentType) ? currentType : 'other'}
                  onChange={(e) => void d.onChangeProjectTypeSlug(e.target.value)}
                  className={`${inputClass} mt-1 w-full`}
                >
                  {typeRows.map((row) => (
                    <option key={row.value} value={row.value}>
                      {row.label}
                    </option>
                  ))}
                </select>
              </div>
              <label className="flex cursor-pointer items-start gap-2 text-[10px] text-app-text">
                <input
                  type="checkbox"
                  className="mt-0.5"
                  checked={allowsStructuredBreakdown(d.selectedProject)}
                  onChange={(e) => void d.onSetAllowStructuredBreakdown(e.target.checked)}
                />
                <span>Allow structured breakdown (tasks / risks from PM, Synergy, H.E.L.P.eR, etc.)</span>
              </label>
              <div>
                <label className="text-[9px] font-semibold uppercase tracking-wide text-app-muted">
                  MLR cadence override
                </label>
                <TimingProfileCadenceSelect
                  value={(d.selectedProject as { timing_profile_id?: string | null })?.timing_profile_id}
                  onChange={(pid) => void d.onChangeProjectTimingProfile(pid)}
                  inheritLabel={
                    (d.selectedProject as { brand_timing_profile_id?: string | null })?.brand_timing_profile_id
                      ? `Inherit from brand (${timingProfileLabel(
                          String(
                            (d.selectedProject as { brand_timing_profile_id?: string }).brand_timing_profile_id,
                          ),
                        )})`
                      : 'Inherit from brand'
                  }
                  className={`${inputClass} mt-1 w-full`}
                />
                {(d.selectedProject as { resolved_timing_profile?: string | null })?.resolved_timing_profile ? (
                  <p className="mt-1 text-[9px] text-app-muted">
                    Effective:{' '}
                    <span className="font-mono">
                      {(d.selectedProject as { resolved_timing_profile?: string }).resolved_timing_profile}
                    </span>
                  </p>
                ) : null}
              </div>
            </div>
          ) : null}
          <div className="flex flex-wrap items-center gap-1">
            {!d.projectDeleteOpen ? (
              <button
                type="button"
                disabled={!d.selectedKey}
                className={btnDanger}
                onClick={() => {
                  d.setProjectDeleteOpen(true);
                  d.setProjectDeleteConfirm('');
                }}
              >
                Delete project…
              </button>
            ) : (
              <>
                <input
                  value={d.projectDeleteConfirm}
                  onChange={(e) => d.setProjectDeleteConfirm(e.target.value)}
                  className="max-w-[10rem] rounded border border-rose-200 px-1.5 py-1 text-[10px]"
                  placeholder={`Type ${d.selectedKey || 'key'}`}
                />
                <button
                  type="button"
                  disabled={!d.selectedKey || d.projectDeleteConfirm !== d.selectedKey}
                  className={btnDanger}
                  onClick={() => d.onDeleteProject()}
                >
                  Confirm
                </button>
                <button
                  type="button"
                  className="text-[10px] text-app-muted hover:text-app-text"
                  onClick={() => {
                    d.setProjectDeleteOpen(false);
                    d.setProjectDeleteConfirm('');
                  }}
                >
                  Cancel
                </button>
              </>
            )}
          </div>
        </div>
      </section>
  );
}

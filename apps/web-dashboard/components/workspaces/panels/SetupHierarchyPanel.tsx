'use client';

import type { InputHTMLAttributes } from 'react';
import { PROJECT_DOCUMENT_KIND_VALUES, projectDocumentDownloadUrl } from '../../../lib/api';
import { displayItemTypeLabel } from '../../../lib/pmMode';
import { STORAGE_WORKSPACE } from '../../../lib/workspaces/constants';
import { statusChip, priorityChip, processingDocChip, itemTypePill } from '../../../lib/workspaces/chips';
import { inputClass, btnPrimary, btnDanger } from '../../../lib/workspaces/styles';
import { TimingProfileCadenceSelect } from '../../scenarioPlanner/TimingProfileCadenceSelect';
import { HierarchySummary } from '../HierarchySummary';
import { ProjectHierarchyPicker } from '../ProjectHierarchyPicker';
import { useWorkspacesData } from '../WorkspacesDataContext';


export default function SetupHierarchyPanel() {
  const d = useWorkspacesData();
  return (
      <section className="mb-2 rounded-lg border border-app-border bg-app-fill/80 p-2 shadow-xs">
        <h2 className="mb-1.5 text-[11px] font-bold uppercase tracking-wide text-app-text">Setup hierarchy</h2>
        <div className="grid grid-cols-1 gap-2 desktop:grid-cols-2">
          {d.stepShell(1, 'border-l-4 border-l-rose-500', 'New workspace', (
            <form onSubmit={d.onCreateWorkspace} className="space-y-1.5">
              <input
                value={d.wsKeyInput}
                onChange={(e) => d.setWsKeyInput(e.target.value)}
                className={inputClass}
                placeholder="Workspace key"
                required
              />
              <input
                value={d.wsNameInput}
                onChange={(e) => d.setWsNameInput(e.target.value)}
                className={inputClass}
                placeholder="Display name"
                required
              />
              <button type="submit" className={`${btnPrimary} w-full`}>
                Add workspace
              </button>
            </form>
          ))}
          {d.stepShell(2, 'border-l-4 border-l-amber-500', 'New client', (
            <form onSubmit={d.onCreateClient} className="space-y-1.5">
              <label className="text-[9px] font-semibold uppercase tracking-wide text-app-muted">Workspace</label>
              <select
                value={d.clientWsKey}
                onChange={(e) => {
                  const next = e.target.value;
                  d.setClientWsKey(next);
                  try { localStorage.setItem(STORAGE_WORKSPACE, next); } catch {}
                }}
                className={inputClass}
                required
              >
                {(!d.tree?.workspaces || d.tree.workspaces.length === 0) && <option value="">Add a workspace first</option>}
                {(d.tree?.workspaces || []).map((wrap: any) => {
                  const w = wrap.workspace;
                  const wk = w?.key as string;
                  if (!wk) return null;
                  return (
                    <option key={wk} value={wk}>
                      {wk}{w?.name ? ` — ${w.name}` : ''}
                    </option>
                  );
                })}
              </select>
              <input
                value={d.clientKeyInput}
                onChange={(e) => d.setClientKeyInput(e.target.value)}
                className={inputClass}
                placeholder="Client key"
                required
              />
              <input
                value={d.clientNameInput}
                onChange={(e) => d.setClientNameInput(e.target.value)}
                className={inputClass}
                placeholder="Display name"
                required
              />
              <button type="submit" className={`${btnPrimary} w-full`}>
                Add client
              </button>
            </form>
          ))}
          {d.stepShell(3, 'border-l-4 border-l-cyan-600', 'New brand', (
            <form onSubmit={d.onCreateBrand} className="space-y-1.5">
              <label className="text-[9px] font-semibold uppercase tracking-wide text-app-muted">Client</label>
              <select
                value={d.brandClientId}
                onChange={(e) => d.setBrandClientId(e.target.value)}
                className={inputClass}
                required
              >
                {d.clientOptions.length === 0 && <option value="">Add a client first</option>}
                {d.clientOptions.map((o) => (
                  <option key={o.clientId} value={o.clientId}>
                    {o.label}
                  </option>
                ))}
              </select>
              <input
                value={d.brandKeyInput}
                onChange={(e) => d.setBrandKeyInput(e.target.value)}
                className={inputClass}
                placeholder="Brand key"
                required
              />
              <input
                value={d.brandNameInput}
                onChange={(e) => d.setBrandNameInput(e.target.value)}
                className={inputClass}
                placeholder="Display name"
                required
              />
              <button type="submit" className={`${btnPrimary} w-full`}>
                Add brand
              </button>
              <p className="text-[9px] leading-snug text-app-muted">
                Default MLR cadence for Scenario Planner (projects can override). Set per brand below after
                creation.
              </p>
            </form>
          ))}
          {d.brandsForCadenceAdmin.length > 0 ? (
            <div className="mt-2 space-y-2 rounded-md border border-app-border bg-app-surface/80 p-2">
              <p className="text-[9px] font-semibold uppercase tracking-wide text-app-muted">
                Brand default cadence
              </p>
              {d.brandsForCadenceAdmin.map((b) => (
                <div key={b.brandId} className="flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-2">
                  <span className="min-w-0 shrink-0 text-[10px] text-app-text">
                    {b.brandName}{' '}
                    <span className="font-mono text-app-muted">({b.brandKey})</span>
                  </span>
                  <TimingProfileCadenceSelect
                    value={b.timing_profile_id}
                    onChange={(pid) => void d.onChangeBrandTimingProfile(b.brandId, pid)}
                    inheritLabel="No default"
                    className={inputClass}
                  />
                </div>
              ))}
            </div>
          ) : null}
          {d.stepShell(4, 'border-l-4 border-l-stone-500 dark:border-l-stone-400', 'New project', (
            <form onSubmit={d.onCreateProject} className="space-y-1.5">
              <label className="text-[9px] font-semibold uppercase tracking-wide text-app-muted">Brand</label>
              <select
                value={d.brandIdInput}
                onChange={(e) => d.setBrandIdInput(e.target.value)}
                className={inputClass}
              >
                {d.brandOptions.length === 0 && <option value="">Create a brand first</option>}
                {d.brandOptions.map((o) => (
                  <option key={o.brandId} value={o.brandId}>
                    {o.label}
                  </option>
                ))}
              </select>
              <input
                value={d.keyInput}
                onChange={(e) => d.setKeyInput(e.target.value)}
                className={inputClass}
                placeholder="Project key (e.g. acme-mobile)"
                required
              />
              <input
                value={d.nameInput}
                onChange={(e) => d.setNameInput(e.target.value)}
                className={inputClass}
                placeholder="Display name"
                required
              />
              <label className="text-[9px] font-semibold uppercase tracking-wide text-app-muted">Work kind</label>
              <select
                value={d.pmKindCreate}
                onChange={(e) => d.setPmKindCreate(e.target.value as 'business' | 'personal')}
                className={inputClass}
              >
                <option value="business">Business / delivery</option>
                <option value="personal">Personal / creative</option>
              </select>
              <label className="text-[9px] font-semibold uppercase tracking-wide text-app-muted">Project type</label>
              <select
                value={d.projectTypeSlug}
                onChange={(e) => d.setProjectTypeSlug(e.target.value)}
                className={inputClass}
                required
              >
                {(d.projectTypeRows.length ? d.projectTypeRows : [{ value: 'other', label: 'Other', capture_mode: 'action' }]).map(
                  (row) => (
                    <option key={row.value} value={row.value}>
                      {row.label}
                      {row.capture_mode === 'log_only' ? ' · log' : ''}
                    </option>
                  ),
                )}
              </select>
              <label className="flex cursor-pointer items-start gap-2 text-[10px] text-app-text">
                <input
                  type="checkbox"
                  className="mt-0.5"
                  checked={d.allowBreakdownOnCreate}
                  onChange={(e) => d.setAllowBreakdownOnCreate(e.target.checked)}
                />
                <span>
                  Allow structured breakdown (PM / Synergy–style tasks &amp; risks on this project). Off by default for
                  log-style types.
                </span>
              </label>
              <textarea
                value={d.descInput}
                onChange={(e) => d.setDescInput(e.target.value)}
                className={`${inputClass} h-12 resize-y`}
                placeholder="Description (optional)"
              />
              <button type="submit" className={`${btnPrimary} w-full`}>
                Add project
              </button>
            </form>
          ))}
          <div className="min-w-0 desktop:col-span-2">
            {d.stepShell(5, 'border-l-4 border-l-emerald-600', 'Tactic setup', (
            <div className="space-y-2">
              {!d.selectedKey ? (
                <p className="text-[11px] text-app-muted">
                  Select or create a project first (step 4). This step attaches and configures tactics for the active project.
                </p>
              ) : (
                <>
                  <p className="text-[10px] text-app-muted">
                    Active project: <span className="font-mono font-semibold text-app-text">{d.selectedKey}</span>. You can attach an existing
                    library tactic with project overrides, or create a new library tactic and attach it in one go.
                  </p>

                  <div className="grid grid-cols-1 gap-2 desktop:grid-cols-2">
                    <div className="rounded border border-app-border bg-app-fill p-2">
                      <div className="text-[10px] font-semibold text-app-text">Attach existing (full overrides)</div>
                      <div className="mt-1 flex gap-1">
                        <input
                          value={d.tacticSearch}
                          onChange={(e) => d.setTacticSearch(e.target.value)}
                          className={inputClass}
                          placeholder="Filter library (name, key, channel)…"
                          disabled={!d.selectedKey}
                        />
                        <button
                          type="button"
                          className={btnPrimary}
                          disabled={!d.selectedKey || d.tacticLibraryLoading}
                          onClick={() => void d.loadTacticLibrarySearch()}
                          title="Reload tactics from server"
                        >
                          Refresh
                        </button>
                      </div>
                      {d.tacticLibraryLoading ? (
                        <div className="mt-1 text-[9px] text-app-muted">Loading library…</div>
                      ) : null}
                      {d.tacticLibraryIsEmpty ? (
                        <div className="mt-1 text-[9px] text-app-muted">
                          No tactics in the library — seed the DB once ({' '}
                          <code className="rounded bg-app-surface px-0.5">./scripts/seed-tactic-library.sh</code>
                          ) or create tactics in Workspaces.
                        </div>
                      ) : null}
                      {d.tacticLibraryFilterEmpty ? (
                        <div className="mt-1 text-[9px] text-app-muted">No rows match this filter — clear the box to see all.</div>
                      ) : null}
                      <select
                        value={d.tacticAttachId}
                        onChange={(e) => d.setTacticAttachId(e.target.value)}
                        className={`${inputClass} mt-1 bg-app-surface`}
                        disabled={!d.selectedKey || d.tacticSearchRows.length === 0}
                      >
                        <option value="">{d.tacticSearchRows.length ? 'Pick a tactic…' : 'No tactics to attach'}</option>
                        {d.tacticSearchRows.map((t: any) => (
                          <option key={t.id} value={t.id}>
                            {t.name} ({t.key}){t.channel ? ` · ${t.channel}` : ''}
                          </option>
                        ))}
                      </select>
                      <form onSubmit={d.onAttachExistingTactic} className="mt-1 space-y-1">
                        <div className="grid grid-cols-1 gap-1 desktop:grid-cols-2">
                          <div>
                            <label className="text-[9px] font-semibold uppercase tracking-wide text-app-muted">Lifecycle</label>
                            <select
                              value={d.tacticLifecycleStatus}
                              onChange={(e) => d.setTacticLifecycleStatus(e.target.value as any)}
                              className={`${inputClass} mt-0.5 bg-app-surface`}
                              disabled={!d.selectedKey}
                            >
                              <option value="draft">draft</option>
                              <option value="active">active</option>
                              <option value="paused">paused</option>
                              <option value="completed">completed</option>
                              <option value="archived">archived</option>
                            </select>
                          </div>
                          <div>
                            <label className="text-[9px] font-semibold uppercase tracking-wide text-app-muted">Priority</label>
                            <input
                              value={d.tacticPriority}
                              onChange={(e) => d.setTacticPriority(e.target.value)}
                              className={`${inputClass} mt-0.5 bg-app-surface`}
                              placeholder="medium"
                              disabled={!d.selectedKey}
                            />
                          </div>
                          <div>
                            <label className="text-[9px] font-semibold uppercase tracking-wide text-app-muted">Start at</label>
                            <input
                              value={d.tacticStartAt}
                              onChange={(e) => d.setTacticStartAt(e.target.value)}
                              className={`${inputClass} mt-0.5 bg-app-surface`}
                              placeholder="2026-04-28T12:00:00Z"
                              disabled={!d.selectedKey}
                            />
                          </div>
                          <div>
                            <label className="text-[9px] font-semibold uppercase tracking-wide text-app-muted">End at</label>
                            <input
                              value={d.tacticEndAt}
                              onChange={(e) => d.setTacticEndAt(e.target.value)}
                              className={`${inputClass} mt-0.5 bg-app-surface`}
                              placeholder="2026-05-28T12:00:00Z"
                              disabled={!d.selectedKey}
                            />
                          </div>
                        </div>
                        <input
                          value={d.tacticObjective}
                          onChange={(e) => d.setTacticObjective(e.target.value)}
                          className={inputClass}
                          placeholder="Objective override (optional)"
                          disabled={!d.selectedKey}
                        />
                        <textarea
                          value={d.tacticNotes}
                          onChange={(e) => d.setTacticNotes(e.target.value)}
                          className={`${inputClass} h-14 resize-y font-mono text-[10px]`}
                          placeholder="Notes (optional)"
                          disabled={!d.selectedKey}
                        />
                        <textarea
                          value={d.tacticSuccessMetricsJson}
                          onChange={(e) => d.setTacticSuccessMetricsJson(e.target.value)}
                          className={`${inputClass} h-20 resize-y font-mono text-[10px]`}
                          placeholder="success_metrics_override JSON"
                          disabled={!d.selectedKey}
                          spellCheck={false}
                        />
                        <textarea
                          value={d.tacticDependenciesJson}
                          onChange={(e) => d.setTacticDependenciesJson(e.target.value)}
                          className={`${inputClass} h-20 resize-y font-mono text-[10px]`}
                          placeholder="dependencies_override JSON"
                          disabled={!d.selectedKey}
                          spellCheck={false}
                        />
                        <textarea
                          value={d.tacticProjectMetadataJson}
                          onChange={(e) => d.setTacticProjectMetadataJson(e.target.value)}
                          className={`${inputClass} h-16 resize-y font-mono text-[10px]`}
                          placeholder="metadata JSON"
                          disabled={!d.selectedKey}
                          spellCheck={false}
                        />
                        <button type="submit" className={`${btnPrimary} w-full`} disabled={!d.selectedKey || !d.tacticAttachId}>
                          Attach to project
                        </button>
                      </form>
                    </div>

                    <div className="rounded border border-app-border bg-app-fill p-2">
                      <div className="text-[10px] font-semibold text-app-text">Create + attach (full library + overrides)</div>
                      <form onSubmit={d.onCreateAndAttachNewTactic} className="mt-1 space-y-1">
                        <input
                          value={d.tacticNewKey}
                          onChange={(e) => d.setTacticNewKey(e.target.value)}
                          className={inputClass}
                          placeholder="Tactic key (e.g. paid-search)"
                          disabled={!d.selectedKey}
                        />
                        <input
                          value={d.tacticNewName}
                          onChange={(e) => d.setTacticNewName(e.target.value)}
                          className={inputClass}
                          placeholder="Tactic name"
                          disabled={!d.selectedKey}
                        />
                        <textarea
                          value={d.tacticLibDescription}
                          onChange={(e) => d.setTacticLibDescription(e.target.value)}
                          className={`${inputClass} h-14 resize-y`}
                          placeholder="Description"
                          disabled={!d.selectedKey}
                        />
                        <div className="grid grid-cols-1 gap-1 desktop:grid-cols-2">
                          <input
                            value={d.tacticLibKind}
                            onChange={(e) => d.setTacticLibKind(e.target.value)}
                            className={inputClass}
                            placeholder="tactic_kind"
                            disabled={!d.selectedKey}
                          />
                          <input
                            value={d.tacticLibChannel}
                            onChange={(e) => d.setTacticLibChannel(e.target.value)}
                            className={inputClass}
                            placeholder="channel"
                            disabled={!d.selectedKey}
                          />
                          <input
                            value={d.tacticLibMedium}
                            onChange={(e) => d.setTacticLibMedium(e.target.value)}
                            className={inputClass}
                            placeholder="medium"
                            disabled={!d.selectedKey}
                          />
                          <input
                            value={d.tacticLibFormat}
                            onChange={(e) => d.setTacticLibFormat(e.target.value)}
                            className={inputClass}
                            placeholder="format"
                            disabled={!d.selectedKey}
                          />
                        </div>
                        <input
                          value={d.tacticLibTagsCsv}
                          onChange={(e) => d.setTacticLibTagsCsv(e.target.value)}
                          className={inputClass}
                          placeholder="tags (comma-separated)"
                          disabled={!d.selectedKey}
                        />
                        <div className="grid grid-cols-1 gap-1 desktop:grid-cols-2">
                          <input
                            value={d.tacticLibDefaultStartOffsetDays}
                            onChange={(e) => d.setTacticLibDefaultStartOffsetDays(e.target.value)}
                            className={inputClass}
                            placeholder="default_start_offset_days"
                            disabled={!d.selectedKey}
                          />
                          <input
                            value={d.tacticLibDefaultDurationDays}
                            onChange={(e) => d.setTacticLibDefaultDurationDays(e.target.value)}
                            className={inputClass}
                            placeholder="default_duration_days"
                            disabled={!d.selectedKey}
                          />
                          <input
                            value={d.tacticLibCadence}
                            onChange={(e) => d.setTacticLibCadence(e.target.value)}
                            className={inputClass}
                            placeholder="cadence"
                            disabled={!d.selectedKey}
                          />
                          <input
                            value={d.tacticLibOwner}
                            onChange={(e) => d.setTacticLibOwner(e.target.value)}
                            className={inputClass}
                            placeholder="owner"
                            disabled={!d.selectedKey}
                          />
                          <input
                            value={d.tacticLibCurrency}
                            onChange={(e) => d.setTacticLibCurrency(e.target.value)}
                            className={inputClass}
                            placeholder="currency"
                            disabled={!d.selectedKey}
                          />
                          <input
                            value={d.tacticLibEstimatedCostCents}
                            onChange={(e) => d.setTacticLibEstimatedCostCents(e.target.value)}
                            className={inputClass}
                            placeholder="estimated_cost_cents"
                            disabled={!d.selectedKey}
                          />
                        </div>
                        <label className="text-[9px] font-semibold uppercase tracking-wide text-app-muted">Library status</label>
                        <select
                          value={d.tacticLibStatus}
                          onChange={(e) => d.setTacticLibStatus(e.target.value as any)}
                          className={`${inputClass} mt-0.5 bg-app-surface`}
                          disabled={!d.selectedKey}
                        >
                          <option value="draft">draft</option>
                          <option value="active">active</option>
                          <option value="archived">archived</option>
                        </select>
                        <textarea
                          value={d.tacticLibDefaultSuccessJson}
                          onChange={(e) => d.setTacticLibDefaultSuccessJson(e.target.value)}
                          className={`${inputClass} h-20 resize-y font-mono text-[10px]`}
                          placeholder="default_success_metrics JSON"
                          disabled={!d.selectedKey}
                          spellCheck={false}
                        />
                        <textarea
                          value={d.tacticLibDefaultDepsJson}
                          onChange={(e) => d.setTacticLibDefaultDepsJson(e.target.value)}
                          className={`${inputClass} h-20 resize-y font-mono text-[10px]`}
                          placeholder="default_dependencies JSON"
                          disabled={!d.selectedKey}
                          spellCheck={false}
                        />
                        <textarea
                          value={d.tacticLibMetadataJson}
                          onChange={(e) => d.setTacticLibMetadataJson(e.target.value)}
                          className={`${inputClass} h-16 resize-y font-mono text-[10px]`}
                          placeholder="metadata JSON"
                          disabled={!d.selectedKey}
                          spellCheck={false}
                        />

                        <div className="mt-1 rounded border border-app-border bg-app-surface p-2">
                          <div className="text-[10px] font-semibold text-app-text">Project overrides (applies on attach)</div>
                          <div className="mt-1 grid grid-cols-1 gap-1 desktop:grid-cols-2">
                            <div>
                              <label className="text-[9px] font-semibold uppercase tracking-wide text-app-muted">Lifecycle</label>
                              <select
                                value={d.tacticLifecycleStatus}
                                onChange={(e) => d.setTacticLifecycleStatus(e.target.value as any)}
                                className={`${inputClass} mt-0.5 bg-app-surface`}
                                disabled={!d.selectedKey}
                              >
                                <option value="draft">draft</option>
                                <option value="active">active</option>
                                <option value="paused">paused</option>
                                <option value="completed">completed</option>
                                <option value="archived">archived</option>
                              </select>
                            </div>
                            <div>
                              <label className="text-[9px] font-semibold uppercase tracking-wide text-app-muted">Priority</label>
                              <input
                                value={d.tacticPriority}
                                onChange={(e) => d.setTacticPriority(e.target.value)}
                                className={`${inputClass} mt-0.5 bg-app-surface`}
                                placeholder="medium"
                                disabled={!d.selectedKey}
                              />
                            </div>
                            <div>
                              <label className="text-[9px] font-semibold uppercase tracking-wide text-app-muted">Start at</label>
                              <input
                                value={d.tacticStartAt}
                                onChange={(e) => d.setTacticStartAt(e.target.value)}
                                className={`${inputClass} mt-0.5 bg-app-surface`}
                                placeholder="2026-04-28T12:00:00Z"
                                disabled={!d.selectedKey}
                              />
                            </div>
                            <div>
                              <label className="text-[9px] font-semibold uppercase tracking-wide text-app-muted">End at</label>
                              <input
                                value={d.tacticEndAt}
                                onChange={(e) => d.setTacticEndAt(e.target.value)}
                                className={`${inputClass} mt-0.5 bg-app-surface`}
                                placeholder="2026-05-28T12:00:00Z"
                                disabled={!d.selectedKey}
                              />
                            </div>
                          </div>
                          <input
                            value={d.tacticObjective}
                            onChange={(e) => d.setTacticObjective(e.target.value)}
                            className={`${inputClass} mt-1`}
                            placeholder="Objective override (optional)"
                            disabled={!d.selectedKey}
                          />
                          <textarea
                            value={d.tacticNotes}
                            onChange={(e) => d.setTacticNotes(e.target.value)}
                            className={`${inputClass} mt-1 h-14 resize-y font-mono text-[10px]`}
                            placeholder="Notes (optional)"
                            disabled={!d.selectedKey}
                          />
                          <textarea
                            value={d.tacticSuccessMetricsJson}
                            onChange={(e) => d.setTacticSuccessMetricsJson(e.target.value)}
                            className={`${inputClass} mt-1 h-20 resize-y font-mono text-[10px]`}
                            placeholder="success_metrics_override JSON"
                            disabled={!d.selectedKey}
                            spellCheck={false}
                          />
                          <textarea
                            value={d.tacticDependenciesJson}
                            onChange={(e) => d.setTacticDependenciesJson(e.target.value)}
                            className={`${inputClass} mt-1 h-20 resize-y font-mono text-[10px]`}
                            placeholder="dependencies_override JSON"
                            disabled={!d.selectedKey}
                            spellCheck={false}
                          />
                          <textarea
                            value={d.tacticProjectMetadataJson}
                            onChange={(e) => d.setTacticProjectMetadataJson(e.target.value)}
                            className={`${inputClass} mt-1 h-16 resize-y font-mono text-[10px]`}
                            placeholder="metadata JSON"
                            disabled={!d.selectedKey}
                            spellCheck={false}
                          />
                        </div>

                        <button
                          type="submit"
                          disabled={!d.selectedKey || !d.tacticNewKey.trim() || !d.tacticNewName.trim()}
                          className={`${btnPrimary} w-full`}
                        >
                          Create + attach
                        </button>
                      </form>
                    </div>
                  </div>
                </>
              )}
            </div>
          ))}
          </div>
        </div>
      </section>
  );
}

'use client';

import type { InputHTMLAttributes } from 'react';
import { PROJECT_DOCUMENT_KIND_VALUES, projectDocumentDownloadUrl } from '../../../lib/api';
import { displayItemTypeLabel } from '../../../lib/pmMode';
import { STORAGE_WORKSPACE } from '../../../lib/workspaces/constants';
import { statusChip, priorityChip, processingDocChip, itemTypePill } from '../../../lib/workspaces/chips';
import { inputClass, btnPrimary, btnDanger } from '../../../lib/workspaces/styles';
import { HierarchySummary } from '../HierarchySummary';
import { ProjectHierarchyPicker } from '../ProjectHierarchyPicker';
import { useWorkspacesData } from '../WorkspacesDataContext';


export default function TacticsPanel() {
  const d = useWorkspacesData();
  return (
          <section className="mb-2 rounded-lg border border-app-border bg-app-fill/80 p-2 shadow-inner">
            <div className="grid grid-cols-1 gap-2 desktop:grid-cols-1">
          <div className="min-w-0 rounded border border-app-border bg-app-surface p-2">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <h3 className="text-[11px] font-semibold text-app-text">Tactics</h3>
                <p className="text-[9px] text-app-muted">
                  Shareable tactic library + per-project lifecycle (attach existing, or create and attach).
                </p>
              </div>
            </div>

            <div className="mt-1.5 grid grid-cols-1 gap-2 desktop:grid-cols-2">
              <div className="rounded border border-app-border bg-app-fill p-2">
                <div className="text-[10px] font-semibold text-app-text">Attach existing</div>
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
                    No tactics in the library. New Docker stacks load seeds automatically; existing databases need once:{' '}
                    <code className="rounded bg-app-surface px-0.5">DATABASE_URL=… ./scripts/seed-tactic-library.sh</code> — or create
                    tactics below.
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
                  <input
                    value={d.tacticObjective}
                    onChange={(e) => d.setTacticObjective(e.target.value)}
                    className={inputClass}
                    placeholder="Objective override (optional)"
                    disabled={!d.selectedKey}
                  />
                  <button type="submit" className={`${btnPrimary} w-full`} disabled={!d.selectedKey || !d.tacticAttachId}>
                    Attach to project
                  </button>
                </form>
              </div>

              <div className="rounded border border-app-border bg-app-fill p-2">
                <div className="text-[10px] font-semibold text-app-text">Create + attach</div>
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
                  <input
                    value={d.tacticObjective}
                    onChange={(e) => d.setTacticObjective(e.target.value)}
                    className={inputClass}
                    placeholder="Objective override (optional)"
                    disabled={!d.selectedKey}
                  />
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

            <div className="mt-2">
              <div className="text-[10px] font-semibold uppercase tracking-wide text-app-muted">Attached to this project</div>
              <div className="mt-1 min-w-0 overflow-x-auto">
                <table className="w-full min-w-[32rem] text-left text-[10px]">
                  <thead className="border-b border-app-border text-[9px] uppercase tracking-wide text-app-muted">
                    <tr>
                      <th className="py-1 pr-2">Tactic</th>
                      <th className="py-1 pr-2">Kind</th>
                      <th className="py-1 pr-2">Channel</th>
                      <th className="py-1 pr-2">Lifecycle</th>
                      <th className="py-1 pr-2">Priority</th>
                      <th className="py-1 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {d.tactics.map((t: any) => {
                      const open = d.tacticEditId === String(t.id);
                      return (
                        <tbody key={t.id}>
                          <tr className="border-t border-app-border align-top even:bg-app-fill/90">
                            <td className="py-1 pr-2">
                              <div className="font-semibold text-app-text">{t.tactic_name || t.name}</div>
                              <div className="text-[9px] text-app-muted">{t.tactic_key ? `${t.tactic_key}` : ''}</div>
                            </td>
                            <td className="py-1 pr-2 text-app-text">{t.tactic_kind || '—'}</td>
                            <td className="py-1 pr-2 text-app-text">{t.channel || '—'}</td>
                            <td className="py-1 pr-2 text-app-text">{t.lifecycle_status || '—'}</td>
                            <td className="py-1 pr-2 text-app-text">{t.priority || '—'}</td>
                            <td className="py-1 text-right">
                              <div className="flex flex-wrap justify-end gap-2">
                                <button
                                  type="button"
                                  className="text-[10px] font-semibold text-sky-700 hover:text-sky-900"
                                  onClick={() => (open ? d.setTacticEditId(null) : d.openEditTacticRow(t))}
                                >
                                  {open ? 'Close' : 'Edit'}
                                </button>
                                <button
                                  type="button"
                                  className="text-[10px] font-semibold text-rose-600 hover:text-rose-800"
                                  onClick={() => d.onDeleteTactic(t.id)}
                                >
                                  Detach
                                </button>
                              </div>
                            </td>
                          </tr>
                          {open ? (
                            <tr className="border-t border-app-border bg-app-surface">
                              <td colSpan={6} className="py-2">
                                <div className="grid grid-cols-1 gap-2 desktop:grid-cols-2">
                                  <div className="rounded border border-app-border bg-app-fill p-2">
                                    <div className="text-[10px] font-semibold text-app-text">Project overrides</div>
                                    <div className="mt-1 grid grid-cols-1 gap-1.5 desktop:grid-cols-2">
                                      <div>
                                        <label className="text-[9px] font-semibold uppercase tracking-wide text-app-muted">Lifecycle</label>
                                        <select
                                          value={d.tacticEditLifecycleStatus}
                                          onChange={(e) => d.setTacticEditLifecycleStatus(e.target.value as any)}
                                          className={`${inputClass} mt-0.5 bg-app-surface`}
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
                                          value={d.tacticEditPriority}
                                          onChange={(e) => d.setTacticEditPriority(e.target.value)}
                                          className={`${inputClass} mt-0.5 bg-app-surface`}
                                          placeholder="medium"
                                        />
                                      </div>
                                      <div>
                                        <label className="text-[9px] font-semibold uppercase tracking-wide text-app-muted">Start at</label>
                                        <input
                                          value={d.tacticEditStartAt}
                                          onChange={(e) => d.setTacticEditStartAt(e.target.value)}
                                          className={`${inputClass} mt-0.5 bg-app-surface`}
                                          placeholder="2026-04-28T12:00:00Z"
                                        />
                                      </div>
                                      <div>
                                        <label className="text-[9px] font-semibold uppercase tracking-wide text-app-muted">End at</label>
                                        <input
                                          value={d.tacticEditEndAt}
                                          onChange={(e) => d.setTacticEditEndAt(e.target.value)}
                                          className={`${inputClass} mt-0.5 bg-app-surface`}
                                          placeholder="2026-05-28T12:00:00Z"
                                        />
                                      </div>
                                    </div>
                                    <div className="mt-1 space-y-1.5">
                                      <input
                                        value={d.tacticEditObjectiveOverride}
                                        onChange={(e) => d.setTacticEditObjectiveOverride(e.target.value)}
                                        className={inputClass}
                                        placeholder="Objective override (optional)"
                                      />
                                      <textarea
                                        value={d.tacticEditNotes}
                                        onChange={(e) => d.setTacticEditNotes(e.target.value)}
                                        className={`${inputClass} h-16 resize-y font-mono text-[10px]`}
                                        placeholder="Notes (optional)"
                                      />
                                      <textarea
                                        value={d.tacticEditSuccessMetricsJson}
                                        onChange={(e) => d.setTacticEditSuccessMetricsJson(e.target.value)}
                                        className={`${inputClass} h-20 resize-y font-mono text-[10px]`}
                                        placeholder="success_metrics_override JSON"
                                        spellCheck={false}
                                      />
                                      <textarea
                                        value={d.tacticEditDependenciesJson}
                                        onChange={(e) => d.setTacticEditDependenciesJson(e.target.value)}
                                        className={`${inputClass} h-20 resize-y font-mono text-[10px]`}
                                        placeholder="dependencies_override JSON"
                                        spellCheck={false}
                                      />
                                      <textarea
                                        value={d.tacticEditProjectMetadataJson}
                                        onChange={(e) => d.setTacticEditProjectMetadataJson(e.target.value)}
                                        className={`${inputClass} h-16 resize-y font-mono text-[10px]`}
                                        placeholder="metadata JSON"
                                        spellCheck={false}
                                      />
                                    </div>
                                  </div>

                                  <div className="rounded border border-app-border bg-app-fill p-2">
                                    <div className="text-[10px] font-semibold text-app-text">Library fields</div>
                                    <div className="mt-1 space-y-1.5">
                                      <input
                                        value={d.tacticEditLibName}
                                        onChange={(e) => d.setTacticEditLibName(e.target.value)}
                                        className={inputClass}
                                        placeholder="Name"
                                      />
                                      <textarea
                                        value={d.tacticEditLibDescription}
                                        onChange={(e) => d.setTacticEditLibDescription(e.target.value)}
                                        className={`${inputClass} h-14 resize-y`}
                                        placeholder="Description"
                                      />
                                      <div className="grid grid-cols-1 gap-1.5 desktop:grid-cols-2">
                                        <input
                                          value={d.tacticEditLibKind}
                                          onChange={(e) => d.setTacticEditLibKind(e.target.value)}
                                          className={inputClass}
                                          placeholder="tactic_kind"
                                        />
                                        <input
                                          value={d.tacticEditLibChannel}
                                          onChange={(e) => d.setTacticEditLibChannel(e.target.value)}
                                          className={inputClass}
                                          placeholder="channel"
                                        />
                                        <input
                                          value={d.tacticEditLibMedium}
                                          onChange={(e) => d.setTacticEditLibMedium(e.target.value)}
                                          className={inputClass}
                                          placeholder="medium"
                                        />
                                        <input
                                          value={d.tacticEditLibFormat}
                                          onChange={(e) => d.setTacticEditLibFormat(e.target.value)}
                                          className={inputClass}
                                          placeholder="format"
                                        />
                                      </div>
                                      <input
                                        value={d.tacticEditLibTagsCsv}
                                        onChange={(e) => d.setTacticEditLibTagsCsv(e.target.value)}
                                        className={inputClass}
                                        placeholder="tags (comma-separated)"
                                      />
                                      <div className="grid grid-cols-1 gap-1.5 desktop:grid-cols-2">
                                        <input
                                          value={d.tacticEditLibCadence}
                                          onChange={(e) => d.setTacticEditLibCadence(e.target.value)}
                                          className={inputClass}
                                          placeholder="cadence"
                                        />
                                        <input
                                          value={d.tacticEditLibOwner}
                                          onChange={(e) => d.setTacticEditLibOwner(e.target.value)}
                                          className={inputClass}
                                          placeholder="owner"
                                        />
                                        <input
                                          value={d.tacticEditLibCurrency}
                                          onChange={(e) => d.setTacticEditLibCurrency(e.target.value)}
                                          className={inputClass}
                                          placeholder="currency"
                                        />
                                        <input
                                          value={d.tacticEditLibEstimatedCostCents}
                                          onChange={(e) => d.setTacticEditLibEstimatedCostCents(e.target.value)}
                                          className={inputClass}
                                          placeholder="estimated_cost_cents"
                                        />
                                      </div>
                                      <label className="text-[9px] font-semibold uppercase tracking-wide text-app-muted">Status</label>
                                      <select
                                        value={d.tacticEditLibStatus}
                                        onChange={(e) => d.setTacticEditLibStatus(e.target.value as any)}
                                        className={`${inputClass} mt-0.5 bg-app-surface`}
                                      >
                                        <option value="draft">draft</option>
                                        <option value="active">active</option>
                                        <option value="archived">archived</option>
                                      </select>
                                      <textarea
                                        value={d.tacticEditLibDefaultSuccessJson}
                                        onChange={(e) => d.setTacticEditLibDefaultSuccessJson(e.target.value)}
                                        className={`${inputClass} h-20 resize-y font-mono text-[10px]`}
                                        placeholder="default_success_metrics JSON"
                                        spellCheck={false}
                                      />
                                      <textarea
                                        value={d.tacticEditLibDefaultDepsJson}
                                        onChange={(e) => d.setTacticEditLibDefaultDepsJson(e.target.value)}
                                        className={`${inputClass} h-20 resize-y font-mono text-[10px]`}
                                        placeholder="default_dependencies JSON"
                                        spellCheck={false}
                                      />
                                      <textarea
                                        value={d.tacticEditLibMetadataJson}
                                        onChange={(e) => d.setTacticEditLibMetadataJson(e.target.value)}
                                        className={`${inputClass} h-16 resize-y font-mono text-[10px]`}
                                        placeholder="metadata JSON"
                                        spellCheck={false}
                                      />
                                    </div>
                                  </div>
                                </div>
                                <div className="mt-2 flex flex-wrap items-center justify-end gap-2">
                                  <button type="button" className={btnDanger} onClick={() => d.setTacticEditId(null)}>
                                    Cancel
                                  </button>
                                  <button type="button" className={btnPrimary} onClick={() => void d.onSaveTacticEdits(t)}>
                                    Save
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ) : null}
                        </tbody>
                      );
                    })}
                  </tbody>
                </table>
                {d.selectedKey && d.tactics.length === 0 && (
                  <p className="mt-1 text-[10px] text-app-muted">No tactics attached yet.</p>
                )}
              </div>
            </div>
          </div>

            </div>
          </section>
  );
}

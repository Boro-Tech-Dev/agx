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


export default function WorkspaceAdminPanel() {
  const d = useWorkspacesData();
  return (
      <section className="mb-2 rounded-lg border border-app-border bg-app-surface p-2 shadow-xs">
        <h2 className="text-xs font-bold text-app-text">Workspaces</h2>
        <p className="text-[10px] text-app-muted">Delete removes all projects (and breakdown items) under that workspace, then the workspace row.</p>
        <div className="mt-1.5 overflow-x-auto">
          <table className="w-full min-w-[20rem] text-left text-[11px]">
            <thead className="border-b border-app-border text-[9px] uppercase tracking-wide text-app-muted">
              <tr>
                <th className="py-1 pr-2">Key</th>
                <th className="py-1 pr-2">Name</th>
                <th className="py-1 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {(d.tree?.workspaces || []).map((wrap: any) => {
                const w = wrap.workspace;
                const wk = w?.key as string;
                return (
                  <tr key={wk} className="border-t border-app-border">
                    <td className="py-1 pr-2 font-mono text-[10px] font-medium text-app-text">{wk}</td>
                    <td className="py-1 pr-2 text-app-muted">{w?.name}</td>
                    <td className="py-1 text-right">
                      {d.wsDeleteTarget === wk ? (
                        <div className="flex flex-col items-end gap-1 tablet:flex-row tablet:justify-end">
                          <input
                            value={d.wsDeleteConfirm}
                            onChange={(e) => d.setWsDeleteConfirm(e.target.value)}
                            className="max-w-[8rem] rounded border border-rose-200 px-1 py-0.5 text-[10px]"
                            placeholder={`Type ${wk}`}
                          />
                          <button
                            type="button"
                            disabled={d.wsDeleteConfirm !== wk}
                            className={btnDanger}
                            onClick={() => d.onDeleteWorkspace(wk)}
                          >
                            Confirm delete
                          </button>
                          <button
                            type="button"
                            className="text-[10px] text-app-muted hover:text-app-text"
                            onClick={() => {
                              d.setWsDeleteTarget(null);
                              d.setWsDeleteConfirm('');
                            }}
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button type="button" className={btnDanger} onClick={() => d.setWsDeleteTarget(wk)}>
                          Delete…
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {(!d.tree?.workspaces || d.tree.workspaces.length === 0) && (
            <p className="mt-1 text-[10px] text-app-muted">No workspaces in the tree yet.</p>
          )}
        </div>
      </section>
  );
}

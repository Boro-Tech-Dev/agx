'use client';

import { useMemo } from 'react';
import type { InputHTMLAttributes } from 'react';
import { PROJECT_DOCUMENT_KIND_VALUES, projectDocumentDownloadUrl } from '../../../lib/api';
import { displayItemTypeLabel } from '../../../lib/pmMode';
import { STORAGE_WORKSPACE } from '../../../lib/workspaces/constants';
import { statusChip, priorityChip, processingDocChip, itemTypePill } from '../../../lib/workspaces/chips';
import { inputClass, btnPrimary, btnDanger } from '../../../lib/workspaces/styles';
import { HierarchySummary } from '../HierarchySummary';
import { ProjectHierarchyPicker } from '../ProjectHierarchyPicker';
import { useWorkspacesData } from '../WorkspacesDataContext';


export default function ProjectFilesPanel() {
  const d = useWorkspacesData();
  const persistTimeline = useMemo(() => {
    const p = d.projects.find((x: any) => x.key === d.selectedKey);
    if (!p) return true;
    return p.persist_timeline_events !== false;
  }, [d.projects, d.selectedKey]);

  return (
          <section className="mb-2 rounded-lg border border-app-border bg-app-fill/80 p-2 shadow-inner">
        <div className="mt-2 rounded border border-app-border bg-app-surface p-2">
          <h3 className="text-[11px] font-semibold text-app-text">Project files</h3>
          {d.selectedKey && persistTimeline === false ? (
            <p className="mb-1 rounded border border-amber-600/35 bg-amber-500/10 px-2 py-1 text-[10px] leading-snug text-app-text">
              Timeline CSV files will not mint key-date rows for this project type (log-only capture). Use an action-type
              project or set <span className="font-mono">allow_structured_breakdown</span> in project metadata to enable
              structured timelines.
            </p>
          ) : null}
          <p className="text-[9px] text-app-muted">
            Upload Office or PDF files; text is extracted for search. For health records, pick kind{' '}
            <span className="font-mono">clinical_note</span>, <span className="font-mono">lab_report</span>, or{' '}
            <span className="font-mono">imaging_report</span> (informational tagging only).
          </p>
          <div className="mt-1.5 flex flex-wrap items-end gap-2">
            <div>
              <label className="text-[9px] font-semibold uppercase tracking-wide text-app-muted">Kind for upload</label>
              <select
                value={d.uploadKind}
                onChange={(e) => d.setUploadKind(e.target.value)}
                className={`${inputClass} mt-0.5 min-w-[8rem]`}
                disabled={!d.selectedKey}
              >
                {PROJECT_DOCUMENT_KIND_VALUES.map((k) => (
                  <option key={k} value={k}>
                    {k.replace(/_/g, ' ')}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-[9px] font-semibold uppercase tracking-wide text-app-muted">Filter list</label>
              <select
                value={d.docKindFilter}
                onChange={(e) => d.setDocKindFilter(e.target.value)}
                className={`${inputClass} mt-0.5 min-w-[8rem]`}
                disabled={!d.selectedKey}
              >
                <option value="">All kinds</option>
                {PROJECT_DOCUMENT_KIND_VALUES.map((k) => (
                  <option key={k} value={k}>
                    {k.replace(/_/g, ' ')}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-[9px] font-semibold uppercase tracking-wide text-app-muted">Files</label>
              <input
                type="file"
                multiple
                disabled={!d.selectedKey}
                className="mt-0.5 block max-w-[14rem] text-[10px] file:mr-1 file:rounded file:border-0 file:bg-rose-100 file:px-2 file:py-0.5 file:text-[10px] file:font-semibold file:text-rose-900"
                onChange={(e) => {
                  void d.onUploadProjectFiles(e.target.files);
                  e.target.value = '';
                }}
              />
            </div>
          </div>
          <div className="mt-1.5 min-w-0 overflow-x-auto">
            <table className="w-full min-w-[28rem] text-left text-[10px]">
              <thead className="sticky top-0 z-[1] border-b border-app-border bg-app-surface text-[9px] uppercase tracking-wide text-app-muted">
                <tr>
                  <th className="py-0.5 pr-1">Kind</th>
                  <th className="py-0.5 pr-1">Name</th>
                  <th className="py-0.5 pr-1">Status</th>
                  <th className="py-0.5 pr-1">Error</th>
                  <th className="py-0.5 pr-1">Created</th>
                  <th className="py-0.5">Actions</th>
                </tr>
              </thead>
              <tbody>
                {d.projectDocs.map((docRow: any) => (
                  <tr key={docRow.id} className="border-t border-app-border align-top even:bg-app-fill/90">
                    <td className="py-0.5 pr-1">
                      <select
                        value={String(docRow.document_kind || 'general')}
                        onChange={(e) => void d.onDocKindRowChange(String(docRow.id), e.target.value)}
                        className="max-w-[7rem] rounded border border-app-border bg-app-surface px-1 py-0.5 text-[9px] capitalize"
                        disabled={!d.selectedKey}
                      >
                        {PROJECT_DOCUMENT_KIND_VALUES.map((k) => (
                          <option key={k} value={k}>
                            {k}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="max-w-[12rem] py-0.5 pr-1">
                      <div className="truncate font-medium text-app-text" title={docRow.original_filename || docRow.title}>
                        {docRow.original_filename || docRow.title}
                      </div>
                    </td>
                    <td className="py-0.5 pr-1">
                      <span
                        className={`inline-block rounded px-1 py-0.5 text-[9px] font-semibold capitalize ${processingDocChip(
                          docRow.processing_status,
                        )}`}
                      >
                        {String(docRow.processing_status || '').replace(/_/g, ' ') || '—'}
                      </span>
                    </td>
                    <td className="max-w-[10rem] truncate py-0.5 pr-1 text-[9px] text-rose-700" title={docRow.error_message || ''}>
                      {docRow.error_message || '—'}
                    </td>
                    <td className="whitespace-nowrap py-0.5 pr-1 text-[9px] text-app-muted">
                      {docRow.created_at ? String(docRow.created_at).slice(0, 19).replace('T', ' ') : '—'}
                    </td>
                    <td className="flex flex-wrap gap-1 py-0.5">
                      <a
                        href={projectDocumentDownloadUrl(d.selectedKey, String(docRow.id))}
                        className="font-semibold text-cyan-700 hover:text-cyan-900 hover:underline"
                        target="_blank"
                        rel="noreferrer"
                      >
                        Download
                      </a>
                      <button
                        type="button"
                        className="font-semibold text-amber-800 hover:underline"
                        onClick={() => void d.onDocArchive(String(docRow.id))}
                      >
                        Archive
                      </button>
                      <button
                        type="button"
                        className="font-semibold text-rose-600 hover:underline"
                        onClick={() => void d.onDocDelete(String(docRow.id))}
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {d.selectedKey && d.projectDocs.length === 0 && (
              <p className="mt-1 text-[10px] text-app-muted">No files for this project yet.</p>
            )}
          </div>
        </div>

          </section>
  );
}

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


export default function BulkImportPanel() {
  const d = useWorkspacesData();
  return (
      <section className="mb-2 rounded-lg border border-emerald-200 bg-emerald-50/30 p-2 shadow-xs">
        <h2 className="mb-1 text-[11px] font-bold uppercase tracking-wide text-emerald-900">Bulk import</h2>
        <p className="text-[10px] text-app-muted">
          Import workspaces, clients, brands, projects, and tactics from one CSV (format:{' '}
          <span className="font-mono text-emerald-900">docs/workspace_bulk_import.md</span> in the repo). Then optionally upload many
          project files using a manifest + folder.
        </p>
        <div className="mt-2 grid grid-cols-1 gap-2 desktop:grid-cols-2">
          <div className="rounded border border-emerald-100 bg-app-surface p-2">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-[10px] font-semibold text-app-text">1. Hierarchy CSV</h3>
              <a
                href="/templates/hierarchy_import_template.csv"
                download
                className="text-[10px] font-semibold text-cyan-700 hover:text-cyan-900 hover:underline"
              >
                Download template
              </a>
            </div>
            <textarea
              value={d.bulkCsvText}
              onChange={(e) => d.setBulkCsvText(e.target.value)}
              className={`${inputClass} mt-1 h-28 resize-y font-mono text-[10px]`}
              placeholder='entity,workspace_key,client_key,brand_key,key,name,...'
              spellCheck={false}
            />
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <label className="text-[10px] text-app-muted">
                <input
                  type="file"
                  accept=".csv,text/csv"
                  className="max-w-full text-[10px]"
                  onChange={async (e) => {
                    const f = e.target.files?.[0];
                    if (!f) return;
                    d.setBulkCsvText(await f.text());
                    e.target.value = '';
                  }}
                />
              </label>
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-3 text-[10px]">
              <label className="flex items-center gap-1 text-app-text">
                <input type="checkbox" checked={d.bulkSkipExisting} onChange={(e) => d.setBulkSkipExisting(e.target.checked)} />
                Skip existing keys
              </label>
            </div>
            <div className="mt-1.5 flex flex-wrap gap-1">
              <button type="button" disabled={d.bulkWorking} className={btnPrimary} onClick={() => void d.onBulkPreview()}>
                Preview (dry run)
              </button>
              <button type="button" disabled={d.bulkWorking} className={btnPrimary} onClick={() => void d.onBulkApply()}>
                Apply import
              </button>
            </div>
            {d.bulkResult ? (
              <div className="mt-2 space-y-1 text-[10px] text-app-text">
                <div>
                  <span className="font-semibold">Created:</span>{' '}
                  {Object.entries(d.bulkResult.created)
                    .map(([k, v]) => `${k}: ${v}`)
                    .join(', ') || 'none'}
                </div>
                <div>
                  <span className="font-semibold">Skipped:</span>{' '}
                  {Object.entries(d.bulkResult.skipped)
                    .map(([k, v]) => `${k}: ${v}`)
                    .join(', ') || 'none'}
                </div>
                {d.bulkResult.errors?.length ? (
                  <ul className="max-h-24 list-disc overflow-auto pl-4 text-rose-800">
                    {d.bulkResult.errors.map((er, i) => (
                      <li key={i}>
                        Line {er.line ?? '—'} {er.entity ? `(${er.entity})` : ''}: {er.message}
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            ) : null}
          </div>
          <div className="rounded border border-emerald-100 bg-app-surface p-2">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-[10px] font-semibold text-app-text">2. Project files manifest</h3>
              <a
                href="/templates/project_files_manifest_template.csv"
                download
                className="text-[10px] font-semibold text-cyan-700 hover:text-cyan-900 hover:underline"
              >
                Download template
              </a>
            </div>
            <p className="mt-0.5 text-[9px] text-app-muted">
              CSV columns: <code className="font-mono">project_key</code>, <code className="font-mono">relative_path</code>,{' '}
              <code className="font-mono">document_kind</code>. Choose the folder that contains those paths (browser provides{' '}
              <code className="font-mono">webkitRelativePath</code> for matching).
            </p>
            <textarea
              value={d.manifestCsv}
              onChange={(e) => d.setManifestCsv(e.target.value)}
              className={`${inputClass} mt-1 h-20 resize-y font-mono text-[10px]`}
              placeholder="project_key,relative_path,document_kind"
              spellCheck={false}
            />
            <div className="mt-1 flex flex-wrap gap-2">
              <label className="text-[10px] text-app-muted">
                Manifest file{' '}
                <input
                  type="file"
                  accept=".csv,text/csv"
                  className="max-w-full"
                  onChange={async (e) => {
                    const f = e.target.files?.[0];
                    if (!f) return;
                    d.setManifestCsv(await f.text());
                    e.target.value = '';
                  }}
                />
              </label>
              <label className="text-[10px] text-app-muted">
                Select folder{' '}
                <input
                  type="file"
                  multiple
                  {...({ webkitdirectory: '' } as InputHTMLAttributes<HTMLInputElement>)}
                  className="max-w-full"
                  onChange={(e) => {
                    const fl = e.target.files;
                    d.setManifestFolderFiles(fl?.length ? Array.from(fl) : null);
                    e.target.value = '';
                  }}
                />
              </label>
            </div>
            <button
              type="button"
              disabled={d.manifestWorking}
              className={`${btnPrimary} mt-1.5`}
              onClick={() => void d.onManifestUploadRun()}
            >
              Upload files from manifest
            </button>
            {d.manifestFolderFiles?.length ? (
              <p className="mt-1 text-[9px] text-app-muted">{d.manifestFolderFiles.length} file(s) in selected folder.</p>
            ) : null}
            {d.manifestLog?.length ? (
              <ul className="mt-1 max-h-28 overflow-auto text-[9px]">
                {d.manifestLog.map((row, i) => (
                  <li key={i} className={row.ok ? 'text-emerald-800' : 'text-rose-800'}>
                    {row.line}
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        </div>
      </section>
  );
}

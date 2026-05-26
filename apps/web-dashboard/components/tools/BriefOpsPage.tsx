'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

import {
  bootstrapBriefTemplates,
  createTacticLibrary,
  getBriefTemplateDraft,
  listProjectDocuments,
  listProjects,
  listTacticsLibrary,
  patchTacticLibrary,
  publishBriefTemplates,
  putBriefTemplateDraft,
  uploadProjectDocument,
  validateBriefTemplateDraft,
} from '../../lib/api';
import { useBriefTemplateConfig } from '../../lib/briefGenerator/useBriefTemplateConfig';
import { BriefFactoryInner } from './brief/BriefFactoryInner';
import { filterLibraryRowsForAttach, filterTacticsByQuery } from '../../lib/tacticLibraryFilter';

const PROJECT_STORAGE_KEY = 'dd.project_key';

type Tab = 'library' | 'templates' | 'factory' | 'uploads';

export function BriefOpsPage() {
  const [tab, setTab] = useState<Tab>('factory');
  const [projects, setProjects] = useState<any[]>([]);
  const [projectKey, setProjectKey] = useState('');
  const [projErr, setProjErr] = useState<string | null>(null);

  const { bundle, loading: bundleLoading, fromApi, publishedVersion, reload: reloadPublished } = useBriefTemplateConfig();
  const [autofillDocId, setAutofillDocId] = useState<string | null>(null);

  const [libRows, setLibRows] = useState<Record<string, unknown>[]>([]);
  const [libQuery, setLibQuery] = useState('');
  const [libLoading, setLibLoading] = useState(false);
  const [libMsg, setLibMsg] = useState<string | null>(null);
  const [libErr, setLibErr] = useState<string | null>(null);
  const [editTacticId, setEditTacticId] = useState<string | null>(null);

  const [newKey, setNewKey] = useState('');
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');

  const [skJson, setSkJson] = useState('');
  const [ovJson, setOvJson] = useState('');
  const [prJson, setPrJson] = useState('');
  const [tplMsg, setTplMsg] = useState<string | null>(null);
  const [tplErr, setTplErr] = useState<string | null>(null);
  const [tplLoading, setTplLoading] = useState(false);

  const [uploads, setUploads] = useState<Record<string, unknown>[]>([]);
  const [upBusy, setUpBusy] = useState(false);

  const loadProjects = useCallback(async () => {
    setProjErr(null);
    try {
      const rows = await listProjects();
      setProjects(Array.isArray(rows) ? rows : []);
      const keys = (rows as any[]).map((p) => p.key);
      const saved = typeof localStorage !== 'undefined' ? localStorage.getItem(PROJECT_STORAGE_KEY) : null;
      setProjectKey((prev) => {
        if (prev && keys.includes(prev)) return prev;
        if (saved && keys.includes(saved)) return saved;
        return keys[0] || '';
      });
    } catch (e: unknown) {
      setProjects([]);
      setProjErr(e instanceof Error ? e.message : String(e));
    }
  }, []);

  useEffect(() => {
    void loadProjects();
  }, [loadProjects]);

  useEffect(() => {
    if (!projectKey) return;
    try {
      localStorage.setItem(PROJECT_STORAGE_KEY, projectKey);
    } catch {
      /* ignore */
    }
  }, [projectKey]);

  const reloadLibrary = useCallback(async () => {
    setLibLoading(true);
    setLibErr(null);
    try {
      const rows = await listTacticsLibrary();
      setLibRows(filterLibraryRowsForAttach(Array.isArray(rows) ? rows : []));
    } catch (e: unknown) {
      setLibErr(e instanceof Error ? e.message : String(e));
      setLibRows([]);
    } finally {
      setLibLoading(false);
    }
  }, []);

  useEffect(() => {
    if (tab === 'library') void reloadLibrary();
  }, [tab, reloadLibrary]);

  const filteredLib = useMemo(() => filterTacticsByQuery(libRows, libQuery), [libRows, libQuery]);

  const loadDraftJson = useCallback(async () => {
    setTplLoading(true);
    setTplErr(null);
    setTplMsg(null);
    try {
      const row = await getBriefTemplateDraft();
      setSkJson(JSON.stringify(row.skeleton, null, 2));
      setOvJson(JSON.stringify(row.tactic_overrides, null, 2));
      setPrJson(JSON.stringify(row.presets, null, 2));
    } catch (e: unknown) {
      setTplErr(e instanceof Error ? e.message : String(e));
    } finally {
      setTplLoading(false);
    }
  }, []);

  useEffect(() => {
    if (tab === 'templates') void loadDraftJson();
  }, [tab, loadDraftJson]);

  const reloadUploads = useCallback(async () => {
    if (!projectKey.trim()) {
      setUploads([]);
      return;
    }
    try {
      const rows = await listProjectDocuments(projectKey.trim());
      setUploads(Array.isArray(rows) ? rows : []);
    } catch {
      setUploads([]);
    }
  }, [projectKey]);

  useEffect(() => {
    if (tab === 'uploads') void reloadUploads();
  }, [tab, reloadUploads]);

  const onCreateTactic = async (e: React.FormEvent) => {
    e.preventDefault();
    setLibMsg(null);
    setLibErr(null);
    if (!newKey.trim() || !newName.trim()) return;
    try {
      await createTacticLibrary({
        key: newKey.trim(),
        name: newName.trim(),
        description: newDesc.trim() || null,
        status: 'draft',
      });
      setNewKey('');
      setNewName('');
      setNewDesc('');
      setLibMsg('Created tactic.');
      await reloadLibrary();
    } catch (e: unknown) {
      setLibErr(e instanceof Error ? e.message : String(e));
    }
  };

  const inputCls =
    'mt-1 w-full rounded-md border border-app-border bg-app-fill p-1.5 text-xs text-app-text outline-none focus:border-indigo-400 focus:bg-app-surface dark:focus:border-indigo-500';

  const tabBtn = (t: Tab, label: string) => (
    <button
      key={t}
      type="button"
      onClick={() => setTab(t)}
      className={`rounded-md px-2 py-1 text-[11px] font-medium ${
        tab === t ? 'border border-indigo-500/40 bg-indigo-500/15 text-indigo-100' : 'border border-app-border bg-app-fill text-app-muted hover:bg-app-fill-hover'
      }`}
    >
      {label}
    </button>
  );

  return (
    <div className="space-y-3 text-xs text-app-text">
      <div className="flex flex-wrap gap-1">
        {tabBtn('factory', 'Brief factory')}
        {tabBtn('uploads', 'Uploads')}
        {tabBtn('templates', 'Templates (draft)')}
        {tabBtn('library', 'Tactic library')}
      </div>

      <div className="rounded-lg border border-app-border bg-app-surface p-2">
        <label className="block text-[10px] font-semibold uppercase tracking-wide text-app-muted">Project</label>
        <select value={projectKey} onChange={(e) => setProjectKey(e.target.value)} className={inputCls}>
          {projects.length === 0 && <option value="">No projects</option>}
          {projects.map((p: any) => (
            <option key={p.key} value={p.key}>
              {p.name} ({p.key})
            </option>
          ))}
        </select>
        {projErr ? <p className="mt-1 text-[11px] text-rose-600">{projErr}</p> : null}
      </div>

      {tab === 'library' ? (
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <input
              value={libQuery}
              onChange={(e) => setLibQuery(e.target.value)}
              placeholder="Filter tactics…"
              className={`${inputCls} max-w-xs`}
            />
            <button type="button" className="rounded-md border border-app-border bg-app-fill px-2 py-1 text-[11px]" onClick={() => void reloadLibrary()}>
              Refresh
            </button>
          </div>
          {libLoading ? <p className="text-app-muted">Loading…</p> : null}
          {libMsg ? <p className="rounded border border-emerald-500/30 bg-emerald-500/10 p-2 text-[11px]">{libMsg}</p> : null}
          {libErr ? <p className="rounded border border-rose-500/35 bg-rose-500/10 p-2 text-[11px]">{libErr}</p> : null}

          <form onSubmit={onCreateTactic} className="rounded-lg border border-app-border bg-app-fill/50 p-2">
            <div className="text-[10px] font-semibold text-app-text">Create tactic</div>
            <div className="mt-1 grid gap-1 desktop:grid-cols-3">
              <input value={newKey} onChange={(e) => setNewKey(e.target.value)} placeholder="key (slug)" className={inputCls} />
              <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="name" className={inputCls} />
              <input value={newDesc} onChange={(e) => setNewDesc(e.target.value)} placeholder="description" className={inputCls} />
            </div>
            <button type="submit" className="mt-1 rounded-md border border-indigo-500/40 bg-indigo-500/15 px-2 py-1 text-[11px] font-semibold text-indigo-100">
              Create
            </button>
          </form>

          <div className="overflow-x-auto rounded-lg border border-app-border">
            <table className="w-full min-w-[28rem] text-left text-[10px]">
              <thead className="border-b border-app-border text-app-muted">
                <tr>
                  <th className="p-2">Key</th>
                  <th className="p-2">Name</th>
                  <th className="p-2">Status</th>
                  <th className="p-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredLib.map((t: any) => (
                  <tr key={t.id} className="border-t border-app-border">
                    <td className="p-2 font-mono">{t.key}</td>
                    <td className="p-2">{t.name}</td>
                    <td className="p-2">{t.status}</td>
                    <td className="p-2 text-right">
                      <button
                        type="button"
                        className="text-sky-600 hover:underline"
                        onClick={() => setEditTacticId((id) => (id === String(t.id) ? null : String(t.id)))}
                      >
                        {editTacticId === String(t.id) ? 'Close' : 'Edit'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {editTacticId ? (
            <EditTacticForm
              key={editTacticId}
              tacticId={editTacticId}
              rows={libRows}
              inputCls={inputCls}
              onClose={() => setEditTacticId(null)}
              onSaved={() => {
                setLibMsg('Saved.');
                void reloadLibrary();
                setEditTacticId(null);
              }}
            />
          ) : null}
        </div>
      ) : null}

      {tab === 'templates' ? (
        <div className="space-y-2">
          <p className="text-[10px] text-app-muted">
            Edit JSON below. Save updates the draft row; Publish creates a new version and sets it active. If agent-api has{' '}
            <code className="rounded bg-app-fill px-0.5">BRIEF_OPS_TOKEN</code> set, configure{' '}
            <code className="rounded bg-app-fill px-0.5">NEXT_PUBLIC_BRIEF_OPS_TOKEN</code> on the dashboard build for the same value.
          </p>
          {tplLoading ? <p className="text-app-muted">Loading draft…</p> : null}
          {tplMsg ? <p className="rounded border border-emerald-500/30 bg-emerald-500/10 p-2 text-[11px]">{tplMsg}</p> : null}
          {tplErr ? <p className="rounded border border-rose-500/35 bg-rose-500/10 p-2 text-[11px]">{tplErr}</p> : null}
          <div>
            <div className="text-[10px] font-semibold text-app-muted">skeleton.json shape</div>
            <textarea value={skJson} onChange={(e) => setSkJson(e.target.value)} rows={12} spellCheck={false} className={`${inputCls} font-mono`} />
          </div>
          <div>
            <div className="text-[10px] font-semibold text-app-muted">tactic_overrides.json shape</div>
            <textarea value={ovJson} onChange={(e) => setOvJson(e.target.value)} rows={8} spellCheck={false} className={`${inputCls} font-mono`} />
          </div>
          <div>
            <div className="text-[10px] font-semibold text-app-muted">presets.json shape</div>
            <textarea value={prJson} onChange={(e) => setPrJson(e.target.value)} rows={10} spellCheck={false} className={`${inputCls} font-mono`} />
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="rounded-md border border-app-border bg-app-fill px-2 py-1 text-[11px]"
              onClick={() => void loadDraftJson()}
            >
              Reload draft
            </button>
            <button
              type="button"
              className="rounded-md border border-app-border bg-app-fill px-2 py-1 text-[11px]"
              onClick={async () => {
                setTplErr(null);
                setTplMsg(null);
                try {
                  const v = (await validateBriefTemplateDraft()) as { ok?: boolean; errors?: string[] };
                  setTplMsg(v.ok ? 'Validation OK.' : `Validation issues: ${(v.errors || []).join('; ')}`);
                } catch (e: unknown) {
                  setTplErr(e instanceof Error ? e.message : String(e));
                }
              }}
            >
              Validate draft
            </button>
            <button
              type="button"
              className="rounded-md border border-indigo-500/40 bg-indigo-500/15 px-2 py-1 text-[11px] font-semibold text-indigo-100"
              onClick={async () => {
                setTplErr(null);
                setTplMsg(null);
                try {
                  const skeleton = JSON.parse(skJson);
                  const tactic_overrides = JSON.parse(ovJson);
                  const presets = JSON.parse(prJson);
                  await putBriefTemplateDraft({ skeleton, tactic_overrides, presets });
                  setTplMsg('Draft saved.');
                } catch (e: unknown) {
                  setTplErr(e instanceof Error ? e.message : String(e));
                }
              }}
            >
              Save draft
            </button>
            <button
              type="button"
              className="rounded-md border border-emerald-500/35 bg-emerald-500/10 px-2 py-1 text-[11px] font-semibold text-emerald-100"
              onClick={async () => {
                setTplErr(null);
                setTplMsg(null);
                try {
                  await publishBriefTemplates({ label: 'manual publish' });
                  setTplMsg('Published.');
                  void reloadPublished();
                } catch (e: unknown) {
                  setTplErr(e instanceof Error ? e.message : String(e));
                }
              }}
            >
              Publish
            </button>
            <button
              type="button"
              className="rounded-md border border-app-border bg-app-fill px-2 py-1 text-[11px]"
              onClick={async () => {
                setTplErr(null);
                setTplMsg(null);
                try {
                  const r = await bootstrapBriefTemplates();
                  setTplMsg(r.skipped ? 'Bootstrap skipped (already published).' : 'Bootstrapped from defaults.');
                  void loadDraftJson();
                  void reloadPublished();
                } catch (e: unknown) {
                  setTplErr(e instanceof Error ? e.message : String(e));
                }
              }}
            >
              Bootstrap from defaults
            </button>
          </div>
        </div>
      ) : null}

      {tab === 'factory' ? (
        <div>
          {bundleLoading ? (
            <p className="text-app-muted">Loading template…</p>
          ) : (
            <>
              {fromApi && publishedVersion != null ? (
                <p className="mb-2 text-[10px] text-app-muted">
                  Factory uses published template <span className="font-mono">v{publishedVersion}</span>.
                </p>
              ) : (
                <p className="mb-2 text-[10px] text-app-muted">No published template — using bundled JSON until you publish or bootstrap.</p>
              )}
              <BriefFactoryInner
                projectKey={projectKey}
                bundle={bundle}
                documentAutofillId={autofillDocId}
                onDocumentAutofillIdChange={setAutofillDocId}
              />
            </>
          )}
        </div>
      ) : null}

      {tab === 'uploads' ? (
        <div className="space-y-2">
          <p className="text-[10px] text-app-muted">Uploads are queued for ingestion. When status is ready, select a row and switch to Brief factory to run autofill from chunks.</p>
          <label className="block text-[10px] font-semibold text-app-muted">Upload file</label>
          <input
            type="file"
            disabled={!projectKey.trim() || upBusy}
            onChange={async (e) => {
              const f = e.target.files?.[0];
              e.target.value = '';
              if (!f || !projectKey.trim()) return;
              setUpBusy(true);
              try {
                await uploadProjectDocument(projectKey.trim(), f, 'general');
                await reloadUploads();
              } catch (err: unknown) {
                alert(err instanceof Error ? err.message : String(err));
              } finally {
                setUpBusy(false);
              }
            }}
            className="text-[11px]"
          />
          <div className="overflow-x-auto rounded-lg border border-app-border">
            <table className="w-full min-w-[32rem] text-left text-[10px]">
              <thead className="border-b border-app-border text-app-muted">
                <tr>
                  <th className="p-2">File</th>
                  <th className="p-2">Kind</th>
                  <th className="p-2">Status</th>
                  <th className="p-2 text-right">Use for autofill</th>
                </tr>
              </thead>
              <tbody>
                {uploads.map((d: any) => (
                  <tr key={d.id} className="border-t border-app-border">
                    <td className="p-2">{String(d.original_filename ?? d.title ?? d.id)}</td>
                    <td className="p-2">{d.document_kind}</td>
                    <td className="p-2">{d.processing_status}</td>
                    <td className="p-2 text-right">
                      <button
                        type="button"
                        disabled={String(d.processing_status) !== 'ready'}
                        className="text-sky-600 hover:underline disabled:opacity-40"
                        onClick={() => {
                          setAutofillDocId(String(d.id));
                          setTab('factory');
                        }}
                      >
                        Select
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function EditTacticForm({
  tacticId,
  rows,
  inputCls,
  onClose,
  onSaved,
}: {
  tacticId: string;
  rows: Record<string, unknown>[];
  inputCls: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const row = rows.find((r: any) => String(r.id) === tacticId) as any;
  const [name, setName] = useState(row?.name ?? '');
  const [description, setDescription] = useState(row?.description ?? '');
  const [tacticKind, setTacticKind] = useState(row?.tactic_kind ?? '');
  const [channel, setChannel] = useState(row?.channel ?? '');
  const [medium, setMedium] = useState(row?.medium ?? '');
  const [format, setFormat] = useState(row?.format ?? '');
  const [status, setStatus] = useState<string>(row?.status ?? 'draft');
  const [err, setErr] = useState<string | null>(null);

  if (!row) return null;

  return (
    <div className="rounded-lg border border-app-border bg-app-fill/50 p-2">
      <div className="text-[10px] font-semibold">Edit {String(row.key)}</div>
      <div className="mt-1 grid gap-1 desktop:grid-cols-2">
        <input value={name} onChange={(e) => setName(e.target.value)} className={inputCls} placeholder="name" />
        <select value={status} onChange={(e) => setStatus(e.target.value)} className={inputCls}>
          <option value="draft">draft</option>
          <option value="active">active</option>
          <option value="archived">archived</option>
        </select>
        <input value={tacticKind} onChange={(e) => setTacticKind(e.target.value)} className={inputCls} placeholder="tactic_kind" />
        <input value={channel} onChange={(e) => setChannel(e.target.value)} className={inputCls} placeholder="channel" />
        <input value={medium} onChange={(e) => setMedium(e.target.value)} className={inputCls} placeholder="medium" />
        <input value={format} onChange={(e) => setFormat(e.target.value)} className={inputCls} placeholder="format" />
      </div>
      <textarea value={description} onChange={(e) => setDescription(e.target.value)} className={`${inputCls} mt-1 h-20`} placeholder="description" />
      {err ? <p className="mt-1 text-[11px] text-rose-600">{err}</p> : null}
      <div className="mt-2 flex gap-2">
        <button type="button" className="rounded-md border border-app-border bg-app-surface px-2 py-1 text-[11px]" onClick={onClose}>
          Cancel
        </button>
        <button
          type="button"
          className="rounded-md border border-indigo-500/40 bg-indigo-500/15 px-2 py-1 text-[11px] font-semibold text-indigo-100"
          onClick={async () => {
            setErr(null);
            try {
              await patchTacticLibrary(tacticId, {
                name: name.trim() || undefined,
                description: description.trim() || undefined,
                tactic_kind: tacticKind.trim() || undefined,
                channel: channel.trim() || undefined,
                medium: medium.trim() || undefined,
                format: format.trim() || undefined,
                status,
              });
              onSaved();
            } catch (e: unknown) {
              setErr(e instanceof Error ? e.message : String(e));
            }
          }}
        >
          Save library row
        </button>
      </div>
    </div>
  );
}

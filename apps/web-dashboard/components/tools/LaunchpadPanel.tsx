'use client';

import { useEffect, useMemo, useState } from 'react';

import { createAsset, createLaunch, exportLaunchCsv, nowIso, summarizeLaunch } from '../../lib/launchpad/engine';
import { inspectLaunchpadFiles } from '../../lib/launchpad/zipInspect';
import { demoLaunch, loadActiveLaunchId, loadLaunches, saveActiveLaunchId, saveLaunches } from '../../lib/launchpad/storage';
import {
  CATEGORY_LABELS,
  CHANNEL_LABELS,
  type LaunchpadAsset,
  type LaunchpadChannel,
  type LaunchpadChecklistItem,
  type LaunchpadFinding,
  type LaunchpadGate,
  type LaunchpadLaunch,
  type LaunchpadStatus,
} from '../../lib/launchpad/types';

const statusOptions: LaunchpadStatus[] = ['not_started', 'in_progress', 'complete', 'blocked', 'not_applicable'];
const channelOptions: LaunchpadChannel[] = ['veeva_rte', 'veeva_clm', 'media', 'web', 'crm_email', 'print_pdf', 'other'];

function cx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(' ');
}

function statusLabel(status: LaunchpadStatus): string {
  return status.replace(/_/g, ' ').replace(/\b\w/g, (m) => m.toUpperCase());
}

function gateClasses(gate: LaunchpadGate) {
  if (gate === 'ready') return 'border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-200';
  if (gate === 'blocked') return 'border-rose-500/40 bg-rose-500/10 text-rose-700 dark:text-rose-200';
  if (gate === 'yellow') return 'border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-100';
  return 'border-app-border bg-app-fill text-app-muted';
}

function findingClasses(severity: LaunchpadFinding['severity']) {
  if (severity === 'blocker') return 'border-rose-500/30 bg-rose-500/10';
  if (severity === 'warning') return 'border-amber-500/30 bg-amber-500/10';
  return 'border-app-border bg-app-fill/70';
}

function pct(score: number | null) {
  return score == null ? 'N/A' : `${score}%`;
}

function downloadText(filename: string, text: string, type = 'text/plain') {
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function applyLaunchPatch(launches: LaunchpadLaunch[], activeId: string, patcher: (launch: LaunchpadLaunch) => LaunchpadLaunch) {
  return launches.map((launch) => (launch.id === activeId ? patcher(launch) : launch));
}

function LaunchHeader({ launch, onChange }: { launch: LaunchpadLaunch; onChange: (patch: Partial<LaunchpadLaunch>) => void }) {
  return (
    <div className="grid grid-cols-1 gap-2 rounded-xl border border-app-border bg-app-surface p-3 tablet:grid-cols-5">
      <label className="tablet:col-span-2">
        <span className="text-[10px] font-semibold uppercase tracking-wide text-app-muted">Launch name</span>
        <input value={launch.name} onChange={(e) => onChange({ name: e.target.value })} className="mt-1 w-full rounded-md border border-app-border bg-app-fill p-2 text-xs text-app-text" />
      </label>
      <label>
        <span className="text-[10px] font-semibold uppercase tracking-wide text-app-muted">Brand</span>
        <input value={launch.brand || ''} onChange={(e) => onChange({ brand: e.target.value })} className="mt-1 w-full rounded-md border border-app-border bg-app-fill p-2 text-xs text-app-text" />
      </label>
      <label>
        <span className="text-[10px] font-semibold uppercase tracking-wide text-app-muted">Owner</span>
        <input value={launch.owner || ''} onChange={(e) => onChange({ owner: e.target.value })} className="mt-1 w-full rounded-md border border-app-border bg-app-fill p-2 text-xs text-app-text" />
      </label>
      <label>
        <span className="text-[10px] font-semibold uppercase tracking-wide text-app-muted">Target launch</span>
        <input type="date" value={launch.targetLaunchDate || ''} onChange={(e) => onChange({ targetLaunchDate: e.target.value })} className="mt-1 w-full rounded-md border border-app-border bg-app-fill p-2 text-xs text-app-text" />
      </label>
    </div>
  );
}

function AddAssetForm({ onAdd }: { onAdd: (asset: LaunchpadAsset) => void }) {
  const [name, setName] = useState('');
  const [channel, setChannel] = useState<LaunchpadChannel>('veeva_rte');
  const [owner, setOwner] = useState('');
  const [vendor, setVendor] = useState('');

  return (
    <div className="rounded-xl border border-app-border bg-app-surface p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-app-text">Add launch asset</h3>
        <span className="rounded bg-app-fill px-2 py-1 text-[10px] font-medium text-app-muted">Template-driven checklist</span>
      </div>
      <div className="grid grid-cols-1 gap-2 tablet:grid-cols-5">
        <input placeholder="Asset name" value={name} onChange={(e) => setName(e.target.value)} className="rounded-md border border-app-border bg-app-fill p-2 text-xs text-app-text tablet:col-span-2" />
        <select value={channel} onChange={(e) => setChannel(e.target.value as LaunchpadChannel)} className="rounded-md border border-app-border bg-app-fill p-2 text-xs text-app-text">
          {channelOptions.map((c) => <option key={c} value={c}>{CHANNEL_LABELS[c]}</option>)}
        </select>
        <input placeholder="Owner" value={owner} onChange={(e) => setOwner(e.target.value)} className="rounded-md border border-app-border bg-app-fill p-2 text-xs text-app-text" />
        <input placeholder="Vendor / deploy team" value={vendor} onChange={(e) => setVendor(e.target.value)} className="rounded-md border border-app-border bg-app-fill p-2 text-xs text-app-text" />
      </div>
      <button
        type="button"
        onClick={() => {
          const trimmed = name.trim();
          if (!trimmed) return;
          onAdd(createAsset({ name: trimmed, channel, owner, vendor }));
          setName('');
          setOwner('');
          setVendor('');
        }}
        className="mt-2 rounded-md border border-nav-active-border bg-nav-active-bg px-3 py-1.5 text-xs font-semibold text-nav-active-fg hover:opacity-90"
      >
        Add asset
      </button>
    </div>
  );
}

function AssetCard({
  asset,
  onChecklistChange,
  onAssetChange,
  onDelete,
  onFileFindings,
}: {
  asset: LaunchpadAsset;
  onChecklistChange: (itemId: string, patch: Partial<LaunchpadChecklistItem>) => void;
  onAssetChange: (patch: Partial<LaunchpadAsset>) => void;
  onDelete: () => void;
  onFileFindings: (findings: LaunchpadFinding[], fileNames: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const [fileNames, setFileNames] = useState<string[]>(asset.fileNames || []);

  useEffect(() => {
    setFileNames(asset.fileNames || []);
  }, [asset.fileNames]);

  const summary = useMemo(() => summarizeLaunch({ id: 'tmp', name: 'tmp', assets: [asset], findings: [], createdAt: asset.createdAt, updatedAt: asset.updatedAt }), [asset]);

  return (
    <section className="rounded-xl border border-app-border bg-app-surface p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="truncate text-sm font-semibold text-app-text">{asset.name}</h3>
            <span className="rounded bg-app-fill px-2 py-1 text-[10px] font-medium text-app-muted">{CHANNEL_LABELS[asset.channel]}</span>
            <span className={cx('rounded border px-2 py-1 text-[10px] font-semibold uppercase', gateClasses(summary.gate))}>{summary.gate.replace(/_/g, ' ')}</span>
          </div>
          <p className="mt-1 text-[11px] text-app-muted">{summary.score}% ready · {summary.blockers.length} blockers · {summary.warnings.length} warnings</p>
        </div>
        <div className="flex flex-wrap gap-1">
          <button type="button" onClick={() => setOpen((v) => !v)} className="rounded-md border border-app-border bg-app-fill px-2 py-1 text-[11px] font-medium text-app-text hover:bg-app-fill-hover">{open ? 'Collapse' : 'Open'}</button>
          <button type="button" onClick={onDelete} className="rounded-md border border-rose-500/30 bg-rose-500/10 px-2 py-1 text-[11px] font-medium text-rose-700 dark:text-rose-200">Delete</button>
        </div>
      </div>

      {open ? (
        <div className="mt-3 space-y-3 border-t border-app-border pt-3">
          <div className="grid grid-cols-1 gap-2 tablet:grid-cols-4">
            <input value={asset.name} onChange={(e) => onAssetChange({ name: e.target.value })} className="rounded-md border border-app-border bg-app-fill p-2 text-xs text-app-text" />
            <input placeholder="Owner" value={asset.owner || ''} onChange={(e) => onAssetChange({ owner: e.target.value })} className="rounded-md border border-app-border bg-app-fill p-2 text-xs text-app-text" />
            <input placeholder="Vendor" value={asset.vendor || ''} onChange={(e) => onAssetChange({ vendor: e.target.value })} className="rounded-md border border-app-border bg-app-fill p-2 text-xs text-app-text" />
            <input type="date" value={asset.launchDate || ''} onChange={(e) => onAssetChange({ launchDate: e.target.value })} className="rounded-md border border-app-border bg-app-fill p-2 text-xs text-app-text" />
          </div>

          <div className="rounded-lg border border-app-border bg-app-fill/40 p-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-xs font-semibold text-app-text">Package/file inspection</p>
                <p className="text-[11px] text-app-muted">Upload a ZIP or a set of files. Launchpad reads ZIP filenames client-side and flags obvious launch risks.</p>
              </div>
              <label className="cursor-pointer rounded-md border border-app-border bg-app-surface px-2 py-1 text-[11px] font-medium text-app-text hover:bg-app-fill-hover">
                Inspect files
                <input
                  type="file"
                  multiple
                  className="hidden"
                  onChange={async (e) => {
                    const files = e.target.files;
                    if (!files?.length) return;
                    const inventory = await inspectLaunchpadFiles(files);
                    setFileNames(inventory.fileNames.slice(0, 20));
                    onFileFindings(inventory.findings, inventory.fileNames);
                    e.currentTarget.value = '';
                  }}
                />
              </label>
            </div>
            {fileNames.length ? <p className="mt-2 text-[10px] text-app-muted">Detected: {fileNames.slice(0, 8).join(', ')}{fileNames.length > 8 ? ` +${fileNames.length - 8} more` : ''}</p> : null}
          </div>

          <div className="overflow-x-auto rounded-lg border border-app-border">
            <table className="min-w-full divide-y divide-app-border text-left text-xs">
              <thead className="bg-app-fill text-[10px] uppercase tracking-wide text-app-muted">
                <tr>
                  <th className="px-2 py-2">Category</th>
                  <th className="px-2 py-2">Requirement</th>
                  <th className="px-2 py-2">Status</th>
                  <th className="px-2 py-2">Owner</th>
                  <th className="px-2 py-2">Evidence / notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-app-border">
                {asset.checklist.map((item) => (
                  <tr key={item.id} className="align-top">
                    <td className="px-2 py-2 text-app-muted">{CATEGORY_LABELS[item.category]}</td>
                    <td className="px-2 py-2">
                      <div className="font-medium text-app-text">{item.label}</div>
                      <div className="text-[10px] text-app-muted">{item.required ? 'Required' : 'Optional'} · missing = {item.severityIfMissing}</div>
                    </td>
                    <td className="px-2 py-2">
                      <select value={item.status} onChange={(e) => onChecklistChange(item.id, { status: e.target.value as LaunchpadStatus })} className="w-32 rounded border border-app-border bg-app-fill p-1 text-[11px] text-app-text">
                        {statusOptions.map((s) => <option key={s} value={s}>{statusLabel(s)}</option>)}
                      </select>
                    </td>
                    <td className="px-2 py-2">
                      <input value={item.owner || ''} onChange={(e) => onChecklistChange(item.id, { owner: e.target.value })} className="w-28 rounded border border-app-border bg-app-fill p-1 text-[11px] text-app-text" />
                    </td>
                    <td className="px-2 py-2">
                      <input placeholder="Evidence link" value={item.evidence || ''} onChange={(e) => onChecklistChange(item.id, { evidence: e.target.value })} className="mb-1 w-48 rounded border border-app-border bg-app-fill p-1 text-[11px] text-app-text" />
                      <input placeholder="Notes" value={item.notes || ''} onChange={(e) => onChecklistChange(item.id, { notes: e.target.value })} className="w-48 rounded border border-app-border bg-app-fill p-1 text-[11px] text-app-text" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
    </section>
  );
}

function SummaryCards({ summary }: { summary: ReturnType<typeof summarizeLaunch> }) {
  return (
    <div className="grid grid-cols-2 gap-2 desktop:grid-cols-5">
      <div className="rounded-xl border border-app-border bg-app-surface p-3">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-app-muted">Readiness</p>
        <p className="mt-1 text-2xl font-bold text-app-text">{summary.score}%</p>
      </div>
      <div className={cx('rounded-xl border p-3', gateClasses(summary.gate))}>
        <p className="text-[10px] font-semibold uppercase tracking-wide">Gate</p>
        <p className="mt-1 text-lg font-bold capitalize">{summary.gate.replace(/_/g, ' ')}</p>
      </div>
      <div className="rounded-xl border border-app-border bg-app-surface p-3">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-app-muted">Assets ready</p>
        <p className="mt-1 text-lg font-bold text-app-text">{summary.readyAssets}/{summary.totalAssets}</p>
      </div>
      <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-3">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-rose-700 dark:text-rose-200">Blockers</p>
        <p className="mt-1 text-lg font-bold text-rose-700 dark:text-rose-200">{summary.blockers.length}</p>
      </div>
      <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-100">Warnings</p>
        <p className="mt-1 text-lg font-bold text-amber-700 dark:text-amber-100">{summary.warnings.length}</p>
      </div>
    </div>
  );
}

function CategoryGrid({ summary }: { summary: ReturnType<typeof summarizeLaunch> }) {
  return (
    <div className="grid grid-cols-2 gap-2 desktop:grid-cols-4">
      {summary.categoryScores.map((cat) => (
        <div key={cat.category} className={cx('rounded-lg border p-2', gateClasses(cat.gate))}>
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-semibold">{CATEGORY_LABELS[cat.category]}</span>
            <span className="text-[11px] font-bold">{pct(cat.score)}</span>
          </div>
          <div className="mt-1 text-[10px] opacity-80">{cat.completed}/{cat.total} complete · {cat.blockers} blockers</div>
        </div>
      ))}
    </div>
  );
}

function FindingsPanel({ title, findings }: { title: string; findings: LaunchpadFinding[] }) {
  return (
    <div className="rounded-xl border border-app-border bg-app-surface p-3">
      <h3 className="text-sm font-semibold text-app-text">{title}</h3>
      <div className="mt-2 space-y-2">
        {findings.length ? findings.slice(0, 8).map((f) => (
          <div key={f.id} className={cx('rounded-lg border p-2', findingClasses(f.severity))}>
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded bg-app-surface px-1.5 py-0.5 text-[10px] font-semibold uppercase text-app-muted">{f.severity}</span>
              <span className="text-xs font-semibold text-app-text">{f.title}</span>
            </div>
            <p className="mt-1 text-[11px] leading-relaxed text-app-muted">{f.detail}</p>
            {f.recommendedAction ? <p className="mt-1 text-[11px] font-medium text-app-text">Next: {f.recommendedAction}</p> : null}
          </div>
        )) : <p className="text-[11px] text-app-muted">Nothing flagged in this group.</p>}
      </div>
    </div>
  );
}

export function LaunchpadPanel({ projectKey }: { projectKey?: string }) {
  const [launches, setLaunches] = useState<LaunchpadLaunch[]>([]);
  const [activeId, setActiveId] = useState('');

  useEffect(() => {
    const loaded = loadLaunches();
    const initial = loaded.length ? loaded : [demoLaunch()];
    const savedActive = loadActiveLaunchId();
    setLaunches(initial);
    setActiveId(savedActive && initial.some((x) => x.id === savedActive) ? savedActive : initial[0]?.id || '');
  }, []);

  useEffect(() => {
    if (!launches.length) return;
    saveLaunches(launches);
  }, [launches]);

  useEffect(() => {
    if (activeId) saveActiveLaunchId(activeId);
  }, [activeId]);

  const active = launches.find((x) => x.id === activeId) || null;
  const summary = useMemo(() => (active ? summarizeLaunch(active) : null), [active]);

  function patchActive(patcher: (launch: LaunchpadLaunch) => LaunchpadLaunch) {
    if (!activeId) return;
    setLaunches((rows) => applyLaunchPatch(rows, activeId, (launch) => ({ ...patcher(launch), updatedAt: nowIso() })));
  }

  if (!active || !summary) {
    return <div className="rounded-xl border border-app-border bg-app-surface p-4 text-sm text-app-muted">Loading Launchpad…</div>;
  }

  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-app-border bg-gradient-to-br from-indigo-500/10 to-app-surface p-4 shadow-xs">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded bg-nav-active-bg px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-nav-active-fg">Launchpad</span>
              {projectKey ? <span className="rounded bg-app-fill px-2 py-1 text-[10px] font-medium text-app-muted">Project: {projectKey}</span> : null}
            </div>
            <h2 className="mt-2 text-xl font-bold tracking-tight text-app-text">Launch Control for approvals, QA, packages, vendors, and post-launch proof</h2>
            <p className="mt-1 max-w-4xl text-xs leading-relaxed text-app-muted">Use this as the launch-week truth layer. Build an asset list, let channel templates create the checklist, inspect packages, flag blockers, and generate internal/client/vendor status without waiting for backend integrations.</p>
          </div>
          <div className="flex flex-wrap gap-1">
            <select value={activeId} onChange={(e) => setActiveId(e.target.value)} className="rounded-md border border-app-border bg-app-fill p-2 text-xs text-app-text">
              {launches.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
            </select>
            <button type="button" onClick={() => {
              const launch = createLaunch({ name: `Launch ${launches.length + 1}` });
              setLaunches((rows) => [...rows, launch]);
              setActiveId(launch.id);
            }} className="rounded-md border border-app-border bg-app-fill px-2 py-1 text-xs font-medium text-app-text hover:bg-app-fill-hover">New launch</button>
            <button
              type="button"
              disabled={launches.length <= 1}
              onClick={() => {
                if (launches.length <= 1) return;
                const nextRows = launches.filter((launch) => launch.id !== activeId);
                setLaunches(nextRows);
                setActiveId(nextRows[0]?.id || '');
              }}
              className="rounded-md border border-rose-500/30 bg-rose-500/10 px-2 py-1 text-xs font-medium text-rose-700 disabled:cursor-not-allowed disabled:opacity-40 dark:text-rose-200"
            >
              Delete launch
            </button>
          </div>
        </div>
      </div>

      <LaunchHeader launch={active} onChange={(patch) => patchActive((l) => ({ ...l, ...patch }))} />
      <SummaryCards summary={summary} />
      <CategoryGrid summary={summary} />

      <div className="grid grid-cols-1 gap-3 desktop:grid-cols-[minmax(0,1fr)_minmax(20rem,26rem)]">
        <div className="space-y-3">
          <AddAssetForm onAdd={(asset) => patchActive((l) => ({ ...l, assets: [...l.assets, asset] }))} />
          {active.assets.length ? active.assets.map((asset) => (
            <AssetCard
              key={asset.id}
              asset={asset}
              onDelete={() => patchActive((l) => ({ ...l, assets: l.assets.filter((a) => a.id !== asset.id) }))}
              onAssetChange={(patch) => patchActive((l) => ({ ...l, assets: l.assets.map((a) => a.id === asset.id ? { ...a, ...patch, updatedAt: nowIso() } : a) }))}
              onChecklistChange={(itemId, patch) => patchActive((l) => ({ ...l, assets: l.assets.map((a) => a.id === asset.id ? { ...a, checklist: a.checklist.map((item) => item.id === itemId ? { ...item, ...patch } : item), updatedAt: nowIso() } : a) }))}
              onFileFindings={(findings, fileNames) => patchActive((l) => ({ ...l, assets: l.assets.map((a) => a.id === asset.id ? { ...a, fileFindings: findings, fileNames, updatedAt: nowIso() } : a) }))}
            />
          )) : (
            <div className="rounded-xl border border-dashed border-app-border bg-app-surface p-6 text-center text-sm text-app-muted">Add the first asset to start the launch readiness score.</div>
          )}
        </div>

        <aside className="space-y-3">
          <FindingsPanel title="What is blocking launch?" findings={summary.blockers} />
          <FindingsPanel title="Warnings" findings={summary.warnings} />
          <div className="rounded-xl border border-app-border bg-app-surface p-3">
            <h3 className="text-sm font-semibold text-app-text">Generated status</h3>
            <div className="mt-2 space-y-2">
              <div className="rounded-lg border border-app-border bg-app-fill/60 p-2"><p className="text-[10px] font-bold uppercase text-app-muted">Internal</p><p className="mt-1 text-[11px] leading-relaxed text-app-text">{summary.internalSummary}</p></div>
              <div className="rounded-lg border border-app-border bg-app-fill/60 p-2"><p className="text-[10px] font-bold uppercase text-app-muted">Client-safe</p><p className="mt-1 text-[11px] leading-relaxed text-app-text">{summary.clientSummary}</p></div>
              <div className="rounded-lg border border-app-border bg-app-fill/60 p-2"><p className="text-[10px] font-bold uppercase text-app-muted">Vendor handoff</p><p className="mt-1 text-[11px] leading-relaxed text-app-text">{summary.vendorSummary}</p></div>
            </div>
            <div className="mt-3 flex flex-wrap gap-1">
              <button type="button" onClick={() => navigator.clipboard?.writeText(summary.internalSummary)} className="rounded-md border border-app-border bg-app-fill px-2 py-1 text-[11px] font-medium text-app-text hover:bg-app-fill-hover">Copy internal</button>
              <button type="button" onClick={() => navigator.clipboard?.writeText(summary.clientSummary)} className="rounded-md border border-app-border bg-app-fill px-2 py-1 text-[11px] font-medium text-app-text hover:bg-app-fill-hover">Copy client</button>
              <button type="button" onClick={() => navigator.clipboard?.writeText(summary.vendorSummary)} className="rounded-md border border-app-border bg-app-fill px-2 py-1 text-[11px] font-medium text-app-text hover:bg-app-fill-hover">Copy vendor</button>
            </div>
          </div>

          <div className="rounded-xl border border-app-border bg-app-surface p-3">
            <h3 className="text-sm font-semibold text-app-text">Exports</h3>
            <p className="mt-1 text-[11px] text-app-muted">Local-first exports for handoff, Workfront task shaping, archive binders, or quick status packets.</p>
            <div className="mt-2 flex flex-wrap gap-1">
              <button type="button" onClick={() => downloadText(`${active.name.replace(/\W+/g, '_')}_launchpad.json`, JSON.stringify(active, null, 2), 'application/json')} className="rounded-md border border-app-border bg-app-fill px-2 py-1 text-[11px] font-medium text-app-text hover:bg-app-fill-hover">Export JSON</button>
              <button type="button" onClick={() => downloadText(`${active.name.replace(/\W+/g, '_')}_readiness.csv`, exportLaunchCsv(active), 'text/csv')} className="rounded-md border border-app-border bg-app-fill px-2 py-1 text-[11px] font-medium text-app-text hover:bg-app-fill-hover">Export CSV</button>
              <button type="button" onClick={() => downloadText(`${active.name.replace(/\W+/g, '_')}_status.md`, `# ${active.name}\n\n## Internal status\n${summary.internalSummary}\n\n## Client-safe status\n${summary.clientSummary}\n\n## Vendor handoff\n${summary.vendorSummary}\n\n## Next actions\n${summary.nextActions.map((a) => `- ${a}`).join('\n') || '- No next actions flagged.'}\n`, 'text/markdown')} className="rounded-md border border-app-border bg-app-fill px-2 py-1 text-[11px] font-medium text-app-text hover:bg-app-fill-hover">Export status MD</button>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

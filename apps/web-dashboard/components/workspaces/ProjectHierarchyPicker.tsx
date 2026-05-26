'use client';

import { useMemo } from 'react';
import { inputClass } from '../../lib/workspaces/styles';

type Tree = { workspaces?: any[] } | null;
type Proj = {
  key: string;
  name?: string;
  workspace_key?: string;
  client_key?: string;
  brand_key?: string;
  brand_id?: string;
};

export function ProjectHierarchyPicker({
  tree,
  projects,
  selectedKey,
  onSelectKey,
  workspaceKey,
  clientId,
  brandId,
  onWorkspaceChange,
  onClientChange,
  onBrandChange,
  onWorkspaceKeyForForms,
}: {
  tree: Tree;
  projects: Proj[];
  selectedKey: string;
  onSelectKey: (key: string) => void;
  workspaceKey: string;
  clientId: string;
  brandId: string;
  onWorkspaceChange: (wk: string) => void;
  onClientChange: (cid: string) => void;
  onBrandChange: (bid: string) => void;
  onWorkspaceKeyForForms?: (wk: string) => void;
}) {
  const wsList = tree?.workspaces || [];
  const wk = workspaceKey;
  const cid = clientId;
  const bid = brandId;

  const clients = useMemo(() => {
    const w = wsList.find((x: any) => x.workspace?.key === wk);
    return w?.clients || [];
  }, [wsList, wk]);

  const brands = useMemo(() => {
    const c = clients.find((x: any) => String(x.client?.id) === cid);
    return c?.brands || [];
  }, [clients, cid]);

  const filteredProjects = useMemo(() => {
    let out = projects;
    if (wk) out = out.filter((p) => p.workspace_key === wk);
    if (cid) {
      const ck = clients.find((x: any) => String(x.client?.id) === cid)?.client?.key;
      if (ck) out = out.filter((p) => p.client_key === ck);
    }
    if (bid) out = out.filter((p) => String(p.brand_id) === bid);
    return out;
  }, [projects, wk, cid, bid, clients]);

  return (
    <div className="flex min-w-0 flex-1 flex-col gap-2 tablet:max-w-xl tablet:flex-row tablet:flex-wrap tablet:items-end">
      <div className="min-w-0 tablet:w-36">
          <label className="text-[9px] font-semibold uppercase tracking-wide text-app-muted">Workspace</label>
          <select
            value={wk}
            onChange={(e) => {
              const next = e.target.value;
              onWorkspaceChange(next);
              onClientChange('');
              onBrandChange('');
              onWorkspaceKeyForForms?.(next);
            }}
            className={`${inputClass} mt-0.5 bg-app-surface`}
          >
            {wsList.length === 0 && <option value="">No workspaces</option>}
            {wsList.map((wrap: any) => {
              const k = wrap.workspace?.key as string;
              if (!k) return null;
              return (
                <option key={k} value={k}>
                  {k}
                </option>
              );
            })}
          </select>
        </div>
        <div className="min-w-0 tablet:w-36">
          <label className="text-[9px] font-semibold uppercase tracking-wide text-app-muted">Client</label>
          <select
            value={cid}
            onChange={(e) => onClientChange(e.target.value)}
            className={`${inputClass} mt-0.5 bg-app-surface`}
            disabled={!wk}
          >
            {clients.length === 0 && <option value="">—</option>}
            {(clients as any[]).map((cwrap: any) => {
              const id = String(cwrap.client?.id || '');
              const ck = cwrap.client?.key as string;
              return (
                <option key={id} value={id}>
                  {ck}
                </option>
              );
            })}
          </select>
        </div>
        <div className="min-w-0 tablet:w-36">
          <label className="text-[9px] font-semibold uppercase tracking-wide text-app-muted">Brand</label>
          <select
            value={bid}
            onChange={(e) => onBrandChange(e.target.value)}
            className={`${inputClass} mt-0.5 bg-app-surface`}
            disabled={!cid}
          >
            {brands.length === 0 && <option value="">—</option>}
            {(brands as any[]).map((bwrap: any) => {
              const id = String(bwrap.brand?.id || '');
              const bk = bwrap.brand?.key as string;
              return (
                <option key={id} value={id}>
                  {bk}
                </option>
              );
            })}
          </select>
        </div>
        <div className="min-w-0 flex-1 tablet:max-w-md">
          <label className="text-[9px] font-semibold uppercase tracking-wide text-app-muted">Project</label>
          <select
            value={selectedKey}
            onChange={(e) => onSelectKey(e.target.value)}
            className={`${inputClass} mt-0.5 bg-app-surface`}
          >
            {filteredProjects.length === 0 && <option value="">No projects in this path</option>}
            {filteredProjects.map((p) => (
              <option key={p.key} value={p.key}>
                {p.name} ({p.key})
              </option>
            ))}
          </select>
        </div>
    </div>
  );
}

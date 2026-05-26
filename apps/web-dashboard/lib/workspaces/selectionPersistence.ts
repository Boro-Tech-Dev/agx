import { STORAGE_PROJECT, STORAGE_WORKSPACE } from './constants';

/** Versioned workspaces page selection (project + hierarchy path). */
export const STORAGE_WORKSPACES_SELECTION = 'dd.workspaces_selection_v1';

export type WorkspacesSelectionPersisted = {
  projectKey: string;
  workspaceKey: string;
  clientId: string;
  brandId: string;
};

export type WorkspacesSelectionPartial = Partial<WorkspacesSelectionPersisted>;

function readFromUrl(): WorkspacesSelectionPartial {
  if (typeof window === 'undefined') return {};
  const p = new URLSearchParams(window.location.search);
  const projectKey = p.get('project')?.trim() || '';
  const workspaceKey = p.get('workspace')?.trim() || '';
  const clientId = p.get('client')?.trim() || '';
  const brandId = p.get('brand')?.trim() || '';
  const out: WorkspacesSelectionPartial = {};
  if (projectKey) out.projectKey = projectKey;
  if (workspaceKey) out.workspaceKey = workspaceKey;
  if (clientId) out.clientId = clientId;
  if (brandId) out.brandId = brandId;
  return out;
}

function readFromStorageBlob(): WorkspacesSelectionPartial {
  if (typeof localStorage === 'undefined') return {};
  try {
    const raw = localStorage.getItem(STORAGE_WORKSPACES_SELECTION);
    if (!raw) return {};
    const o = JSON.parse(raw) as Record<string, unknown>;
    const out: WorkspacesSelectionPartial = {};
    if (typeof o.projectKey === 'string' && o.projectKey) out.projectKey = o.projectKey;
    if (typeof o.workspaceKey === 'string' && o.workspaceKey) out.workspaceKey = o.workspaceKey;
    if (typeof o.clientId === 'string' && o.clientId) out.clientId = o.clientId;
    if (typeof o.brandId === 'string' && o.brandId) out.brandId = o.brandId;
    return out;
  } catch {
    return {};
  }
}

function readLegacyStorage(): WorkspacesSelectionPartial {
  if (typeof localStorage === 'undefined') return {};
  const projectKey = localStorage.getItem(STORAGE_PROJECT)?.trim() || '';
  const workspaceKey = localStorage.getItem(STORAGE_WORKSPACE)?.trim() || '';
  const out: WorkspacesSelectionPartial = {};
  if (projectKey) out.projectKey = projectKey;
  if (workspaceKey) out.workspaceKey = workspaceKey;
  return out;
}

/** URL wins, then versioned blob, then legacy project/workspace keys. */
export function readPersistedWorkspacesSelection(): WorkspacesSelectionPartial {
  return { ...readLegacyStorage(), ...readFromStorageBlob(), ...readFromUrl() };
}

export function writePersistedWorkspacesSelection(patch: WorkspacesSelectionPartial): void {
  if (typeof localStorage === 'undefined') return;
  const prev = { ...readLegacyStorage(), ...readFromStorageBlob(), ...patch };
  try {
    const next: WorkspacesSelectionPersisted = {
      projectKey: prev.projectKey || '',
      workspaceKey: prev.workspaceKey || '',
      clientId: prev.clientId || '',
      brandId: prev.brandId || '',
    };
    localStorage.setItem(STORAGE_WORKSPACES_SELECTION, JSON.stringify(next));
    if (next.projectKey) localStorage.setItem(STORAGE_PROJECT, next.projectKey);
    if (next.workspaceKey) localStorage.setItem(STORAGE_WORKSPACE, next.workspaceKey);
  } catch {
    /* ignore quota */
  }
}

export function workspacesSelectionSearchParams(sel: WorkspacesSelectionPartial): URLSearchParams {
  const qs = new URLSearchParams();
  if (sel.projectKey) qs.set('project', sel.projectKey);
  if (sel.workspaceKey) qs.set('workspace', sel.workspaceKey);
  if (sel.clientId) qs.set('client', sel.clientId);
  if (sel.brandId) qs.set('brand', sel.brandId);
  return qs;
}

export function workspacesSelectionPath(sel: WorkspacesSelectionPartial): string {
  const qs = workspacesSelectionSearchParams(sel);
  const s = qs.toString();
  return s ? `/workspaces?${s}` : '/workspaces';
}

/** First client render: hydrate selection before async tree/projects load. */
export function readInitialWorkspacesSelection(): {
  selectedKey: string;
  clientWsKey: string;
  pickClientId: string;
  pickBrandId: string;
} {
  if (typeof window === 'undefined') {
    return { selectedKey: '', clientWsKey: '', pickClientId: '', pickBrandId: '' };
  }
  const p = readPersistedWorkspacesSelection();
  return {
    selectedKey: p.projectKey || '',
    clientWsKey: p.workspaceKey || '',
    pickClientId: p.clientId || '',
    pickBrandId: p.brandId || '',
  };
}

import { STORAGE_WORKSPACES_UI } from './constants';

export const LAYOUT_VERSION = 1 as const;

/** Stable ids for sortable / hideable panels. */
export const WORKSPACES_PANEL_IDS = [
  'currentProjectChrome',
  'tactics',
  'projectItems',
  'projectFiles',
  'narrative',
  'setupHierarchy',
  'bulkImport',
  'workspaceAdmin',
  'hierarchyOverview',
  'rawJson',
] as const;

export type WorkspacesPanelId = (typeof WORKSPACES_PANEL_IDS)[number];

export type WorkspacesLayoutV1 = {
  version: typeof LAYOUT_VERSION;
  /** Top-to-bottom order (only listed panels render; unknown ids ignored). */
  order: WorkspacesPanelId[];
  /** When true, panel is omitted from render. */
  hidden: Partial<Record<WorkspacesPanelId, boolean>>;
  /** When true, panel body is collapsed (header row remains visible). */
  collapsed: Partial<Record<WorkspacesPanelId, boolean>>;
  /** Panel layout toolbar: description + visibility chips (header row always shown). */
  panelLayoutToolbarExpanded: boolean;
};

export const DEFAULT_WORKSPACES_LAYOUT: WorkspacesLayoutV1 = {
  version: LAYOUT_VERSION,
  order: [...WORKSPACES_PANEL_IDS],
  hidden: {},
  collapsed: {},
  panelLayoutToolbarExpanded: true,
};

function isPanelId(s: string): s is WorkspacesPanelId {
  return (WORKSPACES_PANEL_IDS as readonly string[]).includes(s);
}

export function normalizeLayout(raw: unknown): WorkspacesLayoutV1 {
  if (!raw || typeof raw !== 'object') return { ...DEFAULT_WORKSPACES_LAYOUT };
  const o = raw as Record<string, unknown>;
  if (o.version !== LAYOUT_VERSION) return { ...DEFAULT_WORKSPACES_LAYOUT };
  const orderIn = Array.isArray(o.order) ? o.order : [];
  const order: WorkspacesPanelId[] = [];
  const seen = new Set<string>();
  for (const x of orderIn) {
    if (typeof x !== 'string' || !isPanelId(x) || seen.has(x)) continue;
    seen.add(x);
    order.push(x);
  }
  for (const id of WORKSPACES_PANEL_IDS) {
    if (!seen.has(id)) order.push(id);
  }
  const hidden: Partial<Record<WorkspacesPanelId, boolean>> = {};
  if (o.hidden && typeof o.hidden === 'object') {
    for (const [k, v] of Object.entries(o.hidden as Record<string, unknown>)) {
      if (isPanelId(k) && v === true) hidden[k] = true;
    }
  }
  const collapsed: Partial<Record<WorkspacesPanelId, boolean>> = {};
  if (o.collapsed && typeof o.collapsed === 'object') {
    for (const [k, v] of Object.entries(o.collapsed as Record<string, unknown>)) {
      if (isPanelId(k) && v === true) collapsed[k] = true;
    }
  }
  const panelLayoutToolbarExpanded =
    typeof o.panelLayoutToolbarExpanded === 'boolean' ? o.panelLayoutToolbarExpanded : true;
  return { version: LAYOUT_VERSION, order, hidden, collapsed, panelLayoutToolbarExpanded };
}

export function readWorkspacesLayoutFromStorage(): WorkspacesLayoutV1 {
  if (typeof localStorage === 'undefined') return { ...DEFAULT_WORKSPACES_LAYOUT };
  try {
    const raw = localStorage.getItem(STORAGE_WORKSPACES_UI);
    if (!raw) return { ...DEFAULT_WORKSPACES_LAYOUT };
    return normalizeLayout(JSON.parse(raw));
  } catch {
    return { ...DEFAULT_WORKSPACES_LAYOUT };
  }
}

export function writeWorkspacesLayoutToStorage(layout: WorkspacesLayoutV1) {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_WORKSPACES_UI, JSON.stringify(layout));
  } catch {
    /* ignore quota */
  }
}

export const PANEL_LABELS: Record<WorkspacesPanelId, string> = {
  currentProjectChrome: 'Active project',
  tactics: 'Tactics',
  projectItems: 'Project items',
  projectFiles: 'Project files',
  narrative: 'Hierarchy guide',
  setupHierarchy: 'Setup hierarchy',
  bulkImport: 'Bulk import',
  workspaceAdmin: 'Workspace admin',
  hierarchyOverview: 'Hierarchy overview',
  rawJson: 'Raw JSON (developer)',
};

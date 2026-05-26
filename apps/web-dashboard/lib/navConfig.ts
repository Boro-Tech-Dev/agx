/**
 * Primary dashboard destinations — single source for sidebar tool links and mobile drawer.
 * Styling is token-based (see globals.css --nav-*); avoid per-route rainbow classes.
 */

import { toolCatalogList, toolRouteHref, type ToolCatalogId } from './toolCatalog';

const DASHBOARD_KEY_BY_CATALOG: Record<ToolCatalogId, DashboardToolKey> = {
  ask_clarifier: 'tool_ask_clarifier',
  brief_generator: 'tool_brief_generator',
  launchpad: 'tool_launchpad',
  learning: 'tool_learning',
  omnichannel: 'tool_omnichannel',
  reply_coach: 'tool_reply_coach',
  scenario: 'tool_scenario',
  veeva_suite: 'tool_veeva_suite',
  web_capture: 'tool_web_capture',
  web_search: 'tool_web_search',
};

const CATALOG_BY_DASHBOARD_KEY: Partial<Record<DashboardToolKey, ToolCatalogId>> = Object.fromEntries(
  Object.entries(DASHBOARD_KEY_BY_CATALOG).map(([id, key]) => [key, id as ToolCatalogId]),
) as Partial<Record<DashboardToolKey, ToolCatalogId>>;

export function dashboardToolKeyForCatalog(id: ToolCatalogId): DashboardToolKey {
  return DASHBOARD_KEY_BY_CATALOG[id];
}

export function catalogIdForDashboardToolKey(key: DashboardToolKey): ToolCatalogId | null {
  return CATALOG_BY_DASHBOARD_KEY[key] ?? null;
}

export function isCatalogDashboardToolKey(key: DashboardToolKey | null | undefined): boolean {
  if (key == null) return false;
  return key in CATALOG_BY_DASHBOARD_KEY;
}

export type DashboardToolKey =
  | 'tool_ask_clarifier'
  | 'tool_reply_coach'
  | 'memory'
  | 'artifacts'
  | 'workspaces'
  | 'reports'
  | 'tools'
  | 'tool_brief_generator'
  | 'tool_launchpad'
  | 'tool_learning'
  | 'tool_omnichannel'
  | 'tool_scenario'
  | 'tool_veeva_suite'
  | 'tool_web_capture'
  | 'tool_web_search'
  | 'brief_ops'
  | 'model'
  | 'monitoring'
  | 'approvals'
  | 'contributors'
  | 'governance';

export type ToolNavItem = {
  id: DashboardToolKey;
  href: string;
  label: string;
};

export const PRIMARY_TOOL_NAV: readonly ToolNavItem[] = [
  { id: 'workspaces', href: '/workspaces', label: 'Workspaces' },
  { id: 'reports', href: '/reports', label: 'Reports' },
  { id: 'tools', href: '/tools', label: 'Tools' },
  { id: 'brief_ops', href: '/tools/brief-ops', label: 'Brief ops' },
  { id: 'contributors', href: '/contributors', label: 'Contributors' },
  { id: 'governance', href: '/governance', label: 'Governance' },
  { id: 'memory', href: '/memory', label: 'Memory' },
  { id: 'artifacts', href: '/artifacts', label: 'Artifacts' },
  { id: 'monitoring', href: '/monitoring', label: 'Queues' },
  { id: 'approvals', href: '/approvals', label: 'Approvals' },
  /** Models: also linked from shell header on each page. */
  { id: 'model', href: '/model', label: 'Models' },
] as const;

/** Tools hub — linked from the sidebar section header (not a list row). */
export const TOOLS_HUB_NAV: ToolNavItem = { id: 'tools', href: '/tools', label: 'Tools' };

/** Sidebar Tools section: catalog tools only (hub is the "Tools" header link). */
export const CATALOG_TOOL_SIDEBAR_NAV: readonly ToolNavItem[] = toolCatalogList().map(({ id, entry }) => ({
  id: dashboardToolKeyForCatalog(id),
  href: toolRouteHref(id),
  label: entry.navLabel,
})) as ToolNavItem[];

/** Hide Brief ops link when `NEXT_PUBLIC_SHOW_BRIEF_OPS=0` (build-time). Default: visible. */
export function showBriefOpsNav(): boolean {
  const v = (typeof process !== 'undefined' ? process.env.NEXT_PUBLIC_SHOW_BRIEF_OPS : '')?.trim();
  return v !== '0';
}

export function primaryToolNavVisible(): ToolNavItem[] {
  if (showBriefOpsNav()) return [...PRIMARY_TOOL_NAV];
  return PRIMARY_TOOL_NAV.filter((x) => x.id !== 'brief_ops');
}

/** Command palette: catalog tools hub + each tool (not Brief ops). */
export function catalogToolCommandNav(): ToolNavItem[] {
  return [{ id: 'tools', href: '/tools', label: 'All tools' }, ...CATALOG_TOOL_SIDEBAR_NAV];
}

/**
 * Left-rail tool links in section order (Models stays in the shell header).
 * Group 0: Tools (collapsible; links from CATALOG_TOOL_SIDEBAR_NAV)
 * Group 1: Operations (alphabetical by label)
 */
export const PRIMARY_TOOL_NAV_SIDEBAR_GROUPS: readonly (readonly ToolNavItem[])[] = [
  [...CATALOG_TOOL_SIDEBAR_NAV],
  [
    { id: 'approvals', href: '/approvals', label: 'Approvals' },
    { id: 'artifacts', href: '/artifacts', label: 'Artifacts' },
    { id: 'brief_ops', href: '/tools/brief-ops', label: 'Brief ops' },
    { id: 'contributors', href: '/contributors', label: 'Contributors' },
    { id: 'governance', href: '/governance', label: 'Governance' },
    { id: 'memory', href: '/memory', label: 'Memory' },
    { id: 'monitoring', href: '/monitoring', label: 'Queues' },
    { id: 'reports', href: '/reports', label: 'Reports' },
    { id: 'workspaces', href: '/workspaces', label: 'Workspaces' },
  ],
] as const;

export const SIDEBAR_TOOLS_GROUP_INDEX = 0 as const;

/** Sidebar group after Tools (collapsible "Operations" rail). */
export const SIDEBAR_OPERATIONS_GROUP_INDEX = 1 as const;

export function primaryToolSidebarGroupsVisible(): ToolNavItem[][] {
  if (showBriefOpsNav()) return PRIMARY_TOOL_NAV_SIDEBAR_GROUPS.map((g) => [...g]);
  return PRIMARY_TOOL_NAV_SIDEBAR_GROUPS.map((g, i) =>
    i === SIDEBAR_OPERATIONS_GROUP_INDEX ? g.filter((x) => x.id !== 'brief_ops') : [...g],
  );
}

export function toolIsInSidebarToolsGroup(id: DashboardToolKey | null | undefined): boolean {
  if (id == null) return false;
  return id === 'tools' || isCatalogDashboardToolKey(id);
}

export function toolIsInSidebarOperationsGroup(id: DashboardToolKey | null | undefined): boolean {
  if (id == null) return false;
  const g = PRIMARY_TOOL_NAV_SIDEBAR_GROUPS[SIDEBAR_OPERATIONS_GROUP_INDEX];
  const visible = showBriefOpsNav() ? g : g.filter((x) => x.id !== 'brief_ops');
  return visible.some((x) => x.id === id);
}

/** Neutral nav chip: active uses CSS nav tokens; idle is muted surface. */
export function primaryToolNavClasses(active: boolean): string {
  const base =
    'inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[11px] font-medium leading-tight transition-colors';
  if (active) {
    return `${base} border-nav-active-border bg-nav-active-bg text-nav-active-fg`;
  }
  return `${base} border-app-border/60 bg-app-fill/80 text-app-muted hover:border-app-border hover:bg-app-fill-hover hover:text-app-text`;
}

/** Vertical sidebar tool row — RagTag operator grid. */
export function primaryToolSidebarClasses(active: boolean): string {
  const base =
    'mb-0.5 flex w-full min-w-0 items-center px-2 py-1 font-mono text-[11px] font-medium uppercase tracking-wide leading-tight transition-colors';
  if (active) {
    return `${base} border border-rt-cyan bg-rt-cyan/10 text-rt-cyan`;
  }
  return `${base} text-rt-ice/70 hover:bg-rt-panel hover:text-rt-cyan`;
}

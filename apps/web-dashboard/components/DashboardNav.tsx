'use client';

import { usePathname } from 'next/navigation';
import { useEffect, useLayoutEffect, useState } from 'react';
import {
  accentClasses,
  agentMeta,
  type AgentNavKey,
} from '../lib/agents';
import { useDashboardNavAgents } from '../lib/nav/useDashboardNavAgents';
import {
  readAgentsExpandedFromDocumentCookie,
  readOpsExpandedFromDocumentCookie,
  readToolsExpandedFromDocumentCookie,
  writeAgentsExpandedCookieClient,
  writeOpsExpandedCookieClient,
  writeToolsExpandedCookieClient,
} from '../lib/navPrefsCookie';
import {
  primaryToolSidebarClasses,
  primaryToolSidebarGroupsVisible,
  SIDEBAR_OPERATIONS_GROUP_INDEX,
  SIDEBAR_TOOLS_GROUP_INDEX,
  TOOLS_HUB_NAV,
  toolIsInSidebarOperationsGroup,
  toolIsInSidebarToolsGroup,
  type DashboardToolKey,
} from '../lib/navConfig';
import { AuthLogoutButton } from './AuthLogoutButton';
import { useNavShellPrefs } from './NavShellPrefsProvider';

export type { DashboardToolKey } from '../lib/navConfig';

const LS_AGENTS_EXPANDED = 'dd.dashboardNav.agentsExpanded';
const LS_OPS_EXPANDED = 'dd.dashboardNav.opsExpanded';
const LS_TOOLS_EXPANDED = 'dd.dashboardNav.toolsExpanded';

const OPERATIONS_SECTION_LABEL = 'Operations';
const TOOLS_SECTION_LABEL = 'Tools';

function readLsBool(key: string, fallback: boolean): boolean {
  if (typeof window === 'undefined') return fallback;
  const raw = localStorage.getItem(key);
  if (raw === null) return fallback;
  return raw === '1' || raw === 'true';
}

function writeLsBool(key: string, value: boolean) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(key, value ? '1' : '0');
}

function NavChevron({ expanded }: { expanded: boolean }) {
  return (
    <svg
      className={`h-3 w-3 shrink-0 text-rt-ice/50 transition-transform duration-200 ${
        expanded ? 'rotate-0' : '-rotate-90'
      }`}
      viewBox="0 0 20 20"
      fill="currentColor"
      aria-hidden
    >
      <path
        fillRule="evenodd"
        d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.94a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z"
        clipRule="evenodd"
      />
    </svg>
  );
}

function NavSectionHeader({
  label,
  expanded,
  onToggle,
  controlsId,
  expandAria,
  collapseAria,
  href,
  active = false,
}: {
  label: string;
  expanded: boolean;
  onToggle: () => void;
  controlsId: string;
  expandAria: string;
  collapseAria: string;
  href?: string;
  active?: boolean;
}) {
  const labelClass = `font-mono text-[9px] font-semibold uppercase tracking-widest ${
    active ? 'text-rt-cyan' : 'text-rt-ice/50'
  } ${href ? 'hover:text-rt-cyan' : ''}`;

  return (
    <div className="mb-1 flex min-h-0 items-center justify-between gap-1.5 px-0.5">
      {href ? (
        <a href={href} className={labelClass}>
          {label}
        </a>
      ) : (
        <div className={labelClass}>{label}</div>
      )}
      <button
        type="button"
        className="flex h-6 w-6 shrink-0 items-center justify-center rounded text-rt-ice/50 hover:bg-rt-panel"
        onClick={onToggle}
        aria-expanded={expanded}
        aria-controls={controlsId}
        aria-label={expanded ? collapseAria : expandAria}
      >
        <NavChevron expanded={expanded} />
      </button>
    </div>
  );
}

export function DashboardNav({
  activeAgent,
  activeTool,
}: {
  activeAgent?: AgentNavKey | null;
  activeTool?: DashboardToolKey | null;
}) {
  const pathname = usePathname();
  const { initialAgentsExpanded, initialOpsExpanded, initialToolsExpanded } = useNavShellPrefs();
  const [agentsExpanded, setAgentsExpanded] = useState(initialAgentsExpanded);
  const [opsExpanded, setOpsExpanded] = useState(initialOpsExpanded);
  const [toolsExpanded, setToolsExpanded] = useState(initialToolsExpanded);
  const { navAgentKeys, ready: navAgentsReady } = useDashboardNavAgents();

  useLayoutEffect(() => {
    const fromDoc = readAgentsExpandedFromDocumentCookie();
    if (fromDoc !== null) {
      setAgentsExpanded(fromDoc);
      writeLsBool(LS_AGENTS_EXPANDED, fromDoc);
    } else {
      const ls = readLsBool(LS_AGENTS_EXPANDED, true);
      if (ls !== initialAgentsExpanded) setAgentsExpanded(ls);
      writeAgentsExpandedCookieClient(ls);
    }
  }, [initialAgentsExpanded]);

  useLayoutEffect(() => {
    const fromDoc = readOpsExpandedFromDocumentCookie();
    if (fromDoc !== null) {
      setOpsExpanded(fromDoc);
      writeLsBool(LS_OPS_EXPANDED, fromDoc);
    } else {
      const ls = readLsBool(LS_OPS_EXPANDED, true);
      if (ls !== initialOpsExpanded) setOpsExpanded(ls);
      writeOpsExpandedCookieClient(ls);
    }
  }, [initialOpsExpanded]);

  useLayoutEffect(() => {
    const fromDoc = readToolsExpandedFromDocumentCookie();
    if (fromDoc !== null) {
      setToolsExpanded(fromDoc);
      writeLsBool(LS_TOOLS_EXPANDED, fromDoc);
    } else {
      const ls = readLsBool(LS_TOOLS_EXPANDED, true);
      if (ls !== initialToolsExpanded) setToolsExpanded(ls);
      writeToolsExpandedCookieClient(ls);
    }
  }, [initialToolsExpanded]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (readAgentsExpandedFromDocumentCookie() === null) {
      writeAgentsExpandedCookieClient(readLsBool(LS_AGENTS_EXPANDED, true));
    }
    if (readOpsExpandedFromDocumentCookie() === null) {
      writeOpsExpandedCookieClient(readLsBool(LS_OPS_EXPANDED, true));
    }
    if (readToolsExpandedFromDocumentCookie() === null) {
      writeToolsExpandedCookieClient(readLsBool(LS_TOOLS_EXPANDED, true));
    }
  }, []);

  useEffect(() => {
    if (toolIsInSidebarOperationsGroup(activeTool)) {
      setOpsExpanded(true);
    }
  }, [activeTool]);

  useEffect(() => {
    if (toolIsInSidebarToolsGroup(activeTool)) {
      setToolsExpanded(true);
    }
  }, [activeTool]);

  const agentRowClass = (active: boolean, idleBg: string, idleText: string, activeBg: string, activeText: string) =>
    `mb-0.5 flex w-full min-w-0 items-center rounded-md px-2 py-1 text-[11px] font-medium leading-tight ${
      active ? `${activeBg} ${activeText}` : `${idleBg} ${idleText}`
    }`;

  const onDashboard = pathname === '/';

  const renderNavLinks = (group: { id: DashboardToolKey; href: string; label: string }[]) =>
    group.map(({ id, href, label }) => {
      const active = activeAgent == null && activeTool === id;
      return (
        <a key={id} href={href} className={primaryToolSidebarClasses(active)}>
          {label}
        </a>
      );
    });

  return (
    <nav className="text-xs desktop:min-w-0" aria-label="Section navigation">
      <a href="/" className={primaryToolSidebarClasses(onDashboard)}>
        Dashboard
      </a>
      <div className="my-1 border-t border-rt-panel" />
      <NavSectionHeader
        label="Agents"
        expanded={agentsExpanded}
        controlsId="dashboard-nav-agents"
        expandAria="Expand agents list"
        collapseAria="Collapse agents list"
        onToggle={() =>
          setAgentsExpanded((v) => {
            const next = !v;
            writeLsBool(LS_AGENTS_EXPANDED, next);
            writeAgentsExpandedCookieClient(next);
            return next;
          })
        }
      />
      <div id="dashboard-nav-links" className="block">
        <div id="dashboard-nav-agents">
          {agentsExpanded ? (
            navAgentsReady ? (
              navAgentKeys.map((key) => {
                const item = agentMeta[key];
                const ac = accentClasses[item.accent];
                const active = activeTool == null && key === activeAgent;
                return (
                  <a
                    key={key}
                    href={`/agents/${key}`}
                    className={agentRowClass(active, ac.idleBg, ac.idleText, ac.activeBg, ac.activeText)}
                  >
                    {item.name}
                  </a>
                );
              })
            ) : (
              <div className="border border-dashed border-rt-panel px-2 py-2 text-center font-mono text-[10px] text-rt-ice/50">
                Loading agents…
              </div>
            )
          ) : null}
        </div>
        <div className="my-1 border-t border-rt-panel" />
        {primaryToolSidebarGroupsVisible().map((group, gi) => (
          <div key={gi}>
            {gi > 0 ? <div className="my-1 border-t border-app-border" /> : null}
            {gi === SIDEBAR_TOOLS_GROUP_INDEX ? (
              <>
                <NavSectionHeader
                  label={TOOLS_SECTION_LABEL}
                  href={TOOLS_HUB_NAV.href}
                  active={activeAgent == null && activeTool === TOOLS_HUB_NAV.id}
                  expanded={toolsExpanded}
                  controlsId="dashboard-nav-tools"
                  expandAria="Expand tools links"
                  collapseAria="Collapse tools links"
                  onToggle={() =>
                    setToolsExpanded((v) => {
                      const next = !v;
                      writeLsBool(LS_TOOLS_EXPANDED, next);
                      writeToolsExpandedCookieClient(next);
                      return next;
                    })
                  }
                />
                <div id="dashboard-nav-tools">{toolsExpanded ? renderNavLinks(group) : null}</div>
              </>
            ) : gi === SIDEBAR_OPERATIONS_GROUP_INDEX ? (
              <>
                <NavSectionHeader
                  label={OPERATIONS_SECTION_LABEL}
                  expanded={opsExpanded}
                  controlsId="dashboard-nav-operations"
                  expandAria="Expand operations links"
                  collapseAria="Collapse operations links"
                  onToggle={() =>
                    setOpsExpanded((v) => {
                      const next = !v;
                      writeLsBool(LS_OPS_EXPANDED, next);
                      writeOpsExpandedCookieClient(next);
                      return next;
                    })
                  }
                />
                <div id="dashboard-nav-operations">{opsExpanded ? renderNavLinks(group) : null}</div>
              </>
            ) : (
              renderNavLinks(group)
            )}
          </div>
        ))}
        <div className="my-1 border-t border-rt-panel" />
        <AuthLogoutButton
          className={`${primaryToolSidebarClasses(false)} w-full cursor-pointer border-0 bg-transparent text-left disabled:opacity-60`}
        >
          Logout
        </AuthLogoutButton>
      </div>
    </nav>
  );
}

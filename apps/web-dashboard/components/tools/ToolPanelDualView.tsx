'use client';

import dynamic from 'next/dynamic';
import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useLayoutEffect, useState, type ReactNode } from 'react';

import { toolRouteHref, type ToolCatalogId, type ToolPanelTab } from '../../lib/toolCatalog';
import { resolveToolPanelTab } from '../../lib/tools/toolPanelTab';

const HowItsMadePanel = dynamic(
  () => import('./how-its-made/HowItsMadePanel').then((m) => ({ default: m.HowItsMadePanel })),
  {
    ssr: false,
    loading: () => <p className="text-[11px] text-app-muted">Loading tool…</p>,
  },
);

export type { ToolPanelTab };

type Props = {
  toolId: ToolCatalogId;
  usePanel: ReactNode;
  teamPanel?: ReactNode;
  defaultTab?: ToolPanelTab;
};

function lsKey(toolId: ToolCatalogId): string {
  return `dd.tools.${toolId}.panelTab`;
}

function readStoredTab(toolId: ToolCatalogId): ToolPanelTab | null {
  if (typeof window === 'undefined') return null;
  const raw = localStorage.getItem(lsKey(toolId));
  return raw === 'how' || raw === 'use' || raw === 'team' ? raw : null;
}

function writeStoredTab(toolId: ToolCatalogId, tab: ToolPanelTab) {
  try {
    localStorage.setItem(lsKey(toolId), tab);
  } catch {
    /* ignore */
  }
}

export function ToolPanelDualView({ toolId, usePanel, teamPanel, defaultTab = 'use' }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tabParam = searchParams.get('tab');
  const [tab, setTab] = useState<ToolPanelTab>(defaultTab);

  useLayoutEffect(() => {
    setTab(resolveToolPanelTab(tabParam, readStoredTab(toolId), defaultTab));
  }, [toolId, tabParam, defaultTab]);

  const selectTab = useCallback(
    (next: ToolPanelTab) => {
      setTab(next);
      writeStoredTab(toolId, next);
      router.replace(toolRouteHref(toolId, next), { scroll: false });
    },
    [toolId, router],
  );

  const tabBtn = (t: ToolPanelTab, label: string) => (
    <button
      key={t}
      type="button"
      onClick={() => selectTab(t)}
      className={`rounded-md px-2 py-1 text-[11px] font-medium ${
        tab === t
          ? 'border border-indigo-500/40 bg-indigo-500/15 text-indigo-100'
          : 'border border-app-border bg-app-fill text-app-muted hover:bg-app-fill-hover'
      }`}
    >
      {label}
    </button>
  );

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-1 border-b border-app-border pb-2">
        {tabBtn('use', 'Use tool')}
        {tabBtn('how', "How it's made")}
        {teamPanel ? tabBtn('team', 'Team progress') : null}
      </div>
      {tab === 'use' ? usePanel : tab === 'team' && teamPanel ? teamPanel : <HowItsMadePanel toolId={toolId} />}
    </div>
  );
}

'use client';

import * as Tabs from '@radix-ui/react-tabs';
import { useCallback, useMemo, useState } from 'react';
import dynamic from 'next/dynamic';

import { SHELL_WORK_SURFACE } from '../../lib/shellClasses';
import { SectionHeader } from '../ui/ragtag/SectionHeader';
import { HomeRecentRunsSection } from './HomeRecentRunsSection';

const HomeMemoriesTimelinePanel = dynamic(
  () => import('./HomeMemoriesTimelinePanel').then((m) => ({ default: m.HomeMemoriesTimelinePanel })),
  { ssr: false, loading: () => <PanelLoading label="Memories" /> },
);

const HomeGanttPanel = dynamic(
  () => import('./HomeGanttPanel').then((m) => ({ default: m.HomeGanttPanel })),
  { ssr: false, loading: () => <PanelLoading label="Delivery timeline" /> },
);

const HomeProjectDossierPanel = dynamic(
  () => import('./HomeProjectDossierPanel').then((m) => ({ default: m.HomeProjectDossierPanel })),
  { ssr: false, loading: () => <PanelLoading label="Stack & dossier" /> },
);

function PanelLoading({ label }: { label: string }) {
  return (
    <div className="flex min-h-[12rem] items-center justify-center border border-dashed border-rt-panel bg-rt-charcoal/50 p-4 font-mono text-[11px] uppercase tracking-widest text-rt-ice/50">
      Loading {label}…
    </div>
  );
}

const TAB_TRIGGER =
  'shrink-0 px-2.5 py-1 font-mono text-[11px] font-medium uppercase tracking-wide text-rt-ice/60 transition-colors data-[state=active]:border-b-2 data-[state=active]:border-rt-cyan data-[state=active]:text-rt-cyan';

export function HomeMainStage({
  runs,
  initialProjects,
}: {
  runs: any[];
  initialProjects: unknown[];
}) {
  const [focusedRunId, setFocusedRunId] = useState<string | null>(null);
  const [ever, setEver] = useState(() => ({
    runs: true as boolean,
    memories: false,
    delivery: false,
    stack: false,
  }));

  const defaultFocus = useMemo(() => {
    const active = runs.find((r) => r?.status && !['completed', 'failed', 'cancelled', 'degraded'].includes(r.status));
    return active?.id ?? runs[0]?.id ?? null;
  }, [runs]);

  const flowRunId = focusedRunId ?? (defaultFocus != null ? String(defaultFocus) : null);

  const onTabChange = useCallback((v: string) => {
    setEver((e) => ({ ...e, [v]: true }));
  }, []);

  return (
    <div className={`mt-4 min-w-0 ${SHELL_WORK_SURFACE}`}>
      <div className="flex min-h-0 w-full flex-col lg:min-h-[28rem]">
        <Tabs.Root defaultValue="runs" className="min-w-0" onValueChange={onTabChange}>
          <SectionHeader title="Activity workspace" accent="cyan" />
          <Tabs.List
            className="mb-3 flex max-w-full flex-nowrap gap-0.5 overflow-x-auto border-b border-rt-panel"
            aria-label="Home workspace"
          >
            <Tabs.Trigger className={TAB_TRIGGER} value="runs">
              Recent runs
            </Tabs.Trigger>
            <Tabs.Trigger className={TAB_TRIGGER} value="memories">
              Memories
            </Tabs.Trigger>
            <Tabs.Trigger className={TAB_TRIGGER} value="delivery">
              Delivery
            </Tabs.Trigger>
            <Tabs.Trigger className={TAB_TRIGGER} value="stack">
              Stack
            </Tabs.Trigger>
          </Tabs.List>

          <Tabs.Content value="runs" className="min-h-0 outline-none">
            <HomeRecentRunsSection
              runs={runs}
              embedded
              onSelectRun={(id) => setFocusedRunId(id)}
              selectedRunId={flowRunId}
            />
          </Tabs.Content>

          <Tabs.Content value="memories" className="min-h-0 outline-none">
            {ever.memories ? (
              <HomeMemoriesTimelinePanel embedded initialProjects={initialProjects} />
            ) : null}
          </Tabs.Content>

          <Tabs.Content value="delivery" className="min-h-0 outline-none">
            {ever.delivery ? <HomeGanttPanel embedded initialProjects={initialProjects} /> : null}
          </Tabs.Content>

          <Tabs.Content value="stack" className="min-h-0 outline-none">
            {ever.stack ? <HomeProjectDossierPanel embedded /> : null}
          </Tabs.Content>
        </Tabs.Root>
      </div>
    </div>
  );
}

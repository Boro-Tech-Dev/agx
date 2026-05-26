import Link from 'next/link';

import { headerBadge, type AgentNavKey } from '../../lib/agents';
import type { HomeOverviewAgent } from '../../lib/home/homeOverviewTypes';

export function HomeAgentLauncher({
  agents,
  agentsError,
}: {
  agents: HomeOverviewAgent[];
  agentsError: string | null;
}) {
  if (agentsError) {
    return (
      <div className="rounded-md border border-rose-200 bg-rose-50 p-2 text-[11px] text-rose-900 dark:border-rose-500/35 dark:bg-rose-500/10 dark:text-rose-100">
        Agent catalog could not be loaded. Fix API connectivity before using agent pages.
      </div>
    );
  }
  if (agents.length === 0) {
    return (
      <div className="rounded-md border border-amber-200 bg-amber-50 p-2 text-[11px] text-amber-900 dark:border-amber-500/35 dark:bg-amber-500/10 dark:text-amber-100">
        No agents in catalog. Confirm the API is reachable and run{' '}
        <code className="rounded bg-amber-100 px-1 dark:bg-amber-500/20 dark:text-amber-100">./scripts/apply-agents-catalog.sh</code>{' '}
        if needed.
      </div>
    );
  }

  return (
    <div className="grid min-w-0 grid-cols-1 gap-1 pb-0.5 pt-0.5 xs:grid-cols-2 tablet:grid-cols-3 desktop:grid-cols-5">
      {agents.map((a) => {
        const monogram = (a.name || a.key).slice(0, 2).toUpperCase();
        const badge = a.key in headerBadge ? headerBadge[a.key as AgentNavKey].label : a.key;
        return (
          <Link
            key={a.key}
            href={`/agents/${a.key}`}
            title={a.desc}
            className="group flex min-w-0 flex-col rounded-md border border-app-border/90 border-l-2 border-l-shell-edge-agents bg-app-surface/95 px-1.5 py-1.5 text-left shadow-xs transition-colors hover:border-nav-active-border hover:bg-app-surface dark:bg-app-elevated/90 dark:hover:bg-app-elevated xs:px-2"
          >
            <div className="flex min-w-0 items-center justify-between gap-0.5">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded bg-app-fill font-mono text-[9px] font-bold text-shell-edge-agents">
                {monogram}
              </span>
              <span className="min-w-0 truncate rounded bg-app-fill px-0.5 py-0.5 font-mono text-[8px] font-semibold uppercase leading-tight text-app-muted xs:px-1 xs:text-[9px]">
                {badge}
              </span>
            </div>
            <div className="mt-1 line-clamp-2 min-w-0 break-words text-[11px] font-semibold leading-tight text-app-text group-hover:text-nav-active-fg tablet:line-clamp-none tablet:truncate">
              {a.name}
            </div>
          </Link>
        );
      })}
    </div>
  );
}

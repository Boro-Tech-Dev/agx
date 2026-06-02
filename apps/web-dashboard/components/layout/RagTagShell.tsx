'use client';

import { DashboardShellNavProvider } from '../DashboardShellNavContext';
import type { LayoutShellProps } from '../../lib/layout/types';
import { SHELL_HEADER_BAND } from '../../lib/shellClasses';
import { RagTagSidebar } from './RagTagSidebar';
import { RagTagTopNav } from './RagTagTopNav';
import { HazardStripe } from '../ui/ragtag/HazardStripe';

export function RagTagShell({
  header,
  children,
  activeAgent,
  activeTool,
  rightAside,
  sidebarFooter,
}: LayoutShellProps) {
  return (
    <DashboardShellNavProvider activeTool={activeTool}>
      <div className="flex h-screen flex-col overflow-hidden bg-rt-black font-sans text-rt-ice">
        <RagTagTopNav />
        <HazardStripe />
        {sidebarFooter ? (
          <div className="border-b border-rt-panel bg-rt-charcoal px-4 py-2 lg:hidden">{sidebarFooter}</div>
        ) : null}
        <div className={`${SHELL_HEADER_BAND} shrink-0`}>{header}</div>
        <div className="flex min-h-0 flex-1 overflow-hidden">
          <aside className="hidden w-52 shrink-0 flex-col overflow-hidden border-r border-rt-panel bg-rt-charcoal tablet:flex">
            <div className="custom-scrollbar min-h-0 flex-1 overflow-y-auto p-2">
              <RagTagSidebar activeAgent={activeAgent} activeTool={activeTool} />
            </div>
            {sidebarFooter ? (
              <div className="shrink-0 border-t border-rt-panel bg-rt-charcoal p-2">{sidebarFooter}</div>
            ) : null}
          </aside>
          <div className="custom-scrollbar flex min-w-0 flex-1 flex-col overflow-y-auto p-4 lg:p-6">
            <div className="grid min-w-0 grid-cols-1 gap-4 desktop:grid-cols-[1fr_minmax(0,18rem)]">
              <div className="min-w-0">{children}</div>
              {rightAside != null ? <div className="min-w-0 desktop:max-w-xs">{rightAside}</div> : null}
            </div>
          </div>
        </div>
      </div>
    </DashboardShellNavProvider>
  );
}

export { RagTagShell as DashboardShell };

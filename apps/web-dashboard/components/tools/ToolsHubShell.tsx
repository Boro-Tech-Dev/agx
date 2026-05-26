'use client';

import type { ReactNode } from 'react';

import type { DashboardToolKey } from '../../lib/navConfig';
import { DashboardShell } from '../DashboardShell';
import { SubpageHeader } from '../SubpageHeader';
import { useToolsProject } from '../../lib/tools/toolsProjectContext';
import { ToolsHierarchyPicker } from './ToolsHierarchyPicker';

type Props = {
  activeTool: DashboardToolKey;
  title: string;
  trailing?: ReactNode;
  /** Tools hub menu only; individual tool pages keep the project picker. */
  showProjectPicker?: boolean;
  children: ReactNode;
};

export function ToolsHubShell({
  activeTool,
  title,
  trailing,
  showProjectPicker = true,
  children,
}: Props) {
  const picker = showProjectPicker ? <ToolsHierarchyPicker /> : null;

  return (
    <DashboardShell
      header={<SubpageHeader badge="Tools" title={title} trailing={trailing} />}
      activeTool={activeTool}
      sidebarFooter={picker}
    >
      {picker ? <div className="mb-3 tablet:hidden">{picker}</div> : null}
      {children}
    </DashboardShell>
  );
}

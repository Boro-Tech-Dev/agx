import type { ReactNode } from 'react';

import type { DashboardToolKey } from '../navConfig';
import type { AgentNavKey } from '../agents';

export type LayoutShellProps = {
  header: ReactNode;
  children: ReactNode;
  activeAgent?: AgentNavKey | null;
  activeTool?: DashboardToolKey | null;
  rightAside?: ReactNode;
  sidebarFooter?: ReactNode;
};

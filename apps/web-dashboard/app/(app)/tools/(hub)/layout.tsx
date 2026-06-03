'use client';

import type { ReactNode } from 'react';

import { ToolsProjectProvider } from '../../../../lib/tools/toolsProjectContext';

export default function ToolsHubLayout({ children }: { children: ReactNode }) {
  return <ToolsProjectProvider>{children}</ToolsProjectProvider>;
}

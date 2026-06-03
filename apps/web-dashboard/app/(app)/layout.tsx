import type React from 'react';
import '@fontsource/jetbrains-mono/latin-400.css';
import '@fontsource/oswald/latin-400.css';
import '@fontsource/oswald/latin-700.css';
import { cookies } from 'next/headers';

import { ModelStatusRootProvider } from '../../components/model/ModelStatusRootProvider';
import { NavShellPrefsProvider } from '../../components/NavShellPrefsProvider';
import {
  NAV_AGENTS_EXPANDED_COOKIE,
  NAV_OPS_EXPANDED_COOKIE,
  NAV_TOOLS_EXPANDED_COOKIE,
  parseAgentsExpandedCookie,
  parseOpsExpandedCookie,
  parseToolsExpandedCookie,
} from '../../lib/navPrefsCookie';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = cookies();
  const initialAgentsExpanded = parseAgentsExpandedCookie(
    cookieStore.get(NAV_AGENTS_EXPANDED_COOKIE)?.value,
  );
  const initialOpsExpanded = parseOpsExpandedCookie(cookieStore.get(NAV_OPS_EXPANDED_COOKIE)?.value);
  const initialToolsExpanded = parseToolsExpandedCookie(
    cookieStore.get(NAV_TOOLS_EXPANDED_COOKIE)?.value,
  );

  return (
    <NavShellPrefsProvider
      initialAgentsExpanded={initialAgentsExpanded}
      initialOpsExpanded={initialOpsExpanded}
      initialToolsExpanded={initialToolsExpanded}
    >
      <ModelStatusRootProvider>{children}</ModelStatusRootProvider>
    </NavShellPrefsProvider>
  );
}

import type React from 'react';
import { cookies, headers } from 'next/headers';
import { ModelStatusRootProvider } from '../components/model/ModelStatusRootProvider';
import { NavShellPrefsProvider } from '../components/NavShellPrefsProvider';
import { LOGIN_ROUTE_HEADER } from '../lib/auth/loginRedirect';
import {
  NAV_AGENTS_EXPANDED_COOKIE,
  NAV_OPS_EXPANDED_COOKIE,
  NAV_TOOLS_EXPANDED_COOKIE,
  parseAgentsExpandedCookie,
  parseOpsExpandedCookie,
  parseToolsExpandedCookie,
} from '../lib/navPrefsCookie';
import './globals.css';

export const metadata = {
  title: 'RagTag',
  description: 'PM Operator Grid — chaos in, clarity out.',
};

export const viewport = { width: 'device-width', initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const isLoginRoute = headers().get(LOGIN_ROUTE_HEADER) === '1';

  return (
    <html lang="en" suppressHydrationWarning className="dark">
      <body className="bg-app-canvas font-sans text-app-text antialiased">
        {isLoginRoute ? children : <DashboardProviders>{children}</DashboardProviders>}
      </body>
    </html>
  );
}

function DashboardProviders({ children }: { children: React.ReactNode }) {
  const cookieStore = cookies();
  const initialAgentsExpanded = parseAgentsExpandedCookie(
    cookieStore.get(NAV_AGENTS_EXPANDED_COOKIE)?.value,
  );
  const initialOpsExpanded = parseOpsExpandedCookie(cookieStore.get(NAV_OPS_EXPANDED_COOKIE)?.value);
  const initialToolsExpanded = parseToolsExpandedCookie(cookieStore.get(NAV_TOOLS_EXPANDED_COOKIE)?.value);

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

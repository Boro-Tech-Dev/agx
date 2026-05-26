import type React from 'react';
import { JetBrains_Mono, Oswald } from 'next/font/google';
import { cookies } from 'next/headers';
import { ModelStatusRootProvider } from '../components/model/ModelStatusRootProvider';
import { NavShellPrefsProvider } from '../components/NavShellPrefsProvider';
import {
  NAV_AGENTS_EXPANDED_COOKIE,
  NAV_OPS_EXPANDED_COOKIE,
  NAV_TOOLS_EXPANDED_COOKIE,
  parseAgentsExpandedCookie,
  parseOpsExpandedCookie,
  parseToolsExpandedCookie,
} from '../lib/navPrefsCookie';
import './globals.css';

const oswald = Oswald({
  subsets: ['latin'],
  variable: '--font-app-display',
  display: 'swap',
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-app-mono',
  display: 'swap',
});

const appSans = Oswald({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-app-sans',
  display: 'swap',
});

export const metadata = {
  title: 'RagTag',
  description: 'PM Operator Grid — chaos in, clarity out.',
};

export const viewport = { width: 'device-width', initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = cookies();
  const initialAgentsExpanded = parseAgentsExpandedCookie(
    cookieStore.get(NAV_AGENTS_EXPANDED_COOKIE)?.value,
  );
  const initialOpsExpanded = parseOpsExpandedCookie(cookieStore.get(NAV_OPS_EXPANDED_COOKIE)?.value);
  const initialToolsExpanded = parseToolsExpandedCookie(cookieStore.get(NAV_TOOLS_EXPANDED_COOKIE)?.value);

  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`dark ${oswald.variable} ${jetbrainsMono.variable} ${appSans.variable}`}
    >
      <body className="bg-app-canvas font-sans text-app-text antialiased">
        <NavShellPrefsProvider
          initialAgentsExpanded={initialAgentsExpanded}
          initialOpsExpanded={initialOpsExpanded}
          initialToolsExpanded={initialToolsExpanded}
        >
          <ModelStatusRootProvider>{children}</ModelStatusRootProvider>
        </NavShellPrefsProvider>
      </body>
    </html>
  );
}

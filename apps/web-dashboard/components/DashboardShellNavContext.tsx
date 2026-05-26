'use client';

import { createContext, useContext, type ReactNode } from 'react';

import type { DashboardToolKey } from '../lib/navConfig';

const DashboardShellNavContext = createContext<{ activeTool?: DashboardToolKey | null }>({});

export function DashboardShellNavProvider({
  activeTool,
  children,
}: {
  activeTool?: DashboardToolKey | null;
  children: ReactNode;
}) {
  return (
    <DashboardShellNavContext.Provider value={{ activeTool }}>{children}</DashboardShellNavContext.Provider>
  );
}

export function useDashboardShellActiveTool(): DashboardToolKey | null | undefined {
  return useContext(DashboardShellNavContext).activeTool;
}

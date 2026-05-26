'use client';

import { createContext, useContext, type ReactNode } from 'react';
import { useWorkspacesPageModel } from '../../hooks/workspaces/useWorkspacesPageModel';
import type { WorkspacesDataValue } from './workspacesDataTypes';

const WorkspacesDataContext = createContext<WorkspacesDataValue | null>(null);

export function WorkspacesDataProvider({ children }: { children: ReactNode }) {
  const value = useWorkspacesPageModel();
  return <WorkspacesDataContext.Provider value={value}>{children}</WorkspacesDataContext.Provider>;
}

export function useWorkspacesData(): WorkspacesDataValue {
  const ctx = useContext(WorkspacesDataContext);
  if (!ctx) {
    throw new Error('useWorkspacesData must be used within WorkspacesDataProvider');
  }
  return ctx;
}

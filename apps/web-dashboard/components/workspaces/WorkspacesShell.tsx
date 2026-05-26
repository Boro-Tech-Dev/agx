'use client';

import { WorkspacesDataProvider } from './WorkspacesDataContext';
import { WorkspacesShellView } from './WorkspacesShellView';

export function WorkspacesShell() {
  return (
    <WorkspacesDataProvider>
      <WorkspacesShellView />
    </WorkspacesDataProvider>
  );
}

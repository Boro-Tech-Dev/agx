'use client';

import { Suspense } from 'react';
import { WorkspacesShell } from '../../components/workspaces/WorkspacesShell';

export default function WorkspacesPage() {
  return (
    <Suspense fallback={<p className="p-4 text-[13px] text-app-muted">Loading workspaces…</p>}>
      <WorkspacesShell />
    </Suspense>
  );
}

'use client';

import { HierarchySummary } from '../HierarchySummary';
import { useWorkspacesData } from '../WorkspacesDataContext';


export default function HierarchyOverviewPanel() {
  const d = useWorkspacesData();
  return (
      <section className="mt-2 rounded-lg border border-app-border bg-app-surface p-2 shadow-xs">
        <h2 className="text-xs font-semibold text-app-text">Hierarchy overview</h2>
        <div className="mt-1">
          <HierarchySummary tree={d.tree} />
        </div>
      </section>
  );
}

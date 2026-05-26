'use client';

import { useWorkspacesData } from '../WorkspacesDataContext';


export default function RawJsonPanel() {
  const d = useWorkspacesData();
  return (
      <details className="mt-2 rounded-lg border border-dashed border-app-border bg-app-fill p-2">
        <summary className="cursor-pointer text-[11px] font-semibold text-app-muted">Raw JSON (developer)</summary>
        <div className="mt-2 grid grid-cols-1 gap-2 desktop:grid-cols-2">
          <div>
            <div className="text-[10px] font-semibold uppercase text-app-muted">All projects</div>
            <pre className="mt-1 max-h-40 overflow-auto whitespace-pre-wrap rounded border border-app-border bg-app-surface p-1.5 text-[10px] text-app-text">
              {JSON.stringify(d.projects, null, 2)}
            </pre>
          </div>
          <div>
            <div className="text-[10px] font-semibold uppercase text-app-muted">Hierarchy tree</div>
            <pre className="mt-1 max-h-40 overflow-auto whitespace-pre-wrap rounded border border-app-border bg-app-surface p-1.5 text-[10px] text-app-text">
              {JSON.stringify(d.tree, null, 2)}
            </pre>
          </div>
        </div>
      </details>
  );
}

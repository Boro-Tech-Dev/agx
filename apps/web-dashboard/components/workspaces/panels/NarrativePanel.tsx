'use client';

import { useWorkspacesData } from '../WorkspacesDataContext';

export default function NarrativePanel() {
  void useWorkspacesData();
  return (
    <section className="mb-2 rounded-lg border border-app-border bg-app-surface p-2.5 shadow-xs">
      <p className="text-[11px] leading-snug text-app-muted">
        Organize work top-down: each level scopes the next. Agent runs, memory, and breakdown items attach to a{' '}
        <strong className="text-app-text">project</strong>; projects live under a <strong className="text-app-text">brand</strong> under a{' '}
        <strong className="text-app-text">client</strong> under a <strong className="text-app-text">workspace</strong>.
      </p>
      <ol className="mt-2 list-decimal space-y-0.5 pl-4 text-[10px] text-app-muted">
        <li>
          <strong className="text-app-text">Workspace</strong> — top-level boundary (keys used for memory and defaults).
        </li>
        <li>
          <strong className="text-app-text">Client</strong> — grouping inside a workspace (optional but typical).
        </li>
        <li>
          <strong className="text-app-text">Brand</strong> — product or line under that client.
        </li>
        <li>
          <strong className="text-app-text">Project</strong> — requires a brand; hosts tactics and generated breakdown items.
        </li>
        <li>
          <strong className="text-app-text">Tactics & items</strong> — pick an active project at the top; tactics are strategic records;
          items come from agent runs.
        </li>
        <li>
          <strong className="text-app-text">Project files</strong> — upload classified documents (brief, estimate, timeline, clinical_note,
          lab_report, imaging_report, etc.); they are processed for search and can be archived or deleted.
        </li>
      </ol>
      <p className="mt-2 rounded border border-amber-200 bg-amber-50/80 px-2 py-1 text-[10px] text-amber-950 dark:border-amber-500/35 dark:bg-amber-500/10 dark:text-amber-100">
        <strong>Key rules</strong> (workspace + project keys): lowercase letters, digits, hyphen, underscore; 2–63 characters; must start
        with a letter.
      </p>
    </section>
  );
}

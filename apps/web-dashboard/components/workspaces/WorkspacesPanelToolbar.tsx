'use client';

import { useMemo } from 'react';
import { PANEL_LABELS, WORKSPACES_PANEL_IDS, type WorkspacesPanelId } from '../../lib/workspaces/layoutSchema';
import { btnPrimary } from '../../lib/workspaces/styles';
import { useWorkspacesLayout } from './WorkspacesLayoutContext';
import { PanelChevron } from './PanelChevron';

export function WorkspacesPanelToolbar() {
  const { layout, togglePanelHidden, togglePanelLayoutToolbarExpanded, resetLayout } = useWorkspacesLayout();
  const sectionExpanded = layout.panelLayoutToolbarExpanded;
  const controlsId = 'workspaces-panel-layout-controls';

  const hiddenIds = useMemo(
    () => WORKSPACES_PANEL_IDS.filter((id) => layout.hidden[id]),
    [layout.hidden],
  );

  return (
    <div className="relative mb-2">
      <div className="mb-1 flex min-w-0 items-center gap-1 rounded border border-app-border/80 bg-app-fill/80 px-1 py-0.5">
        <span
          className="inline-flex cursor-default select-none rounded px-1 py-0.5 text-[10px] font-bold text-app-muted"
          aria-hidden
          title="This bar stays at the top; drag handles on panels below reorder those panels."
        >
          ::
        </span>
        <span className="min-w-0 text-[9px] font-semibold uppercase tracking-wide text-app-muted">Panel layout</span>
        <div className="flex-1" />
        <button
          type="button"
          className={`${btnPrimary} shrink-0 px-2 py-0.5 text-[10px]`}
          onClick={resetLayout}
        >
          Reset layout
        </button>
        <button
          type="button"
          className="flex shrink-0 items-center justify-center rounded px-1 py-0.5 text-app-muted hover:bg-app-fill-hover"
          aria-expanded={sectionExpanded}
          aria-controls={controlsId}
          aria-label={`${sectionExpanded ? 'Collapse' : 'Expand'} panel layout`}
          onClick={togglePanelLayoutToolbarExpanded}
        >
          <PanelChevron expanded={sectionExpanded} />
        </button>
      </div>
      <div id={controlsId} className={sectionExpanded ? 'min-w-0' : 'hidden'}>
        <section className="rounded-lg border border-app-border bg-app-fill/80 p-2 shadow-inner">
          <p className="max-w-none text-[9px] leading-snug text-app-muted">
            Each control shows or hides that panel. Hidden panels stay in your saved order and return in the same place when
            shown again. Drag handles reorder visible panels only; hidden positions are preserved in the full order.
          </p>
          <div
            className="mt-2 flex w-full min-w-0 flex-wrap content-start gap-x-2 gap-y-1"
            role="toolbar"
            aria-label="Workspace panels: press to show or hide (pressed means visible)"
          >
            {WORKSPACES_PANEL_IDS.map((id: WorkspacesPanelId) => {
              const shown = !layout.hidden[id];
              return (
                <button
                  key={id}
                  type="button"
                  aria-pressed={shown}
                  aria-label={`${PANEL_LABELS[id]} — ${shown ? 'visible; click to hide' : 'hidden; click to show'}`}
                  className={`flex shrink-0 items-center gap-1 rounded border px-1.5 py-0.5 text-left text-[10px] transition-colors ${
                    shown
                      ? 'border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-500/35 dark:bg-emerald-500/10 dark:text-emerald-100'
                      : 'border-app-border bg-app-fill text-app-muted'
                  }`}
                  onClick={() => togglePanelHidden(id)}
                >
                  <span className="font-semibold">{shown ? 'Visible' : 'Hidden'}</span>
                  <span className="text-app-text">{PANEL_LABELS[id]}</span>
                </button>
              );
            })}
          </div>
          {hiddenIds.length > 0 ? (
            <details className="mt-2 rounded border border-app-border bg-app-fill/90 px-2 py-1">
              <summary className="cursor-pointer select-none text-[10px] font-semibold text-app-text">
                Hidden panels ({hiddenIds.length})
              </summary>
              <ul className="mt-1 space-y-0.5 border-t border-app-border pt-1" aria-label="Hidden panels">
                {hiddenIds.map((id) => (
                  <li key={id} className="flex items-center justify-between gap-2 text-[10px]">
                    <span className="text-app-text">{PANEL_LABELS[id]}</span>
                    <button
                      type="button"
                      className="font-semibold text-emerald-800 hover:underline dark:text-emerald-300"
                      onClick={() => togglePanelHidden(id)}
                    >
                      Show
                    </button>
                  </li>
                ))}
              </ul>
            </details>
          ) : null}
        </section>
      </div>
    </div>
  );
}

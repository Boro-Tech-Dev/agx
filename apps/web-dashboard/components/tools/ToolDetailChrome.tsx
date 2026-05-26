'use client';

import { getToolCatalogEntry, humanizeToolLabel, toolAccentClasses, type ToolCatalogId } from '../../lib/toolCatalog';
import { StatusPill } from '../ui/ragtag/StatusPill';
import { RT_PANEL_TITLE } from '../../lib/ragtag/panelClasses';

export function ToolDetailChrome({ toolId }: { toolId: ToolCatalogId }) {
  const entry = getToolCatalogEntry(toolId);
  const fam = toolAccentClasses(toolId);
  const titleDisplay = humanizeToolLabel(entry.slug);
  const outputDisplay = humanizeToolLabel(entry.outputKind);

  return (
    <div
      className={`mb-4 min-w-0 overflow-hidden border border-rt-panel bg-rt-charcoal/80 p-3 ring-1 ring-inset ${fam.ring}`}
    >
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <span className={`shrink-0 ${RT_PANEL_TITLE}`}>{titleDisplay}</span>
        <div className="flex min-w-0 flex-wrap items-center gap-1.5">
          <span className={`rounded-sm px-1.5 py-0.5 font-mono text-[10px] font-medium ${fam.chip}`}>
            {entry.categoryLabel}
          </span>
          <span className="rounded-sm bg-rt-panel px-1.5 py-0.5 font-mono text-[10px] text-rt-ice/70">
            {entry.scopeLabel}
          </span>
          <StatusPill status="READY" variant="success" />
        </div>
        <span className="min-w-0 font-mono text-[11px] text-rt-ice/60">
          <span className="font-medium text-rt-ice">Outputs</span>
          <span className="ml-1">{outputDisplay}</span>
        </span>
      </div>
      <p className="mt-2 border-t border-rt-panel pt-2 font-mono text-[11px] leading-relaxed text-rt-ice/70">
        {entry.summary}
      </p>
    </div>
  );
}

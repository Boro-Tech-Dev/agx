'use client';

import {
  getToolCatalogEntry,
  humanizeToolLabel,
  toolRouteHref,
  type ToolCatalogId,
} from '../../lib/toolCatalog';
import { toolRagtagMeta } from '../../lib/toolCatalogRagtag';
import { ToolCard } from '../ui/ragtag/ToolCard';

type Props = {
  toolId: ToolCatalogId;
};

export function ToolsLandingTile({ toolId }: Props) {
  const entry = getToolCatalogEntry(toolId);
  const meta = toolRagtagMeta(toolId);
  const title = humanizeToolLabel(entry.slug);

  return (
    <div data-tools-landing-tile className="h-full">
      <ToolCard
        name={title}
        purpose={entry.summary}
        status={meta.status}
        variant={meta.variant}
        cta={meta.cta}
        metadata={meta.metadata}
        icon={meta.icon}
        href={toolRouteHref(toolId)}
      />
    </div>
  );
}

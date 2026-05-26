'use client';

import { toolCatalogList } from '../../lib/toolCatalog';
import { useEqualTileHeights } from '../../lib/hooks/useEqualTileHeights';
import { ToolsLandingTile } from './ToolsLandingTile';

export function ToolsLandingGrid() {
  const gridRef = useEqualTileHeights('[data-tools-landing-tile]');

  return (
    <div ref={gridRef} className="grid grid-cols-2 items-stretch gap-3 sm:grid-cols-3 lg:grid-cols-4">
      {toolCatalogList().map(({ id }) => (
        <ToolsLandingTile key={id} toolId={id} />
      ))}
    </div>
  );
}

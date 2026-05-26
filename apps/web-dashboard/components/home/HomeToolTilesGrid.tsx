'use client';

import { toolCatalogList } from '../../lib/toolCatalog';
import { ToolsLandingTile } from '../tools/ToolsLandingTile';

export function HomeToolTilesGrid() {
  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
      {toolCatalogList().map(({ id }) => (
        <ToolsLandingTile key={id} toolId={id} />
      ))}
    </div>
  );
}

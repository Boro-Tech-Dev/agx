'use client';

import { homeOperationsEducationList } from '../../lib/home/homeEducationalCopy';
import type { DashboardToolKey } from '../../lib/navConfig';
import { useEqualTileHeights } from '../../lib/hooks/useEqualTileHeights';
import { HomeOperationsTile } from './HomeOperationsTile';

export function HomeOperationsTilesGrid() {
  const gridRef = useEqualTileHeights('[data-home-ops-tile]');
  const items = homeOperationsEducationList();

  return (
    <div ref={gridRef} className="grid grid-cols-2 items-stretch gap-3 sm:grid-cols-3 lg:grid-cols-4">
      {items.map((item) => (
        <HomeOperationsTile
          key={item.id}
          id={item.id as DashboardToolKey}
          label={item.label}
          href={item.href}
          summary={item.summary}
        />
      ))}
    </div>
  );
}

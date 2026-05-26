'use client';

import { useLayoutEffect, useRef } from 'react';

/** Match every tile in a grid to the tallest natural height. */
export function useEqualTileHeights(selector: string) {
  const gridRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const grid = gridRef.current;
    if (!grid) return;

    const sync = () => {
      const tiles = grid.querySelectorAll<HTMLElement>(selector);
      if (!tiles.length) return;
      tiles.forEach((el) => {
        el.style.minHeight = '';
      });
      let max = 0;
      tiles.forEach((el) => {
        max = Math.max(max, el.getBoundingClientRect().height);
      });
      if (max <= 0) return;
      const px = `${Math.ceil(max)}px`;
      tiles.forEach((el) => {
        el.style.minHeight = px;
      });
    };

    sync();
    const ro = new ResizeObserver(sync);
    ro.observe(grid);
    return () => ro.disconnect();
  }, [selector]);

  return gridRef;
}

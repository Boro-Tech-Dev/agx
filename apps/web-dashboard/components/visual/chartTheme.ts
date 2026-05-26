'use client';

import { useEffect, useState } from 'react';

/** Maps globals.css `--viz-*` triplets to `rgb(r g b)` for Recharts / canvas. */
export function rgbFromCssVar(name: string, el: HTMLElement = document.documentElement): string {
  const raw = getComputedStyle(el).getPropertyValue(name).trim();
  if (!raw) return 'rgb(148, 163, 184)';
  const parts = raw.split(/\s+/).filter(Boolean);
  if (parts.length >= 3) {
    return `rgb(${parts.slice(0, 3).join(', ')})`;
  }
  return 'rgb(148, 163, 184)';
}

export type VizChartColors = {
  grid: string;
  axis: string;
  series1: string;
  series2: string;
  series3: string;
};

const fallbackLight: VizChartColors = {
  grid: 'rgb(226 232 240)',
  axis: 'rgb(100 116 139)',
  series1: 'rgb(99 102 241)',
  series2: 'rgb(244 63 94)',
  series3: 'rgb(52 211 153)',
};

/** Reactive chart stroke/fill colors that follow `.dark` and `--viz-*` tokens. */
export function useVizChartColors(): VizChartColors {
  const [c, setC] = useState<VizChartColors>(fallbackLight);

  useEffect(() => {
    const read = () => {
      const el = document.documentElement;
      setC({
        grid: rgbFromCssVar('--viz-chart-grid', el),
        axis: rgbFromCssVar('--viz-chart-axis', el),
        series1: rgbFromCssVar('--viz-series-1', el),
        series2: rgbFromCssVar('--viz-series-2', el),
        series3: rgbFromCssVar('--viz-series-3', el),
      });
    };
    read();
    const obs = new MutationObserver(read);
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => obs.disconnect();
  }, []);

  return c;
}

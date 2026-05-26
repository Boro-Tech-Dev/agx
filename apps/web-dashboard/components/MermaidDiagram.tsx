'use client';

import { useEffect, useId, useRef, useState } from 'react';

type MermaidDiagramProps = {
  chart: string;
  className?: string;
};

function isDarkTheme(): boolean {
  return true;
}

/**
 * Renders Mermaid source as SVG. Defers render when inside a closed <details>.
 */
export function MermaidDiagram({ chart, className }: MermaidDiagramProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const renderId = useId().replace(/:/g, '');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const el = containerRef.current;
    const source = chart.trim();
    if (!el || !source) return;

    let cancelled = false;

    async function renderDiagram() {
      setError(null);
      try {
        const mermaid = (await import('mermaid')).default;
        mermaid.initialize({
          startOnLoad: false,
          theme: isDarkTheme() ? 'dark' : 'default',
          securityLevel: 'strict',
          fontFamily: 'ui-sans-serif, system-ui, sans-serif',
        });
        const { svg, bindFunctions } = await mermaid.render(`mmd-${renderId}-${Date.now()}`, source);
        if (cancelled) return;
        el.innerHTML = svg;
        bindFunctions?.(el);
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : String(e));
        }
      }
    }

    let toggleCleanup: (() => void) | undefined;

    const details = el.closest('details');
    if (details && !details.open) {
      const onToggle = () => {
        if (details.open) void renderDiagram();
      };
      details.addEventListener('toggle', onToggle);
      toggleCleanup = () => details.removeEventListener('toggle', onToggle);
    } else {
      void renderDiagram();
    }

    const themeObserver = new MutationObserver(() => {
      if (!cancelled && (!details || details.open)) void renderDiagram();
    });
    themeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class'],
    });

    return () => {
      cancelled = true;
      toggleCleanup?.();
      themeObserver.disconnect();
      el.innerHTML = '';
    };
  }, [chart, renderId]);

  if (error) {
    return (
      <div className={className ?? 'space-y-2'}>
        <p className="text-[10px] text-amber-600 dark:text-amber-400">Could not render diagram: {error}</p>
        <pre className="overflow-x-auto rounded border border-app-border bg-app-fill/80 p-2 font-mono text-[10px] text-app-text">
          {chart}
        </pre>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className={
        className ??
        'mermaid-diagram overflow-x-auto rounded border border-indigo-500/25 bg-indigo-500/5 p-2 [&_svg]:mx-auto [&_svg]:max-w-full'
      }
      role="img"
      aria-label="Architecture diagram"
    />
  );
}

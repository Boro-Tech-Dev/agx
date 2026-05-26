# Visual layer (`components/visual`)

Shared building blocks for diagrams and charts. Palette tokens live in [`app/globals.css`](../../app/globals.css) (`--viz-*`).

## Primitives

| Export | Use |
|--------|-----|
| `ArchitectureFlow` | Themed React Flow wrapper — pan/zoom topology, minimap, dot background. |
| `MiniStatSparkline` | Small Recharts line — pair with `useVizChartColors` / `chartTheme`. |
| `VizSurface` | Optional gradient frame for hero-style panels. |
| `useVizChartColors`, `rgbFromCssVar` | Theme-aware colors for Recharts. |

## Rollout checklist (incremental)

1. **Monitoring** — queue depth, worker health, latency series (`MiniStatSparkline` or larger Recharts).
2. **Run detail** — step timeline or duration bars using the same `--viz-series-*` colors.
3. **Workspaces** — sparklines on project cards when metrics exist.
4. **Home Gantt / memories** — optional: align vis-timeline CSS with `--viz-*` (see globals).

Keep heavy clients dynamically imported (`next/dynamic`, `ssr: false`) when the route is not the primary interaction target.

# Dashboard presentation styles (designer handoff)

Three axes on `<html>`:

- `data-layout-template` — structure (`default`, `compact`, `rail`)
- `data-color-theme` — palette (see table below)
- `class="dark"` — light vs dark appearance for the active color theme

## Color themes (catalog)

| ID | Label | Anchor colors (hex → RGB triplets) |
|----|-------|--------------------------------------|
| `standard` | Standard | Default neutral / blue accent palette |
| `cyberpunk` | Cyberpunk | Cyan `#06b6d4` → `6 182 212`, fuchsia `#d946ef` → `217 70 239` |
| `retro-synthwave` | Retro Synthwave | Void `#2e1065` → `46 16 101`, pink `#db2777` → `219 39 119`, orange `#ea580c` → `234 88 12` |
| `earthy-terracotta` | Earthy Terracotta | Terracotta `#c2410c` → `194 65 12`, sage `#84a98c` → `132 169 140`, deep neutral `#451a03` → `69 26 3` (dark canvas leans stone-900 warmth) |
| `nordic-minimalist` | Nordic Minimalist | Icy `#e0f2fe` → `224 242 254`, mist `#d6d3d1` → `214 211 209`, text `#57534e` → `87 83 78` |
| `monochromatic-plum` | Monochromatic Plum | Plum `#581c87` → `88 28 135`, lavender `#f3e8ff` → `243 232 255` |
| `tokyo-night` | Tokyo Night | Night `#1a1b26` → `26 27 38`, blue `#7aa2f7` → `122 162 247`, magenta `#bb9af7` → `187 154 247`, cyan `#7dcfff` → `125 207 255`; Day light `#e1e2e7` canvas, `#343b58` text |

Theme IDs are defined once in `lib/themes/themeIds.ts` and registered in `lib/themes/registry.ts`. The Appearance menu lists themes **alphabetically by label** via `COLOR_THEME_LIST` in `registry.ts`.

## Adding a color theme

1. Add `tokens/{id}.light.css` and `tokens/{id}.dark.css` using selectors:
   - `:root[data-color-theme="{id}"]`
   - `:root[data-color-theme="{id}"].dark`
2. Define all required variables (RGB triplets, space-separated):
   - `--app-canvas`, `--app-surface`, `--app-elevated`, `--app-border`, `--app-text`, `--app-muted`, `--app-fill`, `--app-fill-hover`
   - `--viz-node-bg`, `--viz-node-border`, `--viz-edge`, `--viz-edge-active`, `--viz-series-1` … `--viz-series-4`, `--viz-chart-grid`, `--viz-chart-axis`, `--viz-minimap-mask`, `--viz-surface-glow`
   - `--nav-active-border`, `--nav-active-bg`, `--nav-active-fg`, `--nav-tab-line`
   - `--shell-header`, `--shell-ops`, `--shell-agents`, `--shell-work`, `--shell-edge-ops`, `--shell-edge-agents`, `--shell-edge-work`
   - Optional: `--font-app-sans`, `--font-app-mono`
3. `@import` both files in `app/globals.css`.
4. Register in `lib/themes/registry.ts` and add `@custom-variant theme-{id}` in `globals.css` if you need `theme-{id}:` utilities.

Cyberpunk starter files are **replaceable in place** — swap content without renaming.

## Adding a layout template

1. Add `density/{id}.css` with `--density-*` overrides under `[data-layout-template="{id}"]`.
2. Implement a shell in `components/layout/` and register in `lib/layout/registry.ts`.
3. Add `@custom-variant layout-{id}` in `globals.css` when needed.

Do not edit the `@theme` bridge in `globals.css` unless engineering adds new semantic Tailwind color names.

**Important (Tailwind v4):** Theme colors must use `rgb(var(--token))` — not the v3 `rgb(var(--token) / <alpha-value>)` form, which v4 emits literally and breaks all utilities.

import type { ToolPanelTab } from '../toolCatalog';

export function resolveToolPanelTab(
  tabParam: string | null | undefined,
  stored: ToolPanelTab | null,
  fallback: ToolPanelTab = 'use',
): ToolPanelTab {
  if (tabParam === 'use' || tabParam === 'how' || tabParam === 'team') return tabParam;
  if (stored === 'use' || stored === 'how' || stored === 'team') return stored;
  return fallback;
}

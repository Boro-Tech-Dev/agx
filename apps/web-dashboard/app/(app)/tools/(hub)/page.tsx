'use client';

import { ToolsHubShell } from '../../../../components/tools/ToolsHubShell';
import { ToolsLandingGrid } from '../../../../components/tools/ToolsLandingGrid';

export default function ToolsHubPage() {
  return (
    <ToolsHubShell activeTool="tools" title="Tools" showProjectPicker={false}>
      <ToolsLandingGrid />
    </ToolsHubShell>
  );
}

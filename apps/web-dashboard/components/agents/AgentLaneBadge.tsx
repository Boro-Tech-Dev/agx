'use client';

import { agentLaneRow, laneBadgeClasses, type AgentLaneId } from '../../lib/agentLanes';

export function AgentLaneBadge({ agentKey, className = '' }: { agentKey: string; className?: string }) {
  const row = agentLaneRow(agentKey);
  if (!row) return null;
  return (
    <span
      className={`inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium ${laneBadgeClasses(row.lane as AgentLaneId)} ${className}`}
      title={row.lane_description}
    >
      {row.lane_label}
    </span>
  );
}

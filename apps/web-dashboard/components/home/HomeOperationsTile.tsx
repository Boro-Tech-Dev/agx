'use client';

import { FolderKanban } from 'lucide-react';

import type { DashboardToolKey } from '../../lib/navConfig';
import { ToolCard } from '../ui/ragtag/ToolCard';

type Props = {
  id: DashboardToolKey;
  label: string;
  href: string;
  summary: string;
};

export function HomeOperationsTile({ id, label, href, summary }: Props) {
  void id;
  return (
    <div data-home-ops-tile className="h-full">
      <ToolCard
        name={label}
        purpose={summary}
        status="READY"
        variant="success"
        cta="Open"
        metadata="OPERATIONS"
        icon={FolderKanban}
        href={href}
      />
    </div>
  );
}

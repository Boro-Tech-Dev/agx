import {
  BookOpen,
  CheckSquare,
  FileText,
  HelpCircle,
  Image as ImageIcon,
  Map,
  MessageSquare,
  Rocket,
  Search,
  Share2,
} from 'lucide-react';
import type { ElementType } from 'react';

import type { ToolCatalogId } from './toolCatalog';
import type { StatusVariant } from './ragtag/statusVariants';

export type ToolRagtagMeta = {
  icon: ElementType;
  status: string;
  variant: StatusVariant;
  cta: string;
  metadata: string;
};

const META: Record<ToolCatalogId, ToolRagtagMeta> = {
  ask_clarifier: {
    icon: HelpCircle,
    status: 'ACTIVE',
    variant: 'active',
    cta: 'Clarify',
    metadata: 'PROJECT-AWARE',
  },
  reply_coach: {
    icon: MessageSquare,
    status: 'READY',
    variant: 'success',
    cta: 'Coach',
    metadata: 'USES BUBS',
  },
  brief_generator: {
    icon: FileText,
    status: 'QUEUED',
    variant: 'warning',
    cta: 'Generate',
    metadata: 'TEMPLATE V2',
  },
  scenario: {
    icon: Map,
    status: 'ACTIVE',
    variant: 'active',
    cta: 'Route',
    metadata: 'BETA',
  },
  launchpad: {
    icon: Rocket,
    status: 'READY',
    variant: 'success',
    cta: 'Launch',
    metadata: 'QA READY',
  },
  veeva_suite: {
    icon: CheckSquare,
    status: 'IN PROGRESS',
    variant: 'info',
    cta: 'Inspect',
    metadata: 'SYNCED',
  },
  web_capture: {
    icon: ImageIcon,
    status: 'READY',
    variant: 'success',
    cta: 'Capture',
    metadata: 'HIGH-RES',
  },
  web_search: {
    icon: Search,
    status: 'READY',
    variant: 'success',
    cta: 'Search',
    metadata: 'SEARXNG',
  },
  omnichannel: {
    icon: Share2,
    status: 'OFFLINE',
    variant: 'neutral',
    cta: 'Inspect',
    metadata: 'MAINTENANCE',
  },
  learning: {
    icon: BookOpen,
    status: 'READY',
    variant: 'success',
    cta: 'Open',
    metadata: 'UPDATED',
  },
};

export function toolRagtagMeta(id: ToolCatalogId): ToolRagtagMeta {
  return META[id];
}

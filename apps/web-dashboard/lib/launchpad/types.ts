export type LaunchpadChannel =
  | 'veeva_rte'
  | 'veeva_clm'
  | 'media'
  | 'web'
  | 'crm_email'
  | 'print_pdf'
  | 'other';

export type LaunchpadCategory =
  | 'approval'
  | 'assets'
  | 'qa'
  | 'tracking'
  | 'vendor'
  | 'deployment'
  | 'documentation'
  | 'post_launch';

export type LaunchpadSeverity = 'blocker' | 'warning' | 'note';
export type LaunchpadStatus = 'not_started' | 'in_progress' | 'complete' | 'blocked' | 'not_applicable';
export type LaunchpadGate = 'ready' | 'yellow' | 'blocked' | 'not_started';

export type LaunchpadChecklistItem = {
  id: string;
  category: LaunchpadCategory;
  label: string;
  description?: string;
  required: boolean;
  severityIfMissing: LaunchpadSeverity;
  status: LaunchpadStatus;
  owner?: string;
  dueDate?: string;
  evidence?: string;
  notes?: string;
};

export type LaunchpadAsset = {
  id: string;
  name: string;
  channel: LaunchpadChannel;
  audience?: string;
  version?: string;
  owner?: string;
  vendor?: string;
  launchDate?: string;
  checklist: LaunchpadChecklistItem[];
  fileFindings: LaunchpadFinding[];
  fileNames?: string[];
  createdAt: string;
  updatedAt: string;
};

export type LaunchpadFinding = {
  id: string;
  assetId?: string;
  category: LaunchpadCategory;
  severity: LaunchpadSeverity;
  title: string;
  detail: string;
  recommendedAction?: string;
  source?: string;
};

export type LaunchpadLaunch = {
  id: string;
  name: string;
  brand?: string;
  client?: string;
  owner?: string;
  targetLaunchDate?: string;
  statusNote?: string;
  assets: LaunchpadAsset[];
  findings: LaunchpadFinding[];
  createdAt: string;
  updatedAt: string;
};

export type LaunchpadCategoryScore = {
  category: LaunchpadCategory;
  completed: number;
  total: number;
  score: number | null;
  blockers: number;
  warnings: number;
  gate: LaunchpadGate;
};

export type LaunchpadSummary = {
  score: number;
  gate: LaunchpadGate;
  blockers: LaunchpadFinding[];
  warnings: LaunchpadFinding[];
  notes: LaunchpadFinding[];
  categoryScores: LaunchpadCategoryScore[];
  readyAssets: number;
  totalAssets: number;
  nextActions: string[];
  internalSummary: string;
  clientSummary: string;
  vendorSummary: string;
};

export const CATEGORY_LABELS: Record<LaunchpadCategory, string> = {
  approval: 'Approval',
  assets: 'Assets',
  qa: 'QA',
  tracking: 'Tracking',
  vendor: 'Vendor',
  deployment: 'Deployment',
  documentation: 'Documentation',
  post_launch: 'Post-launch',
};

export const CHANNEL_LABELS: Record<LaunchpadChannel, string> = {
  veeva_rte: 'Veeva RTE',
  veeva_clm: 'Veeva CLM',
  media: 'Media',
  web: 'Web / landing page',
  crm_email: 'CRM / email',
  print_pdf: 'Print / PDF',
  other: 'Other',
};

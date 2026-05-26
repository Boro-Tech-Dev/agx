import type { QueueMonitoringResponse } from '../monitoringTypes';

export type HomeOverviewAgent = {
  key: string;
  name: string;
  desc: string;
};

export type HomeOverviewStrip = {
  monitoring: QueueMonitoringResponse | null;
  monitoringError: string | null;
  projectsCount: number | null;
  projectsError: string | null;
  workspacesCount: number | null;
  workspacesError: string | null;
  pendingApprovals: number | null;
  approvalsTotal: number | null;
  approvalsError: string | null;
  tokensConsumed: number | null;
  estimatedSavingsUsd: number | null;
};

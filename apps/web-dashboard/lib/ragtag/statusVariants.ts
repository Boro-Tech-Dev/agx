export type StatusVariant = 'active' | 'warning' | 'success' | 'info' | 'error' | 'neutral';

const STATUS_MAP: Record<string, StatusVariant> = {
  active: 'active',
  processing: 'active',
  in_progress: 'active',
  running: 'active',
  syncing: 'info',
  routed: 'info',
  queued: 'warning',
  pending: 'warning',
  needs_approval: 'warning',
  warning: 'warning',
  degraded: 'warning',
  maintenance: 'warning',
  complete: 'success',
  completed: 'success',
  done: 'success',
  validated: 'success',
  approved: 'success',
  ready: 'success',
  online: 'success',
  healthy: 'success',
  success: 'success',
  blocked: 'error',
  failed: 'error',
  error: 'error',
  rejected: 'error',
  offline: 'neutral',
  cancelled: 'neutral',
  idle: 'neutral',
  info: 'info',
};

export function statusToVariant(status: string | null | undefined): StatusVariant {
  if (!status) return 'neutral';
  const key = status.trim().toLowerCase().replace(/\s+/g, '_');
  return STATUS_MAP[key] ?? 'info';
}

export function statusLabel(status: string): string {
  return status.trim().toUpperCase().replace(/_/g, ' ');
}

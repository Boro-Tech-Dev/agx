/**
 * Learning module routes and playbook id mapping (internal to Learning tool).
 */

export type LearningPlaybookMeta = {
  id: string;
  title: string;
  module_type?: string;
  agency_role?: string;
  vertical?: string;
  estimatedMinutes?: number;
};

export function playbookIdFromRoleVertical(roleSlug: string, verticalSlug: string): string {
  const role = roleSlug.replace(/-/g, '_');
  const vertical = verticalSlug.replace(/-/g, '_');
  return `${role}_${vertical}`;
}

export function roleVerticalFromPlaybookId(playbookId: string): { role: string; vertical: string } | null {
  const m = playbookId.match(/^(account_management|project_management|creative|mlr_ops|dev_veeva)_(pharma|non_pharma)$/);
  if (!m) return null;
  return {
    role: m[1].replace(/_/g, '-'),
    vertical: m[2].replace(/_/g, '-'),
  };
}

export function learningMissionHref(playbookId: string, enrollmentId?: string, stepId?: string): string {
  if (playbookId === 'pharma_knowledge') {
    let href = '/tools/learning/pharma';
    const q = new URLSearchParams();
    if (enrollmentId) q.set('enrollment', enrollmentId);
    if (stepId) q.set('step', stepId);
    const qs = q.toString();
    return qs ? `${href}?${qs}` : href;
  }
  const rv = roleVerticalFromPlaybookId(playbookId);
  if (rv) {
    let href = `/tools/learning/${rv.role}/${rv.vertical}`;
    const q = new URLSearchParams();
    if (enrollmentId) q.set('enrollment', enrollmentId);
    if (stepId) q.set('step', stepId);
    const qs = q.toString();
    return qs ? `${href}?${qs}` : href;
  }
  return '/tools/learning';
}

export function learningActivityHref(
  playbookId: string,
  stepId: string,
  enrollmentId?: string,
  brandKey?: string | null,
): string {
  const base = `/tools/learning/activity/${encodeURIComponent(playbookId)}/${encodeURIComponent(stepId)}`;
  const q = new URLSearchParams();
  if (enrollmentId) q.set('enrollment', enrollmentId);
  if (brandKey) q.set('brand', brandKey);
  const qs = q.toString();
  return qs ? `${base}?${qs}` : base;
}

export function resumeChipLabel(title: string, completed: number, total: number): string {
  return `${title} — ${completed}/${total}`;
}

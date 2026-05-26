/** Mirrors worker `projects.pm_kind`: business (PM) vs personal (Synergy) project kinds. */

export type PmKind = 'business' | 'personal';

export function isPersonalPm(project: { pm_kind?: string | null } | null | undefined): boolean {
  return String(project?.pm_kind ?? 'business').toLowerCase() === 'personal';
}

const PERSONAL_LABELS: Record<string, string> = {
  task: 'Next step',
  risk: 'Tension',
  cost: 'Budget / scope',
  anomaly: 'Detail',
  decision: 'Decision',
  open_question: 'Wonder',
  idea: 'Idea',
  dependency: 'Dependency',
  milestone: 'Milestone',
};

export function displayItemTypeLabel(itemType: string | undefined, personal: boolean): string {
  const raw = String(itemType || '').toLowerCase();
  if (!raw) return 'Item';
  if (raw === 'timeline_event') return 'Timeline';
  if (personal && PERSONAL_LABELS[raw]) return PERSONAL_LABELS[raw];
  return raw.replace(/_/g, ' ');
}

export function pmStructuredSectionLabels(personal: boolean) {
  if (!personal) {
    return {
      summary: 'Summary',
      tasks: 'Tasks',
      risks: 'Risks',
      costs: 'Costs / scope',
      anomalies: 'Anomalies',
      reflections: 'Reflections',
      projectContext: 'Project context',
      assumptions: 'Assumptions',
      openQuestions: 'Open questions',
      decisions: 'Decisions',
      recommendedNextActions: 'Recommended next actions',
    };
  }
  return {
    summary: 'Summary',
    tasks: 'Next steps',
    risks: 'Tensions',
    costs: 'Budget / scope',
    anomalies: 'Details',
    reflections: 'Reflections',
    projectContext: 'Context',
    assumptions: 'Assumptions',
    openQuestions: 'Open wonders',
    decisions: 'Decisions',
    recommendedNextActions: 'Suggested next moves',
  };
}

/** Labels for H.E.L.P.eR (health-record organizer) structured breakdown. */
export function pmStructuredSectionLabelsClinical() {
  return {
    summary: 'Summary',
    tasks: 'Discussion points / records to obtain',
    risks: 'Uncertainties / safety',
    costs: 'Coverage / cost logistics',
    anomalies: 'Notable findings (text)',
    reflections: 'Notes',
    projectContext: 'Context',
    assumptions: 'Assumptions',
    openQuestions: 'Open questions',
    decisions: 'Decisions',
    recommendedNextActions: 'Recommended next actions',
  };
}

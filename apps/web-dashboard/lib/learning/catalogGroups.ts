/** Hub layout: pharma-first curriculum grouping. */

export const PHARMA_KNOWLEDGE_ID = 'pharma_knowledge';

export const PHARMA_ROLE_PLAYBOOK_IDS = [
  'account_management_pharma',
  'project_management_pharma',
] as const;

export const SPECIALIST_PHARMA_PLAYBOOK_IDS = [
  'creative_pharma',
  'mlr_ops_pharma',
  'dev_veeva_pharma',
] as const;

export const NON_PHARMA_ROLE_PLAYBOOK_IDS = [
  'account_management_non_pharma',
  'project_management_non_pharma',
] as const;

/** Playbooks shown as "Coming soon" until they have at least this many steps. */
export const SPECIALIST_MIN_STEPS = 4;

export function isSpecialistPlaybook(playbookId: string): boolean {
  return (SPECIALIST_PHARMA_PLAYBOOK_IDS as readonly string[]).includes(playbookId);
}

export function specialistComingSoon(stepCount: number): boolean {
  return stepCount < SPECIALIST_MIN_STEPS;
}

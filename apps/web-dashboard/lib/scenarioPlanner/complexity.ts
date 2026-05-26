export const SCENARIO_COMPLEXITIES = ['basic', 'medium', 'complex'] as const;

export type ScenarioComplexity = (typeof SCENARIO_COMPLEXITIES)[number];

/** Multiplier on non-PRB phase spans (composed with tactic multipliers). */
export function complexitySpanMultiplier(c: ScenarioComplexity): number {
  if (c === 'basic') return 0.85;
  if (c === 'medium') return 1;
  if (c === 'complex') return 1.25;
  const _exhaustive: never = c;
  return _exhaustive;
}

export function scenarioComplexityLabel(c: ScenarioComplexity): string {
  if (c === 'basic') return 'Basic';
  if (c === 'medium') return 'Medium';
  if (c === 'complex') return 'Complex';
  const _exhaustive: never = c;
  return _exhaustive;
}

/** Number of PRB submit/review rounds included in the schedule (basic=1, medium=2, complex=3). */
export type PrbRounds = 1 | 2 | 3;

export function prbRoundsForComplexity(c: ScenarioComplexity): PrbRounds {
  if (c === 'basic') return 1;
  if (c === 'medium') return 2;
  return 3;
}

/** Basic complexity: replaces scaled days (tactic × complexity) for these phases before modifiers. */
const BASIC_SCALED_DAYS_OVERRIDE: Readonly<Partial<Record<string, number>>> = {
  manuscript_development: 2,
  complete_initial_edit_start_fact_check: 1,
  complete_fact_check: 1,
  route_to_clean: 1,
};

/** Fixed scaled working-day count for Basic only; undefined if normal scaling applies. */
export function basicScaledDaysOverride(phaseId: string): number | undefined {
  return BASIC_SCALED_DAYS_OVERRIDE[phaseId];
}

const PRB2_BLOCK_STEP_IDS: readonly string[] = [
  'share_client_approval_prb2',
  'submit_prb2',
  'development_prb2',
  'prb2_review',
  'revisions_post_prb2',
];

const PRB3_BLOCK_STEP_IDS: readonly string[] = [
  'share_client_approval_prb3',
  'submit_prb3',
  'development_prb3',
  'prb3_review',
  'revisions_post_prb3',
];

const OMIT_IDS_BY_ROUNDS: Record<PrbRounds, ReadonlySet<string>> = {
  1: new Set([...PRB2_BLOCK_STEP_IDS, ...PRB3_BLOCK_STEP_IDS]),
  2: new Set(PRB3_BLOCK_STEP_IDS),
  3: new Set(),
};

export function filterScenarioStepsForPrbRounds<T extends { id: string }>(
  steps: readonly T[],
  rounds: PrbRounds,
): T[] {
  const omit = OMIT_IDS_BY_ROUNDS[rounds];
  if (omit.size === 0) return [...steps];
  return steps.filter((s) => !omit.has(s.id));
}

import type { ScenarioTactic } from '../scenarioPlanner/tactics';

export const OMNICHANNEL_PLAN_VERSION = 1 as const;

export type OmnichannelPlanRow = {
  id: string;
  order: number;
  tactic_library_id: string;
  tactic_key?: string;
  label_snapshot?: string;
  /** Preferred: timing profile id from `timing_profiles.json`. */
  timing_profile?: ScenarioTactic | null;
  /** @deprecated Prefer timing_profile; kept for older plan JSON. */
  scenario_tactic?: ScenarioTactic | null;
  notes?: string;
  metadata?: Record<string, unknown>;
};

export type OmnichannelPlan = {
  version: typeof OMNICHANNEL_PLAN_VERSION;
  project_key: string;
  rows: OmnichannelPlanRow[];
};

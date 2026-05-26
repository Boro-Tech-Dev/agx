export type ScenarioStepDef = {
  id: string;
  label: string;
  baseline_days: number;
  min_days?: number;
  max_days?: number;
  note: string;
};

export type StepsConfigFile = {
  version: number;
  steps: ScenarioStepDef[];
};

export type ModifierBundleFile = {
  id: string;
  label: string;
  description?: string;
  deltas: Record<string, number>;
  /** Optional per-phase note append when this modifier is active (Scenario planner UI / CSV). */
  phase_notes?: Record<string, string>;
};

export type ModifiersRegistryFile = {
  version: number;
  modifiers: { id: string; description?: string }[];
};

export type LinearStepBreakdown = {
  phase_id: string;
  baseline_days: number;
  scaled_days: number;
  modifier_deltas: Record<string, number>;
  effective_days: number;
};

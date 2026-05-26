import skillartsRteJson from '../../../config/scenario_planner/steps_skillarts_rte.json';
import happyguyMlrThursdayJson from '../../../config/scenario_planner/steps_happyguy_mlr_thursday.json';
import happyguyMlrTuesdayJson from '../../../config/scenario_planner/steps_happyguy_mlr_tuesday.json';
import stepsJson from '../../../config/scenario_planner/steps.json';
import modifiersRegistryJson from '../../../config/scenario_planner/modifiers.json';
import { happyGuyMlrSpineWeekday, resolveTimingProfileId, usesHappyGuyWeekAlignedPrbCadence } from '../timingProfiles';
import type { ModifiersRegistryFile, ScenarioStepDef, StepsConfigFile } from './types';

export const STEPS_CONFIG = stepsJson as StepsConfigFile;

type SkillArtsRteStepsFile = StepsConfigFile & { profile?: string; source?: string };

const SKILLARTS_RTE_STEPS = (skillartsRteJson as SkillArtsRteStepsFile).steps;

const HAPPYGUY_MLR_THURSDAY_STEPS = (happyguyMlrThursdayJson as SkillArtsRteStepsFile).steps;
const HAPPYGUY_MLR_TUESDAY_STEPS = (happyguyMlrTuesdayJson as SkillArtsRteStepsFile).steps;

export const MODIFIERS_REGISTRY = modifiersRegistryJson as ModifiersRegistryFile;

/** Ordered phases for the linear planner; SkillArts RTE spine replaces the default catalog when profile is `skillarts_generic`. */
export function getScenarioStepsOrdered(timingProfile?: string): ScenarioStepDef[] {
  const id = timingProfile ? resolveTimingProfileId(timingProfile) : '';
  if (id === 'skillarts_generic') return SKILLARTS_RTE_STEPS;
  if (usesHappyGuyWeekAlignedPrbCadence(id)) {
    return happyGuyMlrSpineWeekday(id) === 'tuesday' ? HAPPYGUY_MLR_TUESDAY_STEPS : HAPPYGUY_MLR_THURSDAY_STEPS;
  }
  return STEPS_CONFIG.steps;
}

import skillartsRteJson from '../../../config/scenario_planner/steps_skillarts_rte.json';
import happyguyAasldCongressPrintPickupJson from '../../../config/scenario_planner/steps_happyguy_aasld_congress_print_pickup.json';
import happyguyAasldCongressWifiSplashJson from '../../../config/scenario_planner/steps_happyguy_aasld_congress_wifi_splash.json';
import happyguyMpsWebsiteUpdateJson from '../../../config/scenario_planner/steps_happyguy_mps_website_update.json';
import happyguyBrandedCrmEmailJson from '../../../config/scenario_planner/steps_happyguy_branded_crm_email.json';
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
const AASLD_CONGRESS_PRINT_PICKUP_STEPS = (happyguyAasldCongressPrintPickupJson as SkillArtsRteStepsFile).steps;
const AASLD_CONGRESS_WIFI_SPLASH_STEPS = (happyguyAasldCongressWifiSplashJson as SkillArtsRteStepsFile).steps;
const MPS_WEBSITE_UPDATE_STEPS = (happyguyMpsWebsiteUpdateJson as SkillArtsRteStepsFile).steps;
const BRANDED_CRM_EMAIL_STEPS = (happyguyBrandedCrmEmailJson as SkillArtsRteStepsFile).steps;

/** Catalog tactic keys that select a variant spine under `happyguy_aasld_congress_print_pickup`. */
const AASLD_WIFI_SPLASH_CATALOG_KEY = 'happyguy_aasld_wifi_splash_page';

export const MODIFIERS_REGISTRY = modifiersRegistryJson as ModifiersRegistryFile;

/** Ordered phases for the linear planner; SkillArts RTE spine replaces the default catalog when profile is `skillarts_generic`. */
export function getScenarioStepsOrdered(timingProfile?: string, catalogTacticKey?: string): ScenarioStepDef[] {
  const id = timingProfile ? resolveTimingProfileId(timingProfile) : '';
  if (id === 'skillarts_generic') return SKILLARTS_RTE_STEPS;
  if (id === 'happyguy_aasld_congress_print_pickup') {
    if (catalogTacticKey?.trim() === AASLD_WIFI_SPLASH_CATALOG_KEY) return AASLD_CONGRESS_WIFI_SPLASH_STEPS;
    return AASLD_CONGRESS_PRINT_PICKUP_STEPS;
  }
  if (id === 'happyguy_mps_website_update') return MPS_WEBSITE_UPDATE_STEPS;
  if (id === 'happyguy_branded_crm_email') return BRANDED_CRM_EMAIL_STEPS;
  if (usesHappyGuyWeekAlignedPrbCadence(id)) {
    return happyGuyMlrSpineWeekday(id) === 'tuesday' ? HAPPYGUY_MLR_TUESDAY_STEPS : HAPPYGUY_MLR_THURSDAY_STEPS;
  }
  return STEPS_CONFIG.steps;
}

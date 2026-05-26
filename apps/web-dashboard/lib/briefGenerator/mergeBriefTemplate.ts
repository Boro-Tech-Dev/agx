import tacticOverridesJson from '../../config/brief_generator/tactic_overrides.json';
import presetsJson from '../../config/brief_generator/presets.json';
import skeletonJson from '../../config/brief_generator/skeleton.json';

import type { BriefTemplateBundle } from './briefMergeCore';
import type { BriefPresetsFile, BriefSkeletonConfig, BriefTacticOverridesFile } from './types';

export type { BriefTemplateBundle } from './briefMergeCore';
export * from './briefMergeCore';

/** Bundled defaults (build-time JSON); used when API has no published template. */
export const staticBriefTemplateBundle: BriefTemplateBundle = {
  skeleton: skeletonJson as BriefSkeletonConfig,
  tactic_overrides: tacticOverridesJson as BriefTacticOverridesFile,
  presets: presetsJson as BriefPresetsFile,
};

export function getSkeleton(bundle: BriefTemplateBundle = staticBriefTemplateBundle): BriefSkeletonConfig {
  return bundle.skeleton;
}

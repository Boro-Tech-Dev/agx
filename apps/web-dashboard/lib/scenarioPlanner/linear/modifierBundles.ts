import type { ModifierBundleFile } from './types';

import expedited_manuscript from '../../../config/scenario_planner/tactics/expedited_manuscript.json';
import extra_client_buffer from '../../../config/scenario_planner/tactics/extra_client_buffer.json';
import happyguy_milestones_thursday from '../../../config/scenario_planner/tactics/happyguy_milestones_thursday.json';
import happyguy_milestones_tuesday from '../../../config/scenario_planner/tactics/happyguy_milestones_tuesday.json';

/** Bundled modifier definitions — add an import + entry when creating `config/scenario_planner/tactics/<id>.json`. */
export const REGISTERED_MODIFIER_BUNDLES: Record<string, ModifierBundleFile> = {
  expedited_manuscript: expedited_manuscript as ModifierBundleFile,
  extra_client_buffer: extra_client_buffer as ModifierBundleFile,
  happyguy_milestones_thursday: happyguy_milestones_thursday as ModifierBundleFile,
  happyguy_milestones_tuesday: happyguy_milestones_tuesday as ModifierBundleFile,
};

/** Append modifier-supplied phase notes to baseline step notes (CSV / dashboard). */
export function mergeModifierPhaseNotes(
  phaseId: string,
  baseNote: string,
  activeModifierIds: readonly string[],
): string {
  let n = baseNote;
  for (const mid of activeModifierIds) {
    const b = REGISTERED_MODIFIER_BUNDLES[mid];
    const add = b?.phase_notes?.[phaseId];
    if (add) n = n ? `${n}\n\n${add}` : add;
  }
  return n;
}

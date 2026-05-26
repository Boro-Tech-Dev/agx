import type { ToolCatalogId } from '../toolCatalog';
import { askClarifierHowItsMade } from './askClarifier';
import { briefGeneratorHowItsMade } from './briefGenerator';
import { launchpadHowItsMade } from './launchpad';
import { learningHowItsMade } from './learning';
import { replyCoachHowItsMade } from './replyCoach';
import { omnichannelHowItsMade } from './omnichannel';
import { scenarioHowItsMade } from './scenario';
import type { HowItsMadeDoc } from './types';
import { veevaSuiteHowItsMade } from './veevaSuite';
import { webCaptureHowItsMade } from './webCapture';
import { webSearchHowItsMade } from './webSearch';

const REGISTRY: Record<ToolCatalogId, HowItsMadeDoc> = {
  ask_clarifier: askClarifierHowItsMade,
  brief_generator: briefGeneratorHowItsMade,
  launchpad: launchpadHowItsMade,
  learning: learningHowItsMade,
  omnichannel: omnichannelHowItsMade,
  reply_coach: replyCoachHowItsMade,
  scenario: scenarioHowItsMade,
  veeva_suite: veevaSuiteHowItsMade,
  web_capture: webCaptureHowItsMade,
  web_search: webSearchHowItsMade,
};

const TOOL_CATALOG_IDS: ToolCatalogId[] = [
  'ask_clarifier',
  'brief_generator',
  'launchpad',
  'learning',
  'omnichannel',
  'reply_coach',
  'scenario',
  'veeva_suite',
  'web_capture',
  'web_search',
];

export function getHowItsMadeDoc(toolId: ToolCatalogId): HowItsMadeDoc {
  return REGISTRY[toolId];
}

export function allHowItsMadeDocs(): HowItsMadeDoc[] {
  return TOOL_CATALOG_IDS.map((id) => REGISTRY[id]);
}

export function collectSourceRefPaths(): string[] {
  const paths = new Set<string>();
  for (const doc of allHowItsMadeDocs()) {
    for (const section of doc.sections) {
      for (const ref of section.sourceRefs ?? []) {
        paths.add(ref.path);
      }
    }
  }
  return Array.from(paths).sort();
}

export { TOOL_CATALOG_IDS };

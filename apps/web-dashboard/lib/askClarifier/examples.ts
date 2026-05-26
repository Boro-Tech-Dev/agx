import type { AskClarifierMode } from './types';

export type AskClarifierExample = {
  label: string;
  mode: AskClarifierMode;
  text: string;
  projectContext?: string;
  knownScope?: string;
  knownTimeline?: string;
};

export const ASK_CLARIFIER_EXAMPLES: AskClarifierExample[] = [
  {
    label: 'Homepage concepts',
    mode: 'intake',
    text: 'Can we get a few homepage concepts for the new campaign? Would be great to see options by next week.',
    projectContext: 'Agency team supporting a campaign refresh. Creative and web teams are already active on launch assets.',
    knownScope: 'Scoped work includes one campaign landing page refresh and two rounds of client review. Net-new concept exploration is not clearly listed.',
    knownTimeline: 'Client wants concepts by next week, but the current approved timeline has copy direction due first.',
  },
  {
    label: 'Quick CTA change',
    mode: 'scope',
    text: 'Can we quickly update the CTA and also show how that would look across the email, landing page, and paid social units?',
    projectContext: 'Multi-channel campaign with assets already in production.',
    knownScope: 'Scoped deliverables include one email, one landing page, and three paid social statics.',
    knownTimeline: 'Client review is scheduled in two business days.',
  },
  {
    label: 'Vague feedback',
    mode: 'feedback',
    text: 'This is close, but it still does not feel premium enough. Can the intro be more ownable and less expected?',
    projectContext: 'Client is reviewing round-two creative. Team needs actionable direction before assigning updates.',
  },
  {
    label: 'Pharma rush — HCP email',
    mode: 'intake',
    text: 'We need the HCP email in market next Friday. MLR said they might turn it around fast if we submit tomorrow. Can you confirm creative and get this through?',
    projectContext: 'AdvSm HCP brand. Email in round-two revisions. MLR has not approved current copy.',
    knownScope: 'Scoped: one HCP email, one layout round, submission-ready package — not in-market approval.',
    knownTimeline: 'Client wants live Friday; agency can target submission-ready Thursday pending MLR queue.',
  },
];

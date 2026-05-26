import type { ReplyCoachAudience, ReplyCoachSituation, ReplyCoachTone } from './types';

export type ReplyCoachExample = {
  label: string;
  situation: ReplyCoachSituation;
  tone: ReplyCoachTone;
  audience: ReplyCoachAudience;
  text: string;
  goal?: string;
  projectContext?: string;
  constraints?: string;
};

export const REPLY_COACH_EXAMPLES: ReplyCoachExample[] = [
  {
    label: 'Rush request',
    situation: 'timeline_pressure',
    tone: 'diplomatic',
    audience: 'client',
    text: 'Can you turn this around by tomorrow? It should just be a quick update.',
    goal: 'Acknowledge urgency without committing until the team reviews the work.',
    projectContext: 'Active campaign assets are in client review. Design and copy may both be affected.',
    constraints: 'Do not promise tomorrow. Need to confirm whether this is copy-only or design/layout work.',
  },
  {
    label: 'Free extra work',
    situation: 'scope_pressure',
    tone: 'firm',
    audience: 'client',
    text: 'While we are in there, can you also create a second version for the sales team and include it in this round?',
    goal: 'Protect scope while staying helpful.',
    projectContext: 'Original scope includes one version and two review rounds.',
    constraints: 'Second version may require copy, design, QA, and approval time.',
  },
  {
    label: 'Pharma — MLR approval pressure',
    situation: 'timeline_pressure',
    tone: 'diplomatic',
    audience: 'client',
    text: 'If we submit to MLR tomorrow, can you guarantee approval by Friday so we can launch the HCP email?',
    goal: 'Clarify scope and avoid promising MLR approval dates.',
    projectContext: 'Regulated HCP email; client MLR queue is outside agency control.',
    constraints: 'Do not promise approval. Offer submission-ready date and note MLR turnaround is client-owned.',
  },
];

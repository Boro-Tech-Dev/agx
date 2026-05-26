export const HOME_HERO_LINE_ONE = 'Chaos in. Clarity out.';
export const HOME_HERO_LINE_TWO =
  'PM Operator Grid for routing asks, generating briefs, reviewing work, and clearing agency sludge.';

export type HomeHeroCtaIcon = 'arrow' | 'settings' | 'grid' | 'spark';

export type HomeHeroCta = {
  label: string;
  href: string;
  variant: 'primary' | 'ghost';
  icon?: HomeHeroCtaIcon;
};

export type HomeHeroSlide = {
  id: string;
  eyebrow?: string;
  headline: string;
  subline: string;
  ctas: HomeHeroCta[];
};

export const HOME_HERO_SLIDES: HomeHeroSlide[] = [
  {
    id: 'chaos-clarity',
    headline: HOME_HERO_LINE_ONE,
    subline: HOME_HERO_LINE_TWO,
    ctas: [
      { label: 'Open Command Grid', href: '#home-tools-heading', variant: 'primary', icon: 'arrow' },
      { label: 'Review Tools', href: '/tools', variant: 'ghost', icon: 'settings' },
    ],
  },
  {
    id: 'route-generate',
    eyebrow: 'Operator flow',
    headline: 'Route asks. Generate briefs. Clear the queue.',
    subline:
      'Nine agents, eight tools, and live run telemetry — one grid for PMs who need answers, not another tab circus.',
    ctas: [
      { label: 'View monitoring', href: '/monitoring', variant: 'primary', icon: 'grid' },
      { label: 'Open workspaces', href: '/workspaces', variant: 'ghost', icon: 'arrow' },
    ],
  },
  {
    id: 'rag-tag',
    eyebrow: 'How it works',
    headline: 'RAG grounds the model. TAG tags the work.',
    subline:
      'Retrieval pulls project memory into every run; structured tags keep outputs traceable from ask through approval.',
    ctas: [
      { label: 'Explore memory', href: '/memory', variant: 'primary', icon: 'spark' },
      { label: 'Pending approvals', href: '/approvals', variant: 'ghost', icon: 'arrow' },
    ],
  },
];

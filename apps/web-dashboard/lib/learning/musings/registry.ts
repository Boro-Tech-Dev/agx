import { THE_STACK_BODY } from './the-stack';

export type LearningMusing = {
  slug: string;
  title: string;
  excerpt: string;
  body: string;
};

const MUSINGS: LearningMusing[] = [
  {
    slug: 'the-stack',
    title: 'The Stack',
    excerpt: 'Most people treat AI like a vending machine.',
    body: THE_STACK_BODY,
  },
];

export function learningMusingsList(): LearningMusing[] {
  return MUSINGS;
}

export function learningMusingBySlug(slug: string): LearningMusing | undefined {
  return MUSINGS.find((m) => m.slug === slug);
}

export function learningMusingHref(slug: string): string {
  return `/tools/learning/musings/${encodeURIComponent(slug)}`;
}

export function learningMusingSlugs(): string[] {
  return MUSINGS.map((m) => m.slug);
}

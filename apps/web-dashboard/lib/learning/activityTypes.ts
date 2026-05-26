/** Activity content merged from config/learning/content/{playbook}/{step}.json */

export type LearningActivitySection = {
  heading?: string;
  paragraphs?: string[];
  bullets?: string[];
};

export type LearningActivityToolCta = {
  label: string;
  href: string;
  hint?: string;
};

export type LearningStepActivity = {
  summary?: string;
  sections?: LearningActivitySection[];
  body?: string;
  tool_cta?: LearningActivityToolCta;
  reflection_prompt?: string;
  governance_anchor?: string;
};

export type LearningPlaybookStep = {
  id: string;
  title: string;
  kind?: string;
  href?: string;
  validation?: { type?: string; title?: string; passingScore?: number };
  quiz?: {
    passingScore?: number;
    questions?: { id: string; prompt: string; options: string[]; correctIndex: number }[];
  };
  governance_anchor?: string;
  activity?: LearningStepActivity;
  body?: string;
};

export type LearningPlaybook = {
  id: string;
  title: string;
  version?: number;
  missions?: {
    id: string;
    title: string;
    steps?: LearningPlaybookStep[];
  }[];
};

export function stepHasActivityContent(step: LearningPlaybookStep | null | undefined): boolean {
  if (!step?.activity) return Boolean(step?.body);
  const a = step.activity;
  return Boolean(
    a.summary ||
      a.body ||
      (a.sections && a.sections.length > 0) ||
      (a.tool_cta && a.tool_cta.href),
  );
}

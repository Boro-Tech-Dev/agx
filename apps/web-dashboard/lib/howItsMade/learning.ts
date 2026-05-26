import type { HowItsMadeDoc } from './types';

export const learningHowItsMade: HowItsMadeDoc = {
  toolId: 'learning',
  title: 'Learning',
  lastVerifiedFromCode: '2026-05-18',
  ai: {
    usesLlm: true,
    summary:
      'Twiki (canon) powers the optional learning coach via POST /api/learning/coach. Playbook content is static JSON; progress and validation use Postgres.',
    details: ['Coach agent: canon', 'Task type: learning_coach'],
  },
  architectureSummary:
    'Versioned playbooks under config/learning/; enrollments and step completions in Postgres; sandbox projects per user; brand overlays merged server-side.',
  architectureMermaid: `flowchart LR
  UI[LearningToolPanel] --> api[agent-api /api/learning]
  api --> pg[(Postgres)]
  api --> json[config/learning JSON]
  UI --> tools[Sibling tools with enrollment query]`,
  sections: [
    {
      id: 'content',
      title: 'Playbook content',
      bullets: [
        'pharma_knowledge.v1.json — general pharma literacy module',
        'roles/*.v1.json — Account / PM tracks (pharma and non-pharma)',
        'brands/*.v1.json — optional overlay at enroll',
      ],
      sourceRefs: [{ path: 'config/learning/SCHEMA.md' }],
    },
    {
      id: 'validation',
      title: 'Step validation',
      bullets: [
        'manual — explicit button',
        'memory — metadata.learning_enrollment_id + learning_step_id on sandbox project',
        'document — source_documents on sandbox after enroll',
        'run — completed pm/kitt run on sandbox',
        'quiz — inline JSON; failures link to governance anchors',
      ],
      sourceRefs: [{ path: 'apps/agent-api/app/services/learning_service.py' }],
    },
  ],
};

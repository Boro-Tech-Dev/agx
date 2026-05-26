import type { HowItsMadeDoc } from './types';
import { PLATFORM_WORKERS_TABLE } from './sharedPlatform';

export const replyCoachHowItsMade: HowItsMadeDoc = {
  toolId: 'reply_coach',
  title: 'Reply Coach',
  lastVerifiedFromCode: '2026-05-18',
  ai: {
    usesLlm: true,
    summary:
      'Uses agent-api plus model-router for structured JSON generation. The UI sends a tricky message, audience, tone, situation type, and optional context; the backend constrains output with a JSON schema and returns normalized response coaching.',
    details: [
      'Agent: bubs',
      'Task type: reply_coach',
      'Model override: tinyllama:1.1b',
      'Schema enforced at model-router: summary, posture, risk, strategy, suggested/short/firm replies, internal note, questions, commitments to avoid, do-not-say list, and next steps.',
    ],
  },
  architectureSummary:
    'Client-side React panel posts message context to agent-api, which routes a schema-bound prompt to model-router. Results render as structured response cards, can be copied as reply/Markdown, and can be saved to project memory via createMemory.',
  architectureMermaid: `flowchart LR
  UI[ReplyCoachPanel] --> api[agent-api /api/reply-coach/draft]
  api --> mr[model-router /v1/route]
  mr --> ollama[(local model backend)]
  UI --> md[renderReplyCoachMarkdown]
  UI --> mem[POST /api/memory]`,
  sections: [
    {
      id: 'frontend',
      title: 'Frontend panel',
      paragraphs: [
        'The Reply Coach UI is a RagTag tool panel with situation, tone, audience, message, goal, context, and constraint fields. It renders the output as client-ready response options plus internal guardrails for PM and Account users.',
      ],
      sourceRefs: [
        { path: 'apps/web-dashboard/components/tools/ReplyCoachPanel.tsx' },
        { path: 'apps/web-dashboard/lib/replyCoach/types.ts' },
        { path: 'apps/web-dashboard/lib/replyCoach/examples.ts' },
        { path: 'apps/web-dashboard/lib/replyCoach/renderMarkdown.ts' },
      ],
    },
    {
      id: 'routing',
      title: 'Tool catalog routing',
      bullets: [
        'Tool catalog id: reply_coach',
        'Route slug: /tools/reply-coach',
        'Sidebar nav key: tool_reply_coach',
        'Output kind: reply_strategy',
      ],
      sourceRefs: [
        { path: 'apps/web-dashboard/lib/toolCatalog.ts' },
        { path: 'apps/web-dashboard/lib/navConfig.ts' },
        { path: 'apps/web-dashboard/components/tools/ToolDetailView.tsx' },
      ],
    },
    {
      id: 'api',
      title: 'Agent API route',
      routes: [
        {
          method: 'POST',
          path: '/api/reply-coach/draft',
          handler: 'draft_reply',
          proxyTarget: 'model-router /v1/route',
          timeout: 'connect 30s / read 240s',
          note: 'Builds an agency PM/account response-coaching prompt and enforces a structured JSON schema.',
        },
      ],
      sourceRefs: [
        { path: 'apps/agent-api/app/routes/reply_coach.py' },
        { path: 'apps/agent-api/app/main.py', symbol: 'app.include_router(reply_coach.router)' },
        { path: 'apps/web-dashboard/lib/api.ts', symbol: 'postReplyCoach' },
      ],
    },
    {
      id: 'schema',
      title: 'Structured output schema',
      bullets: [
        'situation_summary — plain-English interpretation of the message',
        'recommended_posture — how the PM/AM should approach the response',
        'risk_level and primary_risk — pressure, scope, or commitment watchouts',
        'suggested_reply, short_reply, and firm_reply — paste-ready response options',
        'internal_note — direct agency-side warning or guidance',
        'questions_to_ask, commitments_to_avoid, do_not_say, and next_steps — operational guardrails',
      ],
      sourceRefs: [{ path: 'apps/agent-api/app/routes/reply_coach.py', symbol: '_schema' }],
    },
    {
      id: 'persistence',
      title: 'Persistence',
      bullets: [
        'The response coaching result is not stored automatically.',
        'The panel can save the rendered Markdown to project memory via saveToolOutputAsMemory (POST /api/memory).',
        'Metadata includes source_tool=reply_coach for traceability.',
      ],
      sourceRefs: [
        { path: 'apps/web-dashboard/lib/tools/saveToolOutputAsMemory.ts' },
        { path: 'apps/web-dashboard/components/tools/ReplyCoachPanel.tsx', symbol: 'saveMarkdown' },
        { path: 'apps/web-dashboard/lib/replyCoach/renderMarkdown.ts', symbol: 'renderReplyCoachMarkdown' },
      ],
    },
    PLATFORM_WORKERS_TABLE,
  ],
};

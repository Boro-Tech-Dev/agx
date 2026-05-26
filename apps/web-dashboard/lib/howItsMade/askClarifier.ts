import type { HowItsMadeDoc } from './types';
import { PLATFORM_WORKERS_TABLE } from './sharedPlatform';

export const askClarifierHowItsMade: HowItsMadeDoc = {
  toolId: 'ask_clarifier',
  title: 'Ask Clarifier',
  lastVerifiedFromCode: '2026-05-18',
  ai: {
    usesLlm: true,
    summary:
      'Uses agent-api plus model-router for structured JSON generation. The UI sends the request, mode, tone, and optional context; the backend constrains output with a JSON schema and returns normalized PM/account guidance.',
    details: [
      'Agent: bubs',
      'Task type: ask_clarifier',
      'Model override: tinyllama:1.1b',
      'Schema enforced at model-router: request type, clarity score, readiness, clarifying questions, assumptions, risks, next step, reply, handoff note, and missing inputs.',
    ],
  },
  architectureSummary:
    'Client-side React panel posts intake text to agent-api, which routes a schema-bound prompt to model-router. Results render as structured cards, can be copied as reply/Markdown, and can be saved to project memory via createMemory.',
  architectureMermaid: `flowchart LR
  UI[AskClarifierPanel] --> api[agent-api /api/ask-clarifier/analyze]
  api --> mr[model-router /v1/route]
  mr --> ollama[(local model backend)]
  UI --> md[renderAskClarifierMarkdown]
  UI --> mem[POST /api/memory]`,
  sections: [
    {
      id: 'frontend',
      title: 'Frontend panel',
      paragraphs: [
        'The Ask Clarifier UI is a single RagTag tool panel with intake controls, mode/tone selectors, optional context fields, example loaders, result cards, copy buttons, and save-to-project-document behavior.',
      ],
      sourceRefs: [
        { path: 'apps/web-dashboard/components/tools/AskClarifierPanel.tsx' },
        { path: 'apps/web-dashboard/lib/askClarifier/types.ts' },
        { path: 'apps/web-dashboard/lib/askClarifier/examples.ts' },
        { path: 'apps/web-dashboard/lib/askClarifier/renderMarkdown.ts' },
      ],
    },
    {
      id: 'routing',
      title: 'Tool catalog routing',
      bullets: [
        'Tool catalog id: ask_clarifier',
        'Route slug: /tools/ask-clarifier',
        'Sidebar nav key: tool_ask_clarifier',
        'Output kind: clarification_plan',
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
          path: '/api/ask-clarifier/analyze',
          handler: 'analyze_ask_clarifier',
          proxyTarget: 'model-router /v1/route',
          timeout: 'connect 30s / read 240s',
          note: 'Builds an agency PM/account prompt and enforces a structured JSON schema.',
        },
      ],
      sourceRefs: [
        { path: 'apps/agent-api/app/routes/ask_clarifier.py' },
        { path: 'apps/agent-api/app/main.py', symbol: 'app.include_router(ask_clarifier.router)' },
        { path: 'apps/web-dashboard/lib/api.ts', symbol: 'postAskClarifier' },
      ],
    },
    {
      id: 'schema',
      title: 'Structured output schema',
      bullets: [
        'request_type — plain-English classification of the ask',
        'clarity_score — 0-100 readiness score',
        'overall_readiness — ready_to_assign, needs_clarification, or high_risk',
        'clarifying_questions — category, priority, owner, why it matters, and risk if unanswered',
        'assumptions_to_validate — hidden assumptions with confidence and confirmation route',
        'risks — severity and mitigation',
        'suggested_reply — diplomatic response the AM/PM can send',
        'internal_handoff_note — direct operational note for the agency team',
      ],
      sourceRefs: [{ path: 'apps/agent-api/app/routes/ask_clarifier.py', symbol: '_schema' }],
    },
    {
      id: 'persistence',
      title: 'Persistence',
      bullets: [
        'The analysis itself is not stored automatically.',
        'The panel can save the rendered Markdown to project memory via saveToolOutputAsMemory (POST /api/memory).',
        'Metadata includes source_tool=ask_clarifier for traceability.',
      ],
      sourceRefs: [
        { path: 'apps/web-dashboard/lib/tools/saveToolOutputAsMemory.ts' },
        { path: 'apps/web-dashboard/components/tools/AskClarifierPanel.tsx', symbol: 'saveMarkdown' },
        { path: 'apps/web-dashboard/lib/askClarifier/renderMarkdown.ts', symbol: 'renderAskClarifierMarkdown' },
      ],
    },
    PLATFORM_WORKERS_TABLE,
  ],
};

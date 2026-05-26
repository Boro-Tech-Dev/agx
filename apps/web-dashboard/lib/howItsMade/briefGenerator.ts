import type { HowItsMadeDoc } from './types';
import { AGENT_RUNS_NOT_USED, DOCUMENT_INGEST_SECTION, PLATFORM_WORKERS_TABLE } from './sharedPlatform';

export const briefGeneratorHowItsMade: HowItsMadeDoc = {
  toolId: 'brief_generator',
  title: 'Brief Generator',
  lastVerifiedFromCode: '2026-05-17',
  ai: {
    usesLlm: true,
    summary: 'LLM is used only for field autofill (paste prose or source document). Skeleton merge, markdown render, template validation, and save/load are deterministic.',
    details: [
      'POST /api/brief/autofill → model-router POST /v1/route',
      'agent: builder, task_type: brief_autofill',
      'Structured JSON schema: { extracted: { [field_id]: string } }',
      'Prompt: empty string when missing; do not invent medical/regulatory/legal claims',
      'From-document path: loads document_chunks for ready source doc, capped by BRIEF_AUTOFILL_MAX_CHARS (default 16000)',
      'Model: routing.resolve_model(builder) → default_builder_model (Ollama via model-router)',
    ],
  },
  architectureSummary:
    'Published brief template bundles (Postgres + static defaults) define section skeleton and tactic presets. The UI merges presets into field values, optionally calls LLM autofill, renders Markdown, and saves JSON project documents (kind brief).',
  architectureMermaid: `flowchart LR
  UI[BriefFactoryInner] --> api[agent-api]
  api --> templates[brief_templates CRUD]
  api --> autofill[brief_autofill]
  autofill --> mr[model-router :8085]
  mr --> ollama[Ollama]
  UI --> tactics[/api/tactics]
  UI --> docs[project documents brief]`,
  sections: [
    {
      id: 'frontend',
      title: 'Frontend',
      sourceRefs: [
        { path: 'apps/web-dashboard/components/tools/BriefGeneratorPanel.tsx' },
        { path: 'apps/web-dashboard/components/tools/brief/BriefFactoryInner.tsx', symbol: 'runAutofill, saveDoc' },
        { path: 'apps/web-dashboard/lib/briefGenerator/briefMergeCore.ts', symbol: 'visibleSectionsForTactic, mergeDefaultValues, parseBriefDoc' },
        { path: 'apps/web-dashboard/lib/briefGenerator/renderMarkdown.ts', symbol: 'renderBriefMarkdown' },
        { path: 'apps/web-dashboard/lib/briefGenerator/useBriefTemplateConfig.ts' },
      ],
      bullets: [
        'useBriefTemplateConfig loads GET /api/brief-templates/published or staticBriefTemplateBundle fallback',
        'visibleSectionsForTactic hides internal_production unless tactic override or slide_deck_scientific preset',
        'mergeDefaultValues applies preset field_defaults when preset matches tactic_key',
        'Markdown preview from renderBriefMarkdown (## section / ### field)',
      ],
    },
    {
      id: 'routes',
      title: 'API routes',
      routes: [
        { method: 'POST', path: '/api/brief/autofill', handler: 'brief_autofill', proxyTarget: 'model-router /v1/route', timeout: 'read 240s' },
        { method: 'POST', path: '/api/brief/autofill-from-document', handler: 'brief_autofill_from_document' },
        { method: 'GET', path: '/api/brief-templates/published', handler: 'get_published' },
        { method: 'GET/PUT/PATCH', path: '/api/brief-templates/draft', handler: 'draft CRUD' },
        { method: 'POST', path: '/api/brief-templates/publish', handler: 'publish' },
        { method: 'GET', path: '/api/tactics', handler: 'list_tactics (library)' },
        { method: 'POST', path: '/api/projects/{key}/documents', handler: 'upload kind=brief', note: 'Triggers document.ingest downstream' },
      ],
      sourceRefs: [
        { path: 'apps/agent-api/app/routes/brief_autofill.py' },
        { path: 'apps/agent-api/app/routes/brief_templates.py' },
        { path: 'apps/agent-api/app/routes/tactics.py' },
      ],
    },
    {
      id: 'llm',
      title: 'LLM autofill implementation',
      formulas: [
        '_build_schema(field_ids) → JSON Schema object with extracted.{field_id}: string, additionalProperties: false',
        'user_msg lists field ids + labels, then prose block',
        'system: "You extract brief fields and reply only as structured JSON via the schema."',
      ],
      sourceRefs: [
        { path: 'apps/agent-api/app/routes/brief_autofill.py', symbol: '_run_brief_autofill, _build_schema' },
        { path: 'apps/model-router/router/routing.py', symbol: 'resolve_model' },
      ],
    },
    {
      id: 'data',
      title: 'Data models',
      bullets: [
        'Postgres: brief_template_bundle, brief_template_active, brief_template_draft',
        'Saved doc JSON: { version: 1, kind: brief_generator, tactic_key, preset_id, values, markdown_cache?, updated_at? }',
        'document_kind: brief in document_kinds.py',
        'Static defaults: config/brief_generator/ and apps/agent-api/app/brief_defaults/',
      ],
      sourceRefs: [
        { path: 'apps/agent-api/app/services/brief_template_service.py' },
        { path: 'apps/agent-api/app/services/brief_template_validate.py', symbol: 'validate_brief_bundle' },
        { path: 'infra/postgres/schema.sql', note: 'brief_template_* tables' },
      ],
    },
    {
      id: 'validation',
      title: 'Template validation (non-AI)',
      bullets: [
        'validate_brief_bundle: version, duplicate field IDs in skeleton, preset tactic keys, hideSectionIds',
      ],
      sourceRefs: [{ path: 'apps/agent-api/app/services/brief_template_validate.py' }],
    },
    DOCUMENT_INGEST_SECTION,
    PLATFORM_WORKERS_TABLE,
    {
      id: 'explicit-non-goals',
      title: 'Explicitly not used',
      bullets: [
        'agent.runs queue and conversational agents for core brief editing',
        'scenario-worker, browser-runner, veeva-suite-worker, tool-runner',
        'Schedule math or tactics apply (Omnichannel owns project_tactics sync)',
      ],
      queues: [AGENT_RUNS_NOT_USED],
    },
  ],
};

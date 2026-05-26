import type { HowItsMadeDoc } from './types';
import { AGENT_RUNS_NOT_USED, DOCUMENT_INGEST_SECTION, PLATFORM_WORKERS_TABLE } from './sharedPlatform';

export const omnichannelHowItsMade: HowItsMadeDoc = {
  toolId: 'omnichannel',
  title: 'Omnichannel Planner',
  lastVerifiedFromCode: '2026-05-17',
  ai: {
    usesLlm: false,
    summary: 'No LLM. Plan editing, validation, and apply-to-project are deterministic JSON + Postgres.',
  },
  architectureSummary:
    'Ordered tactic rows (UUID tactic_library_id, timing_profile, notes) stored as versioned project documents (omnichannel_plan). Optional apply syncs rows to project_tactics without replacing stored plan JSON.',
  architectureMermaid: `flowchart LR
  UI[OmnichannelPlannerPanel] --> api[agent-api]
  api --> tactics[/api/tactics + project tactics]
  api --> apply[omnichannel-plans/apply]
  api --> docs[documents omnichannel_plan]
  UI --> timing[resolveTimingProfileFromTacticRow]`,
  sections: [
    {
      id: 'frontend',
      title: 'Frontend',
      sourceRefs: [
        { path: 'apps/web-dashboard/components/tools/OmnichannelPlannerPanel.tsx' },
        { path: 'apps/web-dashboard/lib/omnichannelPlanner/planModel.ts', symbol: 'normalizePlanOrders, moveRow, parseUnknownPlan' },
        { path: 'apps/web-dashboard/lib/omnichannelPlanner/types.ts' },
        { path: 'apps/web-dashboard/lib/scenarioPlanner/resolveTimingProfileFromTacticRow.ts' },
        { path: 'apps/web-dashboard/lib/tacticLibraryFilter.ts' },
      ],
      bullets: [
        'createEmptyPlan, rowFromLibrary, rowFromProjectTactic seed rows with crypto.randomUUID()',
        'parseUnknownPlan: client validation (version 1, project_key match, UUIDs, timing tokens)',
        'Timing resolution: library metadata.timing_profile → scenario_tactic → config/tactic_library/catalog.json → project inference',
        'Shares timing profile UI with ScenarioPanel when parent-controlled from Tools page',
      ],
    },
    {
      id: 'routes',
      title: 'API routes',
      routes: [
        { method: 'POST', path: '/api/projects/{key}/omnichannel-plans/apply', handler: 'apply_omnichannel_plan' },
        { method: 'GET', path: '/api/projects/{key}/tactics', handler: 'list_project_tactics' },
        { method: 'GET', path: '/api/tactics', handler: 'library' },
        { method: 'POST', path: '/api/projects/{key}/documents', handler: 'upload omnichannel_plan', note: 'New file per save = version history' },
      ],
      sourceRefs: [
        { path: 'apps/agent-api/app/routes/projects.py', symbol: 'apply_omnichannel_plan' },
        { path: 'apps/agent-api/app/schemas/omnichannel_plan.py' },
      ],
    },
    {
      id: 'apply-algorithm',
      title: 'Apply algorithm',
      bullets: [
        'Verify project exists; plan.project_key must match URL',
        'Sort rows by order ascending',
        'For each row: verify tactics.id exists; build metadata patch { omnichannel_row_id, timing_profile, scenario_tactic }',
        'If project_tactics row exists → UPDATE notes + metadata; else INSERT lifecycle_status=draft, priority=medium',
        'Returns { applied, details: [{ project_tactic_id, tactic_id, action: updated|attached }] }',
      ],
      formulas: [
        'normalizePlanOrders: sort by order, reindex 0..n-1',
        'moveRow: swap adjacent, reindex',
      ],
      sourceRefs: [{ path: 'apps/agent-api/app/routes/projects.py', symbol: 'apply_omnichannel_plan' }],
    },
    {
      id: 'data',
      title: 'Plan JSON (v1)',
      formulas: [
        '{ version: 1, project_key, rows: [{ id, order, tactic_library_id, tactic_key?, label_snapshot?, timing_profile?, scenario_tactic?, notes?, metadata? }] }',
      ],
      sourceRefs: [
        { path: 'apps/web-dashboard/lib/omnichannelPlanner/types.ts' },
        { path: 'apps/agent-api/app/document_kinds.py', note: 'omnichannel_plan' },
      ],
    },
    DOCUMENT_INGEST_SECTION,
    PLATFORM_WORKERS_TABLE,
    {
      id: 'explicit-non-goals',
      title: 'Explicitly not used',
      bullets: [
        'scenario-worker (timing profile is metadata only; no schedule compute on save/apply)',
        'model-router / LLM',
        'agent.runs',
      ],
      queues: [AGENT_RUNS_NOT_USED],
    },
  ],
};

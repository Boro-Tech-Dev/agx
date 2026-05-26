import type { HowItsMadeDoc } from './types';
import { AGENT_RUNS_NOT_USED, DOCUMENT_INGEST_SECTION, PLATFORM_WORKERS_TABLE } from './sharedPlatform';

export const scenarioHowItsMade: HowItsMadeDoc = {
  toolId: 'scenario',
  title: 'Scenario Planner',
  lastVerifiedFromCode: '2026-05-17',
  ai: {
    usesLlm: false,
    summary: 'Schedule math is 100% deterministic Python (scenario-worker). TypeScript scenarioPlanner/* mirrors logic for unit tests and calendar UX only.',
  },
  architectureSummary:
    'UI posts kickoff/deadline + complexity + timing profile to agent-api, which proxies scenario-worker. Engine loads config/scenario_planner JSON (steps, holidays, tactic durations, PRB strategies) and returns dated steps.',
  architectureMermaid: `flowchart LR
  UI[ScenarioPanel] --> api[agent-api /api/scenario]
  api --> sw[scenario-worker :8093]
  sw --> engine[scenario_engine Python]
  engine --> cfg[config/scenario_planner]
  api -.fallback.-> aw[agent-worker /scenario]`,
  sections: [
    {
      id: 'routes',
      title: 'API routes',
      routes: [
        { method: 'POST', path: '/api/scenario/compute-scenario-steps', proxyTarget: 'scenario-worker POST /scenario/compute-scenario-steps' },
        { method: 'POST', path: '/api/scenario/find-latest-kickoff-for-deadline', proxyTarget: 'scenario-worker POST /scenario/find-latest-kickoff-for-deadline' },
      ],
      sourceRefs: [
        { path: 'apps/agent-api/app/routes/scenario.py' },
        { path: 'apps/scenario-worker/scenario_worker/main.py' },
        { path: 'apps/agent-worker/worker/main.py', note: 'Fallback /scenario/* if SCENARIO_WORKER_URL unset' },
      ],
    },
    {
      id: 'engine-entry',
      title: 'Engine entry points',
      sourceRefs: [
        { path: 'apps/agent-worker/worker/scenario_engine/compute_scenario_steps.py', symbol: 'compute_scenario_steps' },
        { path: 'apps/agent-worker/worker/scenario_engine/linear_scenario.py', symbol: 'compute_linear_scenario_steps' },
        { path: 'apps/agent-worker/worker/scenario_planning.py', symbol: 'run_scenario_engine_compute (adapter)' },
      ],
      bullets: [
        'compute_scenario_steps delegates to linear planner',
        'Supports freezeAfterStepIndex + pinnedPrefixSteps for partial replans',
      ],
    },
    {
      id: 'business-days',
      title: 'Business days & holidays',
      bullets: [
        'is_working_day: skip Saturday/Sunday + holiday set from config',
        'add_working_days_utc walks forward counting working days only',
        'next_working_day, working-day spans in working_days.py',
      ],
      sourceRefs: [
        { path: 'apps/agent-worker/worker/scenario_engine/working_days.py' },
        { path: 'apps/agent-worker/worker/scenario_engine/date_calendar.py' },
        { path: 'config/scenario_planner/holidays/us_federal_2026.json' },
      ],
    },
    {
      id: 'prb-complexity',
      title: 'PRB rounds & complexity',
      formulas: [
        'prb_rounds_for_complexity: basic→1, medium→2, complex→3',
        'complexity_span_multiplier: basic=0.85, medium=1.0, complex=1.25',
        'filter_scenario_steps_for_prb_rounds: omit PRB2_BLOCK_STEP_IDS / PRB3_BLOCK_STEP_IDS by round count',
      ],
      sourceRefs: [{ path: 'apps/agent-worker/worker/scenario_engine/complexity.py' }],
    },
    {
      id: 'prb-strategies',
      title: 'PRB placement strategies',
      bullets: [
        'happyguy_strategy.py — week-aligned PRB anchors',
        'schematic_strategy.py — MLR schematic cadence',
        'skillarts_strategy.py — tiered SkillArts rules',
        'prb_weekday_anchors.py — Mon/Wed submit/review anchors, email baseline',
        'email_baseline.py, tactic_durations.py, timing_profiles.py, phase_catalog.py',
      ],
      sourceRefs: [{ path: 'apps/agent-worker/worker/scenario_engine/' }],
    },
    {
      id: 'reverse-planner',
      title: 'Reverse planner (needed-by)',
      bullets: [
        'find_latest_kickoff_for_deadline: binary search kickoff offset up to 800 days so milestone end ≤ deadlineIso',
      ],
      sourceRefs: [{ path: 'apps/agent-worker/worker/scenario_engine/find_latest_kickoff.py' }],
    },
    {
      id: 'config',
      title: 'Configuration files',
      bullets: [
        'config/scenario_planner/steps.json — ordered step catalog',
        'timing_profiles.json, tactics/*.json — per-tactic durations and modifiers',
        'opdp_binder_compute.py — optional binder steps',
      ],
    },
    {
      id: 'ts-parity',
      title: 'TypeScript parity (not runtime compute)',
      bullets: [
        'apps/web-dashboard/lib/scenarioPlanner/* — unit tests + scenarioKeyDateCalendar UX',
        'test_scenario_engine.py (Python) and *.test.ts keep engines aligned',
      ],
    },
    {
      id: 'frontend',
      title: 'Frontend',
      sourceRefs: [
        { path: 'apps/web-dashboard/components/tools/ScenarioPlannerPanel.tsx' },
        { path: 'apps/web-dashboard/components/agents/ScenarioPanel.tsx' },
        { path: 'apps/web-dashboard/components/agents/ScenarioEditableStepsTable.tsx' },
        { path: 'apps/web-dashboard/lib/scenarioPlanner/scenarioKeyDateCalendar.ts' },
      ],
    },
    DOCUMENT_INGEST_SECTION,
    PLATFORM_WORKERS_TABLE,
    {
      id: 'explicit-non-goals',
      title: 'Explicitly not used',
      bullets: ['model-router / LLM for schedule compute', 'agent.runs', 'browser-runner, veeva-suite-worker'],
      queues: [AGENT_RUNS_NOT_USED],
    },
  ],
};

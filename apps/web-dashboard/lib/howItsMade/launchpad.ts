import type { HowItsMadeDoc } from './types';
import { PLATFORM_WORKERS_TABLE } from './sharedPlatform';

export const launchpadHowItsMade: HowItsMadeDoc = {
  toolId: 'launchpad',
  title: 'Launchpad',
  lastVerifiedFromCode: '2026-05-17',
  ai: {
    usesLlm: false,
    summary: 'No LLM, model-router, workers, or agent-api routes. All logic runs in the browser.',
  },
  architectureSummary:
    'Pure client-side React state persisted in localStorage. Readiness scoring, gate logic, checklist templates, ZIP filename heuristics, and status copy are deterministic TypeScript.',
  architectureMermaid: `flowchart LR
  UI[LaunchpadPanel] --> engine[engine.ts]
  UI --> zip[zipInspect.ts]
  UI --> tpl[templates.ts]
  engine --> ls[(localStorage)]
  zip --> FileAPI[File API ZIP scan]`,
  sections: [
    {
      id: 'frontend',
      title: 'Frontend components',
      sourceRefs: [
        { path: 'apps/web-dashboard/components/tools/LaunchpadPanel.tsx' },
        { path: 'apps/web-dashboard/lib/launchpad/engine.ts', symbol: 'summarizeLaunch, gateFrom, findingsForLaunch' },
        { path: 'apps/web-dashboard/lib/launchpad/zipInspect.ts', symbol: 'inspectLaunchpadFiles, extractZipFileNames' },
        { path: 'apps/web-dashboard/lib/launchpad/templates.ts', symbol: 'checklistForChannel' },
        { path: 'apps/web-dashboard/lib/launchpad/storage.ts', symbol: 'loadLaunches, saveLaunches' },
        { path: 'apps/web-dashboard/lib/launchpad/types.ts' },
      ],
      bullets: [
        'LaunchHeader, AddAssetForm, AssetCard, FindingsPanel are co-located in LaunchpadPanel.tsx.',
        'Each launch has assets; each asset has a channel-specific checklist and optional ZIP file inventory.',
      ],
    },
    {
      id: 'persistence',
      title: 'Persistence (no server)',
      bullets: [
        'dd.launchpad.launches.v1 — array of LaunchpadLaunch JSON',
        'dd.launchpad.activeLaunchId.v1 — selected launch id',
        'Export: JSON download in-panel; exportLaunchCsv for checklist matrix',
      ],
      sourceRefs: [{ path: 'apps/web-dashboard/lib/launchpad/storage.ts' }],
    },
    {
      id: 'readiness-score',
      title: 'Readiness score algorithm',
      formulas: [
        'statusWeight(status): complete | not_applicable → 1; in_progress → 0.5; else → 0',
        'score = allItems.length ? round((sum(statusWeight) / allItems.length) * 100) : 0',
        'where allItems = required checklist items across all assets',
        'Per-category score uses the same weighting on items in that category only.',
      ],
      sourceRefs: [{ path: 'apps/web-dashboard/lib/launchpad/engine.ts', symbol: 'statusWeight, summarizeLaunch' }],
    },
    {
      id: 'gate',
      title: 'Launch gate algorithm',
      formulas: [
        'gateFrom(blockers, warnings, total, completed):',
        '  blockers > 0 → blocked',
        '  total === 0 OR completed === 0 → not_started',
        '  warnings > 0 OR completed < total → yellow',
        '  else → ready',
        'assetIsReady(asset): no blocker findings (checklist + file) AND all required items complete or N/A',
      ],
      sourceRefs: [{ path: 'apps/web-dashboard/lib/launchpad/engine.ts', symbol: 'gateFrom, assetIsReady' }],
    },
    {
      id: 'findings',
      title: 'Finding generation',
      bullets: [
        'itemFinding: required item not complete/N/A → finding; status blocked → severity blocker, else severityIfMissing',
        'findingsForLaunch merges generated checklist findings, per-asset fileFindings, and launch-level findings',
      ],
      sourceRefs: [{ path: 'apps/web-dashboard/lib/launchpad/engine.ts', symbol: 'itemFinding, findingsForLaunch' }],
    },
    {
      id: 'zip',
      title: 'ZIP inventory heuristics',
      paragraphs: [
        'Scans ZIP central directory records (signature 0x02014b50) without fully unpacking. Filename rules run on lowercase paths.',
      ],
      bullets: [
        'Empty inventory → warning: no readable central directory',
        'No html/pdf/images → warning: no recognizable launch assets',
        'HTML without images → warning; HTML without screenshot/proof filenames → QA warning',
        'old|archive|deprecated|do-not-use → warning: obsolete files',
        'tk|fpo|placeholder → blocker: placeholder material',
        'No FINAL marker in names → documentation note',
        'fragment|frag → note suggesting Veeva Suite',
        'clm|slide|veeva → note for CLM navigation QA',
      ],
      sourceRefs: [{ path: 'apps/web-dashboard/lib/launchpad/zipInspect.ts', symbol: 'analyzeNames' }],
    },
    {
      id: 'status-copy',
      title: 'Status copy generators',
      bullets: [
        'internalSummary — score %, blocker/warning counts, top issue title + recommended action',
        'clientSummary — gate-aware client-safe prose (blocked / ready / in-progress variants)',
        'vendorSummary — ready asset fraction + blocker titles for release hold',
      ],
      sourceRefs: [{ path: 'apps/web-dashboard/lib/launchpad/engine.ts', symbol: 'summarizeLaunch' }],
    },
    {
      id: 'channels',
      title: 'Channel checklists',
      bullets: [
        'Channels: veeva_rte, veeva_clm, media, web, crm_email, print_pdf (+ shared blocks)',
        'Categories per item: approval, assets, qa, tracking, vendor, deployment, documentation, post_launch',
        'checklistForChannel returns channel-specific rows plus shared approval/documentation/post-launch blocks',
      ],
      sourceRefs: [{ path: 'apps/web-dashboard/lib/launchpad/templates.ts' }],
    },
    PLATFORM_WORKERS_TABLE,
    {
      id: 'explicit-non-goals',
      title: 'Explicitly not used',
      bullets: [
        'model-router, Ollama, agent-worker, scenario-worker, browser-runner, veeva-suite-worker',
        'Redis queues (including agent.runs and document.ingest — no uploads from Launchpad)',
        'Postgres / project documents API',
      ],
    },
  ],
};

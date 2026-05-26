import type { HowItsMadeDoc } from './types';
import { AGENT_RUNS_NOT_USED, DOCUMENT_INGEST_SECTION, PLATFORM_WORKERS_TABLE } from './sharedPlatform';

export const veevaSuiteHowItsMade: HowItsMadeDoc = {
  toolId: 'veeva_suite',
  title: 'Veeva Suite',
  lastVerifiedFromCode: '2026-05-19',
  ai: {
    usesLlm: false,
    summary: 'ZIP intake, DOM assembly, Playwright screenshots, and client-side QA scoring are deterministic. No live Veeva REST API; CLM JS APIs are mocked in-browser.',
  },
  architectureSummary:
    'Two-stage pipeline: veeva-suite-worker assembles preview ZIP from RTE/CLM upload; browser runs analyzeVeevaSuite on the JSON response for health/vendor scores and handoff copy.',
  architectureMermaid: `flowchart LR
  UI[VeevaSuitePanel] --> api[agent-api /api/veeva-suite]
  api --> vs[veeva-suite-worker :4317]
  vs --> core[suite-core assembleVeevaZip]
  UI --> sub[POST submission after RTE build]
  sub --> pdf[generateSubmissionPdf]
  pdf --> pw[Playwright 600px and 400px captures]
  UI --> analysis[analysis.ts in browser]`,
  sections: [
    {
      id: 'routes',
      title: 'API routes',
      routes: [
        { method: 'GET', path: '/api/veeva-suite/health', proxyTarget: 'veeva-suite-worker /api/health' },
        { method: 'POST', path: '/api/veeva-suite/suite-runs/tokens', handler: 'token scan' },
        { method: 'POST', path: '/api/veeva-suite/suite-runs', handler: 'run assembly + optional screenshots' },
        { method: 'POST', path: '/api/veeva-suite/suite-runs/:id/submission', handler: 'RTE submission PDF (title + subject lines)' },
        { method: 'GET', path: '/api/veeva-suite/suite-runs/:id', handler: 'poll result' },
        { method: 'GET', path: '/api/veeva-suite/suite-runs/:id/download', handler: 'output ZIP' },
      ],
      sourceRefs: [
        { path: 'apps/agent-api/app/routes/veeva_suite.py' },
        { path: 'apps/veeva-suite-worker/src/server.ts' },
      ],
    },
    {
      id: 'worker-pipeline',
      title: 'Worker pipeline (suite-core)',
      bullets: [
        'intakeVeevaZipFromPath — unzip, index HTML',
        'detectPackage — rte | clm | unknown (fragments path, com.veeva.clm markers)',
        'discoverRteTokensFromZip — {{...}} and ##...## tokens',
        'injectFragments — Cheerio DOM splice for {{insertEmailFragments}} or data-rte-fragments',
        'assertRteAssembledStructure — footer/wrapper table validation',
        'veevaClmMockScript / injectClmRuntime — in-browser mock of com.veeva.clm.*',
        'maybeScreenshots — Playwright Chromium: full email, per-fragment/slide, PDF report',
        'generateSubmissionPdf — 600px/400px captures + fixed 3-page submission.pdf (scale-to-fit; RTE only POST)',
        'assembled-email-processed.html / assembled-email-tokens.html — submission capture variants',
        'assembleVeevaZip — output veeva-suite-output.zip, manifest.json, review-report.html',
        'Inventory scanners: links, images, tokens, veeva-api call patterns in HTML',
      ],
      sourceRefs: [
        { path: 'apps/veeva-suite-worker/suite-core/src/index.ts' },
        { path: 'apps/veeva-suite-worker/suite-core/src/submission-pdf.ts' },
      ],
    },
    {
      id: 'client-analysis',
      title: 'Client analysis (post-response)',
      sourceRefs: [{ path: 'apps/web-dashboard/lib/veevaSuite/analysis.ts', symbol: 'analyzeVeevaSuite' }],
      formulas: [
        'findingWeight: blocker=18, warning=7, note=2, ok=0',
        'healthScore = clamp(0, 100, 100 - sum(findingWeight))',
        'vendorStatus: ready|not_applicable=1, check=0.55, missing=0',
        'vendorPackageScore = round(avg(vendorStatus) * 100)',
      ],
      bullets: [
        'Maps worker warnings (error→blocker, warning→warning) to SuiteFinding',
        'CLM orphanSlides: no inbound edges (except first slide); deadEndSlides: no outbound',
        'vendorReadiness checks: package ZIP, screenshots, links, tokens, veeva-api, blockers',
        'clientSafeSummary, internalSummary, vendorHandoffDraft generated from counts',
      ],
    },
    {
      id: 'frontend',
      title: 'Frontend',
      sourceRefs: [
        { path: 'apps/web-dashboard/components/tools/VeevaSuitePanel.tsx' },
        { path: 'apps/web-dashboard/components/tools/veeva-suite/SubmissionGeneratorSection.tsx', note: 'RTE submission PDF: campaign title + dynamic subject lines' },
        { path: 'apps/web-dashboard/components/tools/veeva-suite/VeevaSuiteResult.tsx', note: 'Result tabs: preview, fragments, navigation, screenshots, vendor, findings, exports' },
        { path: 'apps/web-dashboard/components/tools/veeva-suite/ScreenshotComparator.tsx' },
      ],
      bullets: [
        'How it\'s made tab lives on the tool tile (not inside result tabs)',
        'exportVeevaSuiteMarkdown builds QA report from analysis',
      ],
    },
    {
      id: 'veeva-api',
      title: 'Veeva API (explicit)',
      paragraphs: [
        'There is no live Veeva Vault/CLM REST integration in this tool. veeva-api inventory items detect call patterns in HTML; CLM runtime APIs are mocked via injected script for local preview only. This does not replace Veeva validation or MLR.',
      ],
    },
    DOCUMENT_INGEST_SECTION,
    PLATFORM_WORKERS_TABLE,
    {
      id: 'explicit-non-goals',
      title: 'Explicitly not used',
      bullets: ['model-router / LLM', 'agent.runs', 'scenario-worker', 'browser-runner (separate service)'],
      queues: [AGENT_RUNS_NOT_USED],
    },
  ],
};

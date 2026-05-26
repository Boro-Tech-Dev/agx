import type { HowItsMadeDoc } from './types';
import { AGENT_RUNS_NOT_USED, DOCUMENT_INGEST_SECTION, PLATFORM_WORKERS_TABLE } from './sharedPlatform';

export const webCaptureHowItsMade: HowItsMadeDoc = {
  toolId: 'web_capture',
  title: 'Web Capture',
  lastVerifiedFromCode: '2026-05-17',
  ai: {
    usesLlm: false,
    summary: 'Playwright rendering, trafilatura extraction, and BFS crawl are deterministic. No LLM in capture paths.',
  },
  architectureSummary:
    'agent-api proxies to browser-runner for screenshot, extract, and crawl. URLs are SSRF-validated before any fetch. Crawl builds index JSON with excerpts, headings, and capped article text.',
  architectureMermaid: `flowchart LR
  UI[WebCapturePanel] --> api[agent-api /api/web]
  api --> br[browser-runner :8094]
  br --> ssrf[ssrf.py validate]
  br --> pw[Playwright engine]
  br --> tri[trafilatura extract]
  br --> bfs[crawl_execute BFS]`,
  sections: [
    {
      id: 'routes',
      title: 'API routes',
      routes: [
        { method: 'GET', path: '/api/web/health', proxyTarget: 'browser-runner GET /health' },
        { method: 'POST', path: '/api/web/screenshot', proxyTarget: 'POST /tools/web/screenshot' },
        { method: 'POST', path: '/api/web/pdf', proxyTarget: 'POST /tools/web/pdf' },
        { method: 'POST', path: '/api/web/extract', proxyTarget: 'POST /tools/web/extract' },
        { method: 'POST', path: '/api/web/crawl', proxyTarget: 'POST /tools/web/crawl' },
        { method: 'POST', path: '/api/web/crawl-stream', proxyTarget: 'POST /tools/web/crawl-stream', note: 'NDJSON progress events' },
      ],
      sourceRefs: [
        { path: 'apps/agent-api/app/routes/web_capture.py' },
        { path: 'apps/browser-runner/tools/main.py' },
      ],
    },
    {
      id: 'ssrf',
      title: 'URL validation (SSRF)',
      bullets: [
        'validate_public_http_url / assert_safe_host — http/https only',
        'DNS resolve host; reject private, loopback, link-local, metadata IPs',
        '_safe_httpx_get re-validates each redirect hop',
      ],
      sourceRefs: [{ path: 'apps/browser-runner/tools/ssrf.py' }],
    },
    {
      id: 'screenshot',
      title: 'Screenshot mode',
      bullets: [
        'playwright_screenshot_bytes — Chromium viewport, optional full_page',
        'device_scale_factor default 2.0 for HiDPI',
        'capture_helpers: consent banner clicks, form login staging, interaction_plan steps',
        'optional interactives_scan inventory',
      ],
      sourceRefs: [
        { path: 'apps/browser-runner/tools/capture_helpers.py' },
        { path: 'apps/browser-runner/tools/interaction_plan.py' },
        { path: 'apps/browser-runner/tools/interactives_scan.py' },
      ],
    },
    {
      id: 'extract',
      title: 'Extract mode',
      bullets: [
        'render_js=false: httpx fetch + trafilatura (fast, no JS)',
        'render_js=true (default): Playwright render then trafilatura article text',
        'MAX_TEXT_RESPONSE_CHARS from WEB_MAX_TEXT_CHARS (default 24000)',
      ],
    },
    {
      id: 'crawl',
      title: 'Crawl mode',
      bullets: [
        'BFS queue with same-site hostname check (_hostname_same_site, www-normalized)',
        'Per page: in-page JS for headings; trafilatura excerpt + capped full article text',
        'inter_page_delay_ms pacing between pages',
        'crawl-stream: crawl_iterate_events NDJSON (page, done, error)',
      ],
      sourceRefs: [{ path: 'apps/browser-runner/tools/crawl_execute.py' }],
    },
    {
      id: 'limits',
      title: 'Env limits (defaults)',
      formulas: [
        'WEB_MAX_CRAWL_PAGES=25',
        'WEB_MAX_CRAWL_DEPTH=4',
        'WEB_MAX_CRAWL_SECONDS=120',
        'WEB_MAX_CRAWL_ARTICLE_CHARS=12000',
        'WEB_MAX_EXCERPT_CHARS=600',
        'WEB_NAV_TIMEOUT_MS=45000',
        'WEB_HTTP_TIMEOUT_SEC=30',
      ],
      sourceRefs: [{ path: 'apps/browser-runner/tools/web_payloads.py' }],
    },
    {
      id: 'frontend',
      title: 'Frontend',
      sourceRefs: [{ path: 'apps/web-dashboard/components/tools/WebCapturePanel.tsx' }],
      bullets: [
        'Modes via select: crawl | extract | screenshot (not separate routes in UI)',
        'Save capture JSON to project documents (kind general) → triggers document.ingest',
      ],
    },
    DOCUMENT_INGEST_SECTION,
    PLATFORM_WORKERS_TABLE,
    {
      id: 'explicit-non-goals',
      title: 'Explicitly not used',
      bullets: ['model-router / LLM during capture', 'agent.runs', 'veeva-suite-worker, scenario-worker'],
      queues: [AGENT_RUNS_NOT_USED],
    },
  ],
};

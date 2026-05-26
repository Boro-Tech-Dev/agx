import type { HowItsMadeDoc } from './types';
import { AGENT_RUNS_NOT_USED, DOCUMENT_INGEST_SECTION, PLATFORM_WORKERS_TABLE } from './sharedPlatform';

export const webSearchHowItsMade: HowItsMadeDoc = {
  toolId: 'web_search',
  title: 'Web Search',
  lastVerifiedFromCode: '2026-05-25',
  ai: {
    usesLlm: false,
    summary:
      'SearXNG metasearch and optional deep-fetch (page render, chunk, rerank) are deterministic. Agents inject ranked facts into context; LLM runs only in the agent chat turn.',
  },
  architectureSummary:
    'Dashboard and agent-worker call search-runner (SearXNG proxy). When WEB_DEEPFETCH_ENABLED=1, agent-worker fetches top URLs via browser-runner, chunks text, reranks via model-router /v1/rerank, and injects ## Web_search_chunks into agent context.',
  architectureMermaid: `flowchart LR
  UI[WebSearchPanel] --> api[agent-api]
  Worker[agent-worker] --> sr[search-runner / SearXNG]
  Worker --> df[web_deepfetch]
  df --> br[browser-runner extract]
  df --> mr[model-router rerank]
  df --> redis[Redis web page cache]`,
  sections: [
    {
      id: 'routes',
      title: 'API routes',
      routes: [
        { method: 'POST', path: '/api/search/web', note: 'Metasearch proxy to search-runner' },
      ],
      sourceRefs: [
        { path: 'apps/agent-api/app/routes/web_search.py' },
        { path: 'apps/search-runner/' },
      ],
    },
    {
      id: 'deepfetch',
      title: 'Deep-fetch (agent-worker, opt-in)',
      bullets: [
        'WEB_DEEPFETCH_ENABLED=0 by default; set to 1 in compose/env to enable',
        'Concurrent URL fetch with wall-clock budget; Redis cache with TTL and negative cache',
        'render_js fallback when fast extract is thin',
        'Chunks → POST /v1/rerank (BGE, Jina, or ColBERT catalog id) → top-M chunks in prompt',
        'Snippet fallback when fetch/rerank fails; web.deepfetch.* events on run stream',
      ],
      sourceRefs: [
        { path: 'apps/agent-worker/worker/web_deepfetch.py' },
        { path: 'apps/agent-worker/worker/web_search_context.py' },
        { path: 'apps/agent-worker/worker/text_chunking.py' },
        { path: 'apps/agent-worker/worker/web_cache.py' },
      ],
    },
    {
      id: 'frontend',
      title: 'Frontend',
      sourceRefs: [{ path: 'apps/web-dashboard/components/tools/WebSearchPanel.tsx' }],
      bullets: [
        'Query SearXNG, save results to project memory',
        'Open Extract/Crawl on a result URL via web_capture flows',
      ],
    },
    DOCUMENT_INGEST_SECTION,
    PLATFORM_WORKERS_TABLE,
    {
      id: 'explicit-non-goals',
      title: 'Explicitly not used',
      bullets: ['LLM inside search-runner or SearXNG itself'],
      queues: [AGENT_RUNS_NOT_USED],
    },
  ],
};

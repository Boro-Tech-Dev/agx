/** Plain-language copy for the home Project Dossier — keep aligned with README + docker-compose. */

export const DOSSIER_HERO = 'RagTag ties your browser, local AI, and a small set of services into one operator desk.';

/** Phase 4: first-day PM onboarding link from home dossier. */
export const DOSSIER_FIRST_DAY_PM_HREF = '/tools/learning/project-management/pharma';

export const DOSSIER_INTRO: readonly string[] = [
  'You use the dashboard to queue work: breakdowns, memory search, artifacts, and more. The API records what you asked for, stores state in Postgres, and hands long jobs to background workers.',
  'Workers call the model router, which talks to Ollama on your machine—so prompts and documents stay local by default. Uploads and large blobs land in MinIO; Redis keeps queues snappy.',
  'Nine specialist agents share the same rails (memory, tools, artifacts) but each has its own prompts and output shape—pick the card that matches the kind of work you are doing.',
];

export type StackGroup = {
  title: string;
  accent: 'rose' | 'amber' | 'indigo' | 'emerald' | 'violet' | 'sky' | 'slate';
  items: { name: string; note?: string }[];
};

/** Services from docker-compose.yml — grouped for scanning, not raw YAML. */
export const STACK_GROUPS: StackGroup[] = [
  {
    title: 'Interface',
    accent: 'indigo',
    items: [
      { name: 'Next.js 14', note: 'Web dashboard · React · Tailwind' },
      { name: 'dd-agent-dashboard', note: 'Same-origin /api rewrites to Agent API' },
    ],
  },
  {
    title: 'API & workers',
    accent: 'rose',
    items: [
      { name: 'agent-api', note: 'FastAPI · 8080' },
      { name: 'agent-worker', note: 'Agent workflows & tools' },
      { name: 'ingestion-worker', note: 'Document ingest queue' },
      { name: 'scenario-worker', note: 'Scenario / delivery helpers' },
      { name: 'tool-runner', note: 'Isolated tool execution · 8090' },
      { name: 'browser-runner', note: 'Playwright capture · 8094' },
    ],
  },
  {
    title: 'AI layer',
    accent: 'violet',
    items: [
      { name: 'model-router', note: 'OpenAI-compatible · 8085' },
      { name: 'ollama', note: 'LLM runtime · 11434' },
      { name: 'ollama-pull', note: 'Warm default models on startup' },
    ],
  },
  {
    title: 'Data & files',
    accent: 'emerald',
    items: [
      { name: 'PostgreSQL 16 + pgvector', note: 'Projects, runs, memory index' },
      { name: 'Redis 7', note: 'Queues & cache (AOF)' },
      { name: 'MinIO', note: 'Object storage · 9000 / console 9001' },
    ],
  },
  {
    title: 'Observability',
    accent: 'sky',
    items: [
      { name: 'Prometheus', note: 'Metrics · 9090' },
      { name: 'Grafana', note: 'Dashboards · host 3001' },
      { name: 'redis-exporter', note: '' },
      { name: 'postgres-exporter', note: '' },
    ],
  },
];

export const GLOSSARY: { term: string; body: string }[] = [
  {
    term: 'Redis',
    body: 'An in-memory data store used here for fast job queues and short-lived coordination—think a ticket window between the API and workers.',
  },
  {
    term: 'MinIO',
    body: 'S3-compatible object storage for files and large blobs so the database stays lean.',
  },
  {
    term: 'pgvector',
    body: 'A Postgres extension for vector search so memory and retrieval can rank “similar” chunks, not just exact text.',
  },
  {
    term: 'Model router',
    body: 'A small service in front of Ollama that picks models, applies limits, and keeps chat/embed calls consistent for workers and tools.',
  },
];

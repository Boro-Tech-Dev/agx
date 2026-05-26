import type { HowItsMadeQueueRef, HowItsMadeSection } from './types';

/** Async path after saving a project document (not core tool compute). */
export const DOCUMENT_INGEST_SECTION: HowItsMadeSection = {
  id: 'document-ingest-downstream',
  title: 'Downstream document ingest (after save)',
  paragraphs: [
    'When a tool uploads a project document, agent-api persists the file and enqueues background ingest. That pipeline is separate from the tool’s own logic: it chunks text, embeds via model-router, and makes content searchable to agents.',
  ],
  queues: [
    {
      name: 'document.ingest',
      producer: 'agent-api project_document_service.enqueue_document_ingest',
      consumer: 'ingestion-worker (port 8092)',
      usedByTool: true,
      note: 'Triggered on upload, not during autofill or scenario compute.',
    },
    {
      name: 'document.ingest.processing',
      producer: 'BRPOPLPUSH staging list',
      consumer: 'ingestion-worker reconcile',
      usedByTool: true,
      note: 'In-flight jobs; agent-api may requeue stuck items when reconcile env flags are set.',
    },
  ],
  sourceRefs: [
    { path: 'apps/agent-api/app/services/project_document_service.py', symbol: 'enqueue on upload' },
    { path: 'apps/agent-api/app/services/common.py', symbol: 'enqueue_document_ingest' },
    { path: 'apps/ingestion-worker/ingestion/consumer.py', symbol: 'worker_loop' },
  ],
};

export const AGENT_RUNS_NOT_USED: HowItsMadeQueueRef = {
  name: 'agent.runs',
  producer: 'agent-api run_service (POST /api/runs)',
  consumer: 'agent-worker (port 8091)',
  usedByTool: false,
  note: 'Conversational Home agents only. None of the six Tools tiles enqueue this queue.',
};

export const PLATFORM_WORKERS_TABLE: HowItsMadeSection = {
  id: 'platform-workers',
  title: 'Platform workers (reference)',
  bullets: [
    'agent-api :8080 — API gateway, proxies, document ingest producer',
    'model-router :8085 — Ollama gateway (/v1/route, /v1/embed); sync HTTP only',
    'scenario-worker :8093 — Scenario Planner schedule math (sync HTTP)',
    'browser-runner :8094 — Web Capture Playwright + trafilatura',
    'veeva-suite-worker :4317 — Veeva ZIP assembly + screenshots',
    'ingestion-worker :8092 — document.ingest consumer + embeddings',
    'agent-worker :8091 — agent.runs consumer; scenario /scenario/* fallback if SCENARIO_WORKER_URL unset',
    'tool-runner :8090 — repo tools for Builder agent; not used by any of the six tools',
  ],
  queues: [AGENT_RUNS_NOT_USED],
};

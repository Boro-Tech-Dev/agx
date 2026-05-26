/** Shape of `GET /api/monitoring/queues` (agent-api). */

export type WorkerProbe = {
  url: string;
  ok: boolean;
  health?: Record<string, unknown>;
  error?: string;
};

export type QueueMonitoringQueues = {
  pending_length: number;
  processing_length: number;
  dead_letter_length: number;
  pending_name: string;
  processing_name: string;
  dead_name: string;
  ingest_pending_length?: number;
  ingest_pending_name?: string;
  ingest_processing_length?: number;
  ingest_processing_name?: string;
};

export type LlmUsageSummary = {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
  estimated_savings_usd: number;
  usd_per_1k_tokens: number;
};

export type QueueMonitoringResponse = {
  queues: QueueMonitoringQueues;
  workers?: WorkerProbe[];
  ingestion_workers?: WorkerProbe[];
  scenario_workers?: WorkerProbe[];
  veeva_suite_workers?: WorkerProbe[];
  browser_workers?: WorkerProbe[];
  model_router_workers?: WorkerProbe[];
  worker?: Record<string, unknown> | null;
  worker_url?: string;
  worker_reachable?: boolean;
  worker_error?: string | null;
  runs_by_status?: { status: string; n: number }[];
  active_runs?: {
    id: string;
    agent_key: string;
    status: string;
    title: string | null;
    created_at: string;
  }[];
  reconcile_last_result?: Record<string, unknown>;
  ingest_reconcile_last_result?: Record<string, unknown>;
  llm_usage?: LlmUsageSummary | null;
};

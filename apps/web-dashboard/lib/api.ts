/**
 * Browser: empty string => same-origin `/api/*` (Next.js route handler proxies to agent-api using runtime AGENT_API_URL).
 * Set NEXT_PUBLIC_AGENT_API_URL only to bypass the proxy (direct browser → API; requires CORS on agent-api).
 */

import type { HalTimelineStep } from './halScenario';
import type { QueueMonitoringResponse } from './monitoringTypes';
import type { LinearStepBreakdown } from './scenarioPlanner/linear/types';

function browserApiBase(): string {
  return (process.env.NEXT_PUBLIC_AGENT_API_URL || '').trim() || '';
}
/** Server Components / Route Handlers: Docker uses `agent-api`; local dev uses localhost. */
function serverApiBase(): string {
  return (
    process.env.AGENT_API_URL ||
    (process.env.NEXT_PUBLIC_AGENT_API_URL || '').trim() ||
    'http://localhost:8080'
  );
}

function apiBase(): string {
  if (typeof window !== 'undefined') return browserApiBase();
  return serverApiBase();
}

/** Browser fetch URL: same-origin path when no NEXT_PUBLIC_AGENT_API_URL; else absolute API base + path. */
export function apiUrlForFetch(path: string): string {
  const p = path.startsWith('/') ? path : `/${path}`;
  if (typeof window === 'undefined') return `${serverApiBase().replace(/\/$/, '')}${p}`;
  const base = browserApiBase();
  if (!base) return p;
  return `${base.replace(/\/$/, '')}${p}`;
}

async function jsonFetch(path: string, init?: RequestInit) {
  const res = await fetch(`${apiBase()}${path}`, { cache: 'no-store', ...init });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}
export async function createRun(agent_key: string, workflow: string, content: string, extra: Record<string, any> = {}) {
  const { project_key, parent_run_id, reply, include_parent_summary, ...rest } = extra;
  const input: Record<string, any> = { ...rest };
  if (content !== undefined && content !== null) {
    input.content = content;
  }
  const body: Record<string, any> = {
    agent_key,
    workflow,
    project_key: project_key != null && project_key !== '' ? project_key : null,
    input,
  };
  if (parent_run_id) body.parent_run_id = parent_run_id;
  if (reply !== undefined && reply !== null) body.reply = reply;
  if (include_parent_summary !== undefined) body.include_parent_summary = include_parent_summary;
  return jsonFetch('/api/runs', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}
export type AgentCatalogRow = {
  key: string;
  name: string;
  description: string;
  default_model: string;
  default_workflow?: string | null;
  ui?: Record<string, unknown> | null;
};

/** Server: short ISR; browser: always fresh (catalog rarely changes mid-session). */
export async function listAgents(): Promise<AgentCatalogRow[]> {
  const path = '/api/agents';
  const init: RequestInit =
    typeof window === 'undefined' ? { next: { revalidate: 120 } } : { cache: 'no-store' };
  const res = await fetch(`${apiBase()}${path}`, init);
  if (!res.ok) throw new Error(await res.text());
  const rows = await res.json();
  if (!Array.isArray(rows)) {
    throw new Error('GET /api/agents: expected a JSON array');
  }
  return rows;
}

export async function listRuns(){ return jsonFetch('/api/runs'); }
export async function getRun(id:string){ return jsonFetch(`/api/runs/${id}`); }
/** Run row plus events (one HTTP round-trip; use for polling run detail pages). */
export async function getRunDetail(id: string): Promise<{ run: Record<string, unknown>; events: unknown[] }> {
  return jsonFetch(`/api/runs/${id}/detail`);
}
export async function cancelRun(id:string){ return jsonFetch(`/api/runs/${id}/cancel`, {method:'POST'}); }
export async function getRunEvents(id:string){ return jsonFetch(`/api/runs/${id}/events`); }
export type MemoryListRow = Record<string, unknown>;

export async function listMemory(opts?: { projectScopedOnly?: boolean; limit?: number }): Promise<MemoryListRow[]> {
  const params = new URLSearchParams();
  if (opts?.projectScopedOnly) params.set('project_scoped_only', 'true');
  if (opts?.limit != null) params.set('limit', String(opts.limit));
  const q = params.toString();
  const rows = await jsonFetch(`/api/memory${q ? `?${q}` : ''}`);
  return Array.isArray(rows) ? (rows as MemoryListRow[]) : [];
}
export type MemorySearchResponse = {
  results: unknown[];
  warnings?: string[];
};

export async function searchMemory(
  query: string,
  project_key?: string | null,
  workspace_key?: string | null,
  document_kinds?: string[] | null,
): Promise<MemorySearchResponse> {
  return jsonFetch('/api/memory/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      query,
      project_key: project_key ?? null,
      workspace_key: workspace_key ?? null,
      limit: 12,
      document_kinds: document_kinds?.length ? document_kinds : null,
    }),
  });
}
export async function createMemory(payload:any){ return jsonFetch('/api/memory', {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(payload)}); }
export async function ingestText(payload:any){ return jsonFetch('/api/ingestion/text', {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(payload)}); }
export async function listArtifacts(){ return jsonFetch('/api/artifacts'); }
export async function getArtifact(id:string){ return jsonFetch(`/api/artifacts/${id}`); }
export function artifactDownloadUrl(id: string) {
  const b = (process.env.NEXT_PUBLIC_AGENT_API_URL || '').trim();
  if (b) return `${b.replace(/\/$/, '')}/api/artifacts/${id}/download`;
  return `/api/artifacts/${id}/download`;
}

export const PROJECT_DOCUMENT_KIND_VALUES = [
  'timeline',
  'scenario',
  'omnichannel_plan',
  'veeva_suite',
  'brief',
  'estimate',
  'concept',
  'changeorder',
  'contract',
  'spec',
  'general',
  'clinical_note',
  'lab_report',
  'imaging_report',
] as const;

export async function listProjectDocuments(
  projectKey: string,
  opts?: { includeArchived?: boolean; kinds?: string[] },
) {
  const qs = new URLSearchParams();
  if (opts?.includeArchived) qs.set('include_archived', 'true');
  for (const k of opts?.kinds || []) {
    if (k) qs.append('kind', k);
  }
  const q = qs.toString();
  return jsonFetch(
    `/api/projects/${encodeURIComponent(projectKey)}/documents${q ? `?${q}` : ''}`,
  );
}

export async function uploadProjectDocument(projectKey: string, file: File, documentKind: string) {
  const fd = new FormData();
  fd.append('file', file);
  fd.append('document_kind', documentKind);
  const res = await fetch(
    `${apiBase()}/api/projects/${encodeURIComponent(projectKey)}/documents`,
    { method: 'POST', body: fd, cache: 'no-store' },
  );
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export type BriefAutofillResponse = {
  extracted: Record<string, string>;
  model_used?: string | null;
  error?: string | null;
  parse_failed?: boolean;
  grammar_failure_fallback_used?: boolean;
};

/** LLM-assisted field extraction via agent-api → model-router (local Ollama). */
export async function postBriefAutofill(body: {
  prose: string;
  field_ids: string[];
  field_labels?: Record<string, string>;
}): Promise<BriefAutofillResponse> {
  return jsonFetch('/api/brief/autofill', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

export type BriefAutofillFromDocumentResponse = BriefAutofillResponse & {
  prose_chars_used?: number;
  source_document_id?: string;
};

/** Optional dev token forwarded to agent-api when `BRIEF_OPS_TOKEN` is set there. */
export function briefOpsTokenHeaders(): Record<string, string> {
  const t = (typeof process !== 'undefined' ? process.env.NEXT_PUBLIC_BRIEF_OPS_TOKEN : '')?.trim() ?? '';
  return t ? { 'x-brief-ops-token': t } : {};
}

export type PublishedBriefTemplateRow = {
  bundle_id: string;
  version: number;
  label?: string | null;
  created_at?: string | null;
  skeleton: Record<string, unknown>;
  tactic_overrides: Record<string, unknown>;
  presets: Record<string, unknown>;
};

export async function getPublishedBriefTemplates(): Promise<PublishedBriefTemplateRow> {
  return jsonFetch('/api/brief-templates/published');
}

export async function getBriefTemplateDraft() {
  return jsonFetch('/api/brief-templates/draft', { headers: briefOpsTokenHeaders() });
}

export async function putBriefTemplateDraft(body: {
  skeleton: Record<string, unknown>;
  tactic_overrides: Record<string, unknown>;
  presets: Record<string, unknown>;
}) {
  return jsonFetch('/api/brief-templates/draft', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', ...briefOpsTokenHeaders() },
    body: JSON.stringify(body),
  });
}

export async function patchBriefTemplateDraft(body: Record<string, unknown>) {
  return jsonFetch('/api/brief-templates/draft', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', ...briefOpsTokenHeaders() },
    body: JSON.stringify(body),
  });
}

export async function publishBriefTemplates(body?: { label?: string | null; notes?: string | null }) {
  return jsonFetch('/api/brief-templates/publish', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...briefOpsTokenHeaders() },
    body: JSON.stringify(body ?? {}),
  });
}

export async function bootstrapBriefTemplates() {
  return jsonFetch('/api/brief-templates/bootstrap', {
    method: 'POST',
    headers: { ...briefOpsTokenHeaders() },
  });
}

export async function validateBriefTemplateDraft() {
  return jsonFetch('/api/brief-templates/validate', { headers: briefOpsTokenHeaders() });
}

export async function postBriefAutofillFromDocument(body: {
  project_key: string;
  source_document_id: string;
  field_ids: string[];
  field_labels?: Record<string, string>;
}): Promise<BriefAutofillFromDocumentResponse> {
  return jsonFetch('/api/brief/autofill-from-document', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

export async function patchProjectDocument(
  projectKey: string,
  documentId: string,
  body: { archived?: boolean; document_kind?: string },
) {
  return jsonFetch(`/api/projects/${encodeURIComponent(projectKey)}/documents/${encodeURIComponent(documentId)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

export async function deleteProjectDocument(projectKey: string, documentId: string) {
  return jsonFetch(
    `/api/projects/${encodeURIComponent(projectKey)}/documents/${encodeURIComponent(documentId)}`,
    { method: 'DELETE' },
  );
}

export function projectDocumentDownloadUrl(projectKey: string, documentId: string) {
  const b = (process.env.NEXT_PUBLIC_AGENT_API_URL || '').trim();
  const path = `/api/projects/${encodeURIComponent(projectKey)}/documents/${encodeURIComponent(documentId)}/download`;
  if (b) return `${b.replace(/\/$/, '')}${path}`;
  return path;
}

/** Download raw document bytes as UTF-8 text (JSON, CSV, etc.). */
export async function downloadProjectDocumentText(projectKey: string, documentId: string): Promise<string> {
  const pathOrUrl = projectDocumentDownloadUrl(projectKey, documentId);
  const url = pathOrUrl.startsWith('http') ? pathOrUrl : `${apiBase()}${pathOrUrl}`;
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) throw new Error(await res.text());
  return res.text();
}

export async function applyOmnichannelPlan(projectKey: string, plan: Record<string, unknown>) {
  return jsonFetch(`/api/projects/${encodeURIComponent(projectKey)}/omnichannel-plans/apply`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ plan }),
  });
}
export async function listApprovals(){ return jsonFetch('/api/approvals'); }
export async function listProjects(){ return jsonFetch('/api/projects'); }
export async function getProject(projectKey: string) {
  return jsonFetch(`/api/projects/${encodeURIComponent(projectKey)}`);
}
export async function listProjectTypes(): Promise<{ value: string; label: string; capture_mode: string }[]> {
  const d = (await jsonFetch('/api/projects/project-types')) as {
    project_types?: { value: string; label: string; capture_mode: string }[];
  };
  return Array.isArray(d.project_types) ? d.project_types : [];
}

export async function patchProject(
  projectKey: string,
  body: {
    name?: string;
    description?: string;
    project_type?: string;
    pm_kind?: 'business' | 'personal';
    metadata?: Record<string, unknown>;
    timing_profile_id?: string | null;
  },
) {
  return jsonFetch(`/api/projects/${encodeURIComponent(projectKey)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}
export async function createProject(payload: {
  key: string;
  name: string;
  description?: string;
  project_type: string;
  pm_kind?: 'business' | 'personal';
  metadata?: Record<string, unknown>;
  brand_id?: string;
  workspace_key?: string;
  client_key?: string;
  brand_key?: string;
}) {
  return jsonFetch('/api/projects', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}
export async function deleteProject(projectKey: string) {
  return jsonFetch(`/api/projects/${encodeURIComponent(projectKey)}`, { method: 'DELETE' });
}
export async function getProjectItems(key: string) {
  return jsonFetch(`/api/projects/${encodeURIComponent(key)}/items`);
}

/** Aggregated timeline_event rows for multi-project Gantt (optional workspace filter). */
export async function listTimelineEvents(workspace_key?: string, limit = 2000) {
  const q = new URLSearchParams();
  if (workspace_key) q.set('workspace_key', workspace_key);
  if (limit !== 2000) q.set('limit', String(limit));
  const suffix = q.toString() ? `?${q.toString()}` : '';
  return jsonFetch(`/api/projects/timeline-events${suffix}`);
}

/** Aggregated risk, anomaly, and cost rows across projects (optional workspace filter). */
export async function listPortfolioItems(opts?: { workspaceKey?: string; limit?: number }) {
  const q = new URLSearchParams();
  if (opts?.workspaceKey) q.set('workspace_key', opts.workspaceKey);
  if (opts?.limit != null && opts.limit !== 2000) q.set('limit', String(opts.limit));
  const suffix = q.toString() ? `?${q.toString()}` : '';
  return jsonFetch(`/api/projects/portfolio-items${suffix}`);
}

export async function patchProjectItem(
  projectKey: string,
  itemId: string,
  body: { status?: string; metadata?: Record<string, unknown>; title?: string },
) {
  return jsonFetch(`/api/projects/${encodeURIComponent(projectKey)}/items/${encodeURIComponent(itemId)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}
export async function getHierarchyTree() {
  return jsonFetch('/api/hierarchy/tree');
}

export type HierarchyImportError = { line?: number; entity?: string; message?: string };
export type HierarchyImportResult = {
  dry_run: boolean;
  created: Record<string, number>;
  skipped: Record<string, number>;
  errors: HierarchyImportError[];
  ok: boolean;
  message?: string;
};

export async function bulkImportHierarchy(payload: {
  csv_text: string;
  dry_run?: boolean;
  skip_existing?: boolean;
}): Promise<HierarchyImportResult> {
  return jsonFetch('/api/hierarchy/import', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      csv_text: payload.csv_text,
      dry_run: payload.dry_run ?? false,
      skip_existing: payload.skip_existing ?? false,
    }),
  });
}
export async function listWorkspaces() {
  return jsonFetch('/api/workspaces');
}
export async function createWorkspace(payload: { key: string; name: string; description?: string }) {
  return jsonFetch('/api/workspaces', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}
export async function deleteWorkspace(workspaceKey: string) {
  return jsonFetch(`/api/workspaces/${encodeURIComponent(workspaceKey)}`, { method: 'DELETE' });
}
export async function listWorkspaceClients(workspaceKey: string) {
  return jsonFetch(`/api/workspaces/${encodeURIComponent(workspaceKey)}/clients`);
}
export async function createClient(
  workspaceKey: string,
  payload: { key: string; name: string; description?: string },
) {
  return jsonFetch(`/api/workspaces/${encodeURIComponent(workspaceKey)}/clients`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}
export async function listClientBrands(clientId: string) {
  return jsonFetch(`/api/clients/${encodeURIComponent(clientId)}/brands`);
}
export async function createBrand(
  clientId: string,
  payload: { key: string; name: string; description?: string },
) {
  return jsonFetch(`/api/clients/${encodeURIComponent(clientId)}/brands`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

export async function patchBrand(
  brandId: string,
  body: { name?: string; description?: string; timing_profile_id?: string | null },
) {
  return jsonFetch(`/api/brands/${encodeURIComponent(brandId)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}
export async function listProjectTactics(projectKey: string) {
  return jsonFetch(`/api/projects/${encodeURIComponent(projectKey)}/tactics`);
}
export async function attachProjectTactic(projectKey: string, payload: Record<string, unknown>) {
  return jsonFetch(`/api/projects/${encodeURIComponent(projectKey)}/tactics`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}
export async function patchProjectTactic(projectKey: string, projectTacticId: string, payload: Record<string, unknown>) {
  return jsonFetch(`/api/projects/${encodeURIComponent(projectKey)}/tactics/${encodeURIComponent(projectTacticId)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}
export async function deleteProjectTactic(projectKey: string, projectTacticId: string) {
  return jsonFetch(`/api/projects/${encodeURIComponent(projectKey)}/tactics/${encodeURIComponent(projectTacticId)}`, {
    method: 'DELETE',
  });
}

export async function listTacticsLibrary(opts?: {
  q?: string;
  channel?: string;
  tactic_kind?: string;
  medium?: string;
  status?: string;
}) {
  const qs = new URLSearchParams();
  if (opts?.q) qs.set('q', opts.q);
  if (opts?.channel) qs.set('channel', opts.channel);
  if (opts?.tactic_kind) qs.set('tactic_kind', opts.tactic_kind);
  if (opts?.medium) qs.set('medium', opts.medium);
  if (opts?.status) qs.set('status', opts.status);
  const q = qs.toString();
  return jsonFetch(`/api/tactics${q ? `?${q}` : ''}`);
}

export async function getTacticLibrary(tacticId: string) {
  return jsonFetch(`/api/tactics/${encodeURIComponent(tacticId)}`);
}

export async function createTacticLibrary(payload: Record<string, unknown>) {
  return jsonFetch('/api/tactics', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

export async function patchTacticLibrary(tacticId: string, payload: Record<string, unknown>) {
  return jsonFetch(`/api/tactics/${encodeURIComponent(tacticId)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

export async function archiveTacticLibrary(tacticId: string) {
  return jsonFetch(`/api/tactics/${encodeURIComponent(tacticId)}`, { method: 'DELETE' });
}
export async function getQueueMonitoring(): Promise<QueueMonitoringResponse> {
  return jsonFetch('/api/monitoring/queues');
}

function parseScenarioHttpDetail(text: string): string {
  try {
    const j = JSON.parse(text) as { detail?: unknown };
    if (typeof j.detail === 'string') return j.detail;
    if (Array.isArray(j.detail)) {
      return j.detail
        .map((x) =>
          typeof x === 'object' && x !== null && 'msg' in x ? String((x as { msg: unknown }).msg) : String(x),
        )
        .join('; ');
    }
  } catch {
    /* keep raw */
  }
  return text.trim() || 'Request failed';
}

async function scenarioPost(path: string, body: Record<string, unknown>, signal?: AbortSignal): Promise<unknown> {
  const res = await fetch(`${apiBase()}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    cache: 'no-store',
    signal,
  });
  const text = await res.text();
  if (!res.ok) throw new Error(parseScenarioHttpDetail(text) || `HTTP ${res.status}`);
  return text ? JSON.parse(text) : {};
}

function scenarioResponseIsOk(data: unknown): data is { ok: true } {
  return typeof data === 'object' && data !== null && (data as { ok?: unknown }).ok === true;
}

/** POST /api/scenario/compute-scenario-steps. Optional fields pin a prefix for suffix recompute. */
export type ComputeScenarioStepsRequestBody = Record<string, unknown> & {
  freezeAfterStepIndex?: number;
  pinnedPrefixSteps?: HalTimelineStep[];
};

/** Forward planner via scenario-worker (proxied by agent-api). */
export async function postComputeScenarioSteps(
  body: ComputeScenarioStepsRequestBody,
  signal?: AbortSignal,
): Promise<
  | {
      ok: true;
      steps: HalTimelineStep[];
      breakdown: LinearStepBreakdown[];
      opdp_binder_steps?: HalTimelineStep[];
    }
  | { ok: false; error: string }
> {
  const data = await scenarioPost('/api/scenario/compute-scenario-steps', body, signal);
  if (!scenarioResponseIsOk(data)) {
    const err =
      typeof data === 'object' &&
      data !== null &&
      'error' in data &&
      typeof (data as { error: unknown }).error === 'string'
        ? (data as { error: string }).error
        : 'Scenario compute failed';
    return { ok: false, error: err };
  }
  const steps = (data as { steps?: unknown }).steps;
  const breakdown = (data as { breakdown?: unknown }).breakdown;
  const opdpBinder = (data as { opdp_binder_steps?: unknown }).opdp_binder_steps;
  if (!Array.isArray(steps)) return { ok: false, error: 'Invalid response: missing steps' };
  const base = {
    ok: true as const,
    steps: steps as HalTimelineStep[],
    breakdown: Array.isArray(breakdown) ? (breakdown as LinearStepBreakdown[]) : [],
  };
  if (Array.isArray(opdpBinder) && opdpBinder.length > 0) {
    return { ...base, opdp_binder_steps: opdpBinder as HalTimelineStep[] };
  }
  return base;
}

/** Reverse planner via scenario-worker (proxied by agent-api). */
export async function postFindLatestKickoffForDeadline(
  body: Record<string, unknown>,
  signal?: AbortSignal,
): Promise<
  | { ok: true; kickoffIso: string; steps: HalTimelineStep[]; breakdown: LinearStepBreakdown[] }
  | { ok: false; error: string }
> {
  const data = await scenarioPost('/api/scenario/find-latest-kickoff-for-deadline', body, signal);
  if (!scenarioResponseIsOk(data)) {
    const err =
      typeof data === 'object' &&
      data !== null &&
      'error' in data &&
      typeof (data as { error: unknown }).error === 'string'
        ? (data as { error: string }).error
        : 'Scenario reverse planner failed';
    return { ok: false, error: err };
  }
  const steps = (data as { steps?: unknown }).steps;
  const breakdown = (data as { breakdown?: unknown }).breakdown;
  const kickoffIso = (data as { kickoffIso?: unknown }).kickoffIso;
  if (!Array.isArray(steps) || typeof kickoffIso !== 'string') {
    return { ok: false, error: 'Invalid response: missing steps or kickoffIso' };
  }
  return {
    ok: true,
    kickoffIso,
    steps: steps as HalTimelineStep[],
    breakdown: Array.isArray(breakdown) ? (breakdown as LinearStepBreakdown[]) : [],
  };
}
export type WebHttpCredentials = {
  username: string;
  password: string;
};

export type WebFormLogin = {
  login_url?: string | null;
  username_selector: string;
  password_selector: string;
  submit_selector?: string | null;
  username: string;
  password: string;
  post_submit_wait_until?: 'load' | 'domcontentloaded' | 'networkidle' | null;
  post_submit_delay_ms?: number;
};

export type WebGeolocation = {
  latitude: number;
  longitude: number;
};

export type WebStagingOptions = {
  http_credentials?: WebHttpCredentials | null;
  wait_until?: 'load' | 'domcontentloaded' | 'networkidle';
  post_load_delay_ms?: number;
  consent_auto_clicks?: boolean;
  /** Default true: auto-dismiss HCP interstitials and cookie banners before capture. */
  auto_dismiss_gates?: boolean;
  extra_click_selectors?: string[];
  locale?: string | null;
  timezone_id?: string | null;
  ignore_https_errors?: boolean;
  form_login?: WebFormLogin | null;
  extra_http_headers?: Record<string, string>;
  network_block_url_substrings?: string[];
  geolocation?: WebGeolocation | null;
};

export type WebInteractiveItem = {
  /** Runner inventory kind: button, link, input, tab, toggle, disclosure, … */
  kind: string;
  role: string;
  text: string;
  href?: string;
  selector_hint: string;
  input_type?: string;
  aria_label?: string;
  bbox?: { x: number; y: number; w: number; h: number };
};

export const WEB_INTERACTION_SELECTOR_MAX_LEN = 400;

/** Post-overlay steps for screenshot / JS extract / crawl seed (browser-runner). */
export type WebInteractionPlanStep =
  | { action: 'click'; selector: string }
  | { action: 'wait_ms'; wait_ms: number }
  | { action: 'upload'; selector: string; file_base64: string; filename: string };

export type WebCaptureFailureDebug = {
  screenshot_base64?: string;
  trace_base64?: string;
  final_url?: string;
};

export class WebCaptureError extends Error {
  debug?: WebCaptureFailureDebug;

  constructor(message: string, debug?: WebCaptureFailureDebug) {
    super(message);
    this.name = 'WebCaptureError';
    this.debug = debug;
  }
}

export type WebCaptureRequestFlags = {
  record_har?: boolean;
  debug_on_failure?: boolean;
};

/** Server-side merge of credentials from project document kind `web_capture_staging`. */
export type WebCaptureStagingProfileRef = {
  project_key?: string;
  staging_profile_document_id?: string;
};

export type WebScreenshotResponse = {
  url: string;
  final_url?: string;
  format: string;
  image_base64: string;
  full_page: boolean;
  device_scale_factor?: number;
  omit_background?: boolean;
  overlay_clicks_attempted?: number;
  interactives?: WebInteractiveItem[];
  interactives_truncated?: boolean;
};

export type WebExtractResponse = {
  url: string;
  final_url?: string;
  title: string;
  text: string;
  render_js: boolean;
  truncated: boolean;
  overlay_clicks_attempted?: number;
  interactives?: WebInteractiveItem[];
  interactives_truncated?: boolean;
};

export type WebGateDismissal = {
  overlay_clicks_attempted: number;
  hcp_clicks: number;
  cookie_clicks: number;
  extra_clicks: number;
};

export type WebCrawlPageRow = {
  url: string;
  depth: number;
  title?: string;
  excerpt?: string;
  headings?: string[];
  article_text?: string;
  article_truncated?: boolean;
  error?: string;
  final_url?: string;
  overlay_clicks_attempted?: number;
  gate_dismissal?: WebGateDismissal;
  interactives?: WebInteractiveItem[];
  interactives_truncated?: boolean;
  /** Print-to-PDF of rendered page (not a PNG screenshot). Omitted when crawl uses include_pdfs=false. */
  pdf_base64?: string;
  pdf_format?: string;
  pdf_truncated?: boolean;
  pdf_error?: string;
};

export type WebCrawlResponse = {
  seed: string;
  same_site_only: boolean;
  max_depth: number;
  max_pages: number;
  inter_page_delay_ms?: number;
  include_full_text?: boolean;
  include_interactives?: boolean;
  visited_count: number;
  pages: WebCrawlPageRow[];
  har_base64?: string;
};

export type WebCrawlRequestBody = WebCaptureStagingProfileRef &
  WebCaptureRequestFlags & {
  url: string;
  max_depth?: number;
  max_pages?: number;
  same_site_only?: boolean;
  inter_page_delay_ms?: number;
  include_full_text?: boolean;
  include_interactives?: boolean;
  /** Default true on server: print-to-PDF per crawled HTML page (no PNG screenshots). */
  include_pdfs?: boolean;
  pdf_format?: 'A4' | 'Letter';
  pdf_print_background?: boolean;
  interaction_plan?: WebInteractionPlanStep[];
  /** Default true on server: auto-dismiss HCP interstitials and cookie banners each crawl page. */
  auto_dismiss_gates?: boolean;
  staging?: WebStagingOptions;
};

export type WebPdfResponse = {
  url: string;
  final_url?: string;
  format: string;
  pdf_base64: string;
  page_format?: string;
  print_background?: boolean;
  overlay_clicks_attempted?: number;
  interactives?: WebInteractiveItem[];
  interactives_truncated?: boolean;
  har_base64?: string;
};

function formatCrawlStreamLogLine(ev: Record<string, unknown>): string {
  const t = ev.type;
  if (t === 'started') {
    const inv = ev.include_interactives ? ' · interactives on' : '';
    return `started · max ${String(ev.max_pages)} pages · depth ≤ ${String(ev.max_depth)}${ev.same_site_only ? ' · same-site' : ''}${inv}`;
  }
  if (t === 'page_begin') {
    return `→ [${String(ev.index)}] depth ${String(ev.depth)} · ${String(ev.url ?? '')}`;
  }
  if (t === 'page_end') {
    if (ev.error) return `✗ ${String(ev.url ?? '')} · ${String(ev.error).slice(0, 160)}`;
    const ic =
      typeof ev.interactives_count === 'number'
        ? ` · interactives ${String(ev.interactives_count)}${ev.interactives_truncated ? ' · truncated' : ''}`
        : '';
    const pdf =
      ev.has_pdf === true
        ? ` · pdf${ev.pdf_truncated ? ' (truncated)' : ''}`
        : ev.pdf_error
          ? ` · pdf failed`
          : '';
    const gd = ev.gate_dismissal;
    let overlayPart = `overlays ${String(ev.overlay_clicks_attempted ?? '—')}`;
    if (gd && typeof gd === 'object' && !Array.isArray(gd)) {
      const hcp = (gd as WebGateDismissal).hcp_clicks;
      const cookies = (gd as WebGateDismissal).cookie_clicks;
      const extra = (gd as WebGateDismissal).extra_clicks;
      if (typeof hcp === 'number' || typeof cookies === 'number' || typeof extra === 'number') {
        overlayPart += ` (hcp ${String(hcp ?? 0)}, cookies ${String(cookies ?? 0)}, extra ${String(extra ?? 0)})`;
      }
    }
    return `✓ ${String(ev.title || ev.url || '')} · ${overlayPart}${ic}${pdf} · completed ${String(ev.pages_completed ?? '')}`;
  }
  if (t === 'done') return 'done — full result received';
  if (t === 'fatal') return `fatal: ${String(ev.error ?? '')}`;
  return `event: ${String(t)}`;
}

/**
 * NDJSON crawl stream (`/api/web/crawl-stream`). Returns `null` if the route is missing (404).
 * Throws on HTTP errors or `fatal` stream event. Caller may fall back to {@link postWebCrawl}.
 */
export async function tryPostWebCrawlStream(
  body: WebCrawlRequestBody,
  onLogLine: (line: string) => void,
): Promise<WebCrawlResponse | null> {
  const res = await fetch(`${apiBase()}/api/web/crawl-stream`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/x-ndjson',
    },
    body: JSON.stringify(body),
    cache: 'no-store',
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(await res.text());
  const reader = res.body?.getReader();
  if (!reader) throw new Error('Crawl stream: empty response body');

  const dec = new TextDecoder();
  let buf = '';
  let final: WebCrawlResponse | null = null;

  const consumeBlock = (block: string) => {
    const line = block.trim();
    if (!line) return;
    let ev: Record<string, unknown>;
    try {
      ev = JSON.parse(line) as Record<string, unknown>;
    } catch {
      onLogLine(`(parse error) ${line.slice(0, 180)}`);
      return;
    }
    onLogLine(formatCrawlStreamLogLine(ev));
    if (ev.type === 'fatal') {
      throw new Error(typeof ev.error === 'string' ? ev.error : 'Crawl stream aborted');
    }
    if (ev.type === 'done' && ev.result != null && typeof ev.result === 'object') {
      final = ev.result as WebCrawlResponse;
    }
  };

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    const parts = buf.split('\n');
    buf = parts.pop() ?? '';
    for (const p of parts) {
      consumeBlock(p);
    }
  }
  buf += dec.decode();
  consumeBlock(buf);

  return final;
}

/** Crawl/text limits from browser-runner (via agent-api proxy). */
export type WebCaptureHealth = {
  ok: boolean;
  version?: string;
  browser_engine?: string;
  nav_timeout_ms?: number;
  max_crawl_pages?: number;
  max_crawl_depth?: number;
  max_crawl_seconds?: number;
  max_crawl_article_chars?: number;
  max_text_response_chars?: number;
  interaction_plan_max_steps?: number;
};

export async function getWebCaptureHealth(): Promise<WebCaptureHealth | null> {
  try {
    return await jsonFetch('/api/web/health');
  } catch {
    return null;
  }
}

async function webCaptureJsonFetch<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${apiBase()}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    cache: 'no-store',
  });
  const text = await res.text();
  if (!res.ok) {
    try {
      const parsed = JSON.parse(text) as { detail?: string; debug?: WebCaptureFailureDebug };
      const msg =
        typeof parsed.detail === 'string'
          ? parsed.detail
          : typeof parsed === 'object' && parsed !== null && 'detail' in parsed
            ? JSON.stringify(parsed.detail)
            : text;
      if (parsed.debug) {
        throw new WebCaptureError(msg, parsed.debug);
      }
      throw new Error(msg);
    } catch (e) {
      if (e instanceof WebCaptureError) throw e;
      throw new Error(text || `HTTP ${res.status}`);
    }
  }
  return JSON.parse(text) as T;
}

export async function postWebScreenshot(
  body: WebCaptureStagingProfileRef &
    WebCaptureRequestFlags & {
    url: string;
    full_page?: boolean;
    viewport_width?: number;
    viewport_height?: number;
    device_scale_factor?: number;
    omit_background?: boolean;
    include_interactives?: boolean;
    interaction_plan?: WebInteractionPlanStep[];
    staging?: WebStagingOptions;
  },
): Promise<WebScreenshotResponse> {
  return webCaptureJsonFetch('/api/web/screenshot', body);
}

export async function postWebPdf(
  body: WebCaptureRequestFlags & {
    url: string;
    format?: 'A4' | 'Letter';
    print_background?: boolean;
    viewport_width?: number;
    viewport_height?: number;
    include_interactives?: boolean;
    interaction_plan?: WebInteractionPlanStep[];
    staging?: WebStagingOptions;
  },
): Promise<WebPdfResponse> {
  return webCaptureJsonFetch('/api/web/pdf', body);
}

export async function postWebExtract(
  body: WebCaptureRequestFlags & {
    url: string;
    render_js?: boolean;
    include_interactives?: boolean;
    interaction_plan?: WebInteractionPlanStep[];
    staging?: WebStagingOptions;
  },
): Promise<WebExtractResponse> {
  return webCaptureJsonFetch('/api/web/extract', body);
}

export async function postWebCrawl(body: WebCrawlRequestBody): Promise<WebCrawlResponse> {
  return webCaptureJsonFetch('/api/web/crawl', body);
}

export type WebSearchResult = {
  title: string;
  url: string;
  snippet: string;
  score?: number;
  source_engine?: string;
};

export type WebSearchResponse = {
  query: string;
  pageno?: number;
  count: number;
  results: WebSearchResult[];
  searxng_url?: string;
};

export async function getWebSearchHealth(): Promise<Record<string, unknown> | null> {
  try {
    return await jsonFetch('/api/web/search-health');
  } catch {
    return null;
  }
}

export async function postWebSearch(body: {
  query: string;
  pageno?: number;
  time_range?: 'day' | 'month' | 'year';
  language?: string;
  safesearch?: number;
  max_results?: number;
}): Promise<WebSearchResponse> {
  return jsonFetch('/api/web/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

export type AgentLaneCatalogEntry = {
  agent_key: string;
  lane: string;
  lane_label: string;
  lane_description: string;
  default_model?: string;
  tool_model?: string;
  tool_allowlist?: string[];
  default_web_search?: boolean;
  default_use_tools?: boolean;
};

export async function getAgentLanes(): Promise<{ lanes: Record<string, { label: string; description: string }>; agents: AgentLaneCatalogEntry[] }> {
  return jsonFetch('/api/agent-lanes');
}

/** Veeva Suite RTE/CLM ZIP (agent-api → veeva-suite-worker). */
export type VeevaSuiteHealth = {
  ok: boolean;
  service?: string;
  supports?: string[];
};

export async function getVeevaSuiteHealth(): Promise<VeevaSuiteHealth | null> {
  try {
    return await jsonFetch('/api/veeva-suite/health');
  } catch {
    return null;
  }
}

export type VeevaSuiteInventoryItem = {
  type: string;
  value: string;
  label?: string;
  source: string;
  unitName?: string;
  status: 'ok' | 'warning' | 'error';
  message?: string;
};

export type VeevaSuiteUnit = {
  id: string;
  name: string;
  sourcePath: string;
  previewPath: string;
  screenshotPath?: string;
  htmlLength: number;
  type?: 'fragment' | 'slide';
  dimensions?: string;
};

export type VeevaSuiteWarning = {
  severity: 'info' | 'warning' | 'error';
  code: string;
  message: string;
  source?: string;
};

/** RTE assembled-email iframe: QA highlights, plain processed, or magenta tokens + fragment frames. */
export type RteEmailPreviewStyle = 'qa' | 'processed' | 'tokens';

export type VeevaSuiteResponse = {
  id: string;
  packageType: 'rte' | 'clm' | 'unknown';
  sourceName: string;
  fragmentCount: number;
  slideCount: number;
  fragments: VeevaSuiteUnit[];
  slides: VeevaSuiteUnit[];
  navigation: { from: string; to: string; reason: string }[];
  warnings: VeevaSuiteWarning[];
  inventory: VeevaSuiteInventoryItem[];
  screenshots: {
    fullPage?: string;
    viewport600?: string;
    viewport400?: string;
    fragments: string[];
    slides: string[];
  };
  previewUrl: string;
  assembledHtmlUrl?: string;
  assembledHtmlProcessedUrl?: string;
  assembledHtmlTokensUrl?: string;
  reportHtmlUrl: string;
  reportPdfUrl?: string;
  submissionPdfUrl?: string;
  submissionMeta?: {
    emailTitle: string;
    subjectLines: string[];
    toAddress?: string;
    fromAddress?: string;
    previewMode?: 'tokens' | 'processed';
    generatedAt: string;
  };
  manifestUrl: string;
  downloadUrl: string;
};

export type VeevaSuiteSubmissionRequest = {
  emailTitle: string;
  subjectLines: string[];
  toAddress: string;
  fromAddress: string;
  previewMode?: 'tokens' | 'processed';
};

export async function postVeevaSuiteTokens(file: File): Promise<{ packageType: string; tokens: string[] }> {
  const fd = new FormData();
  fd.append('file', file);
  const res = await fetch(`${apiBase()}/api/veeva-suite/suite-runs/tokens`, { method: 'POST', body: fd, cache: 'no-store' });
  const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    const detail = typeof json.detail === 'string' ? json.detail : '';
    const err = typeof json.error === 'string' ? json.error : '';
    throw new Error(detail || err || 'Token scan failed');
  }
  const packageType = typeof json.packageType === 'string' ? json.packageType : 'unknown';
  const tokens = Array.isArray(json.tokens) ? (json.tokens as unknown[]).filter((x): x is string => typeof x === 'string') : [];
  return { packageType, tokens };
}

export async function postVeevaSuite(
  file: File,
  tokenMap: Record<string, string>,
  screenshots: boolean,
): Promise<VeevaSuiteResponse> {
  const fd = new FormData();
  fd.append('file', file);
  fd.append('tokenMap', JSON.stringify(tokenMap));
  fd.append('screenshots', String(screenshots));
  const res = await fetch(`${apiBase()}/api/veeva-suite/suite-runs`, { method: 'POST', body: fd, cache: 'no-store' });
  const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    let detail = '';
    if (typeof json.detail === 'string') detail = json.detail;
    else if (Array.isArray(json.detail))
      detail = json.detail.map((x) => (typeof x === 'object' && x !== null ? JSON.stringify(x) : String(x))).join('; ');
    const err = typeof json.error === 'string' ? json.error : '';
    const fallback = !Object.keys(json).length ? await res.text().catch(() => '') : '';
    throw new Error(detail || err || fallback || 'Veeva Suite build failed');
  }
  return json as unknown as VeevaSuiteResponse;
}

export async function postVeevaSuiteSubmission(
  runId: string,
  body: VeevaSuiteSubmissionRequest,
): Promise<VeevaSuiteResponse> {
  const res = await fetch(`${apiBase()}/api/veeva-suite/suite-runs/${encodeURIComponent(runId)}/submission`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    cache: 'no-store',
  });
  const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    const detail = typeof json.detail === 'string' ? json.detail : '';
    const err = typeof json.error === 'string' ? json.error : '';
    throw new Error(detail || err || 'Submission PDF generation failed');
  }
  return json as unknown as VeevaSuiteResponse;
}

export async function getModelStatus() {
  return jsonFetch('/api/model/status');
}

export async function getModelOverview() {
  return jsonFetch('/api/model/overview');
}

export type PullStreamEvent = {
  status?: string;
  completed?: number;
  total?: number;
  error?: string;
};

/** Stream NDJSON lines from Ollama pull (proxied via agent-api → model-router). */
export async function pullModelStream(
  model: string,
  onEvent: (e: PullStreamEvent) => void,
  signal?: AbortSignal,
): Promise<void> {
  const res = await fetch(`${apiBase()}/api/model/pull`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model }),
    signal,
  });
  if (!res.ok) {
    const t = await res.text().catch(() => '');
    throw new Error(t || `HTTP ${res.status}`);
  }
  const reader = res.body?.getReader();
  if (!reader) throw new Error('No response body');
  const dec = new TextDecoder();
  let buffer = '';
  const flushLine = (line: string) => {
    const t = line.trim();
    if (!t) return;
    let obj: Record<string, unknown>;
    try {
      obj = JSON.parse(t) as Record<string, unknown>;
    } catch {
      return;
    }
    onEvent({
      status: typeof obj.status === 'string' ? obj.status : undefined,
      completed: typeof obj.completed === 'number' ? obj.completed : undefined,
      total: typeof obj.total === 'number' ? obj.total : undefined,
      error: typeof obj.error === 'string' ? obj.error : undefined,
    });
  };
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += dec.decode(value, { stream: true });
    const parts = buffer.split('\n');
    buffer = parts.pop() ?? '';
    for (const part of parts) flushLine(part);
  }
  flushLine(buffer);
}
export async function summarizeRepo(path:string){ return jsonFetch('/api/repo/summarize', {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({path, max_files:700})}); }
export async function approveApproval(id:string, note = ''){ return jsonFetch(`/api/approvals/${id}/approve`, {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({note})}); }
export async function rejectApproval(id:string, note = ''){ return jsonFetch(`/api/approvals/${id}/reject`, {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({note})}); }

export type AskClarifierMode = 'intake' | 'feedback' | 'timeline' | 'scope' | 'handoff';
export type AskClarifierTone = 'direct' | 'diplomatic' | 'internal' | 'client_ready';

export async function postAskClarifier(body: {
  request_text: string;
  mode?: AskClarifierMode;
  tone?: AskClarifierTone;
  project_context?: string;
  known_scope?: string;
  known_timeline?: string;
}) {
  return jsonFetch('/api/ask-clarifier/analyze', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

export type ReplyCoachSituation =
  | 'client_pushback'
  | 'scope_pressure'
  | 'timeline_pressure'
  | 'feedback_response'
  | 'internal_alignment'
  | 'general';
export type ReplyCoachTone = 'diplomatic' | 'firm' | 'warm' | 'executive' | 'internal_direct';
export type ReplyCoachAudience = 'client' | 'internal' | 'vendor' | 'mixed';

export async function postReplyCoach(body: {
  message_text: string;
  situation?: ReplyCoachSituation;
  tone?: ReplyCoachTone;
  audience?: ReplyCoachAudience;
  goal?: string;
  project_context?: string;
  constraints?: string;
}) {
  return jsonFetch('/api/reply-coach/draft', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

// --- Learning platform ---

export type LearningCatalogRow = {
  id: string;
  version: number;
  module_type?: string;
  title: string;
  agency_role?: string;
  vertical?: string;
  estimatedMinutes?: number;
};

export type LearningEnrollmentRow = {
  id: string;
  playbook_id: string;
  playbook_version: number;
  module_type: string;
  agency_role?: string | null;
  vertical?: string | null;
  brand_key?: string | null;
  sandbox_project_key: string;
  status: string;
  current_step_id?: string | null;
  completed_steps?: number;
  total_steps?: number;
  progress_label?: string;
  recap_due_at?: string | null;
  content_update?: { summary?: string };
};

export async function listLearningCatalog(): Promise<{ playbooks: LearningCatalogRow[] }> {
  return jsonFetch('/api/learning/catalog');
}

export async function getLearningPlaybook(
  playbookId: string,
  brandKey?: string | null,
): Promise<Record<string, unknown>> {
  const q = brandKey ? `?brand_key=${encodeURIComponent(brandKey)}` : '';
  return jsonFetch(`/api/learning/playbooks/${encodeURIComponent(playbookId)}${q}`);
}

export async function enrollLearning(playbookId: string, brandKey?: string | null) {
  return jsonFetch('/api/learning/enroll', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ playbook_id: playbookId, brand_key: brandKey ?? null }),
  });
}

export async function listMyLearningEnrollments(): Promise<{ enrollments: LearningEnrollmentRow[] }> {
  return jsonFetch('/api/learning/enrollments/me');
}

export async function getLearningEnrollment(enrollmentId: string) {
  return jsonFetch(`/api/learning/enrollments/${encodeURIComponent(enrollmentId)}`);
}

export async function completeLearningStep(
  enrollmentId: string,
  stepId: string,
  quizAnswers?: Record<string, unknown>,
) {
  return jsonFetch(
    `/api/learning/enrollments/${encodeURIComponent(enrollmentId)}/steps/${encodeURIComponent(stepId)}/complete`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ quiz_answers: quizAnswers ?? null }),
    },
  );
}

export async function validateLearningStep(enrollmentId: string, stepId?: string) {
  const q = stepId ? `?step_id=${encodeURIComponent(stepId)}` : '';
  return jsonFetch(`/api/learning/enrollments/${encodeURIComponent(enrollmentId)}/validate${q}`, {
    method: 'POST',
  });
}

export async function listLearningRecapDue(): Promise<{ enrollments: LearningEnrollmentRow[] }> {
  return jsonFetch('/api/learning/enrollments/me/recap-due');
}

export async function listLearningCompetencies(): Promise<{ competencies: string[] }> {
  return jsonFetch('/api/learning/enrollments/me/competencies');
}

export async function getLearningOpsSummary(): Promise<{
  rows: {
    playbook_id: string;
    title: string;
    enrolled: number;
    completed: number;
    in_progress: number;
    completion_rate: number;
  }[];
}> {
  return jsonFetch('/api/learning/ops/summary');
}

export async function postLearningCoach(body: {
  enrollment_id: string;
  message: string;
  step_id?: string;
}) {
  return jsonFetch('/api/learning/coach', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

export async function markLearningContentSeen(enrollmentId: string) {
  return jsonFetch(`/api/learning/enrollments/${encodeURIComponent(enrollmentId)}/content-seen`, {
    method: 'PATCH',
  });
}

export async function getLearningCertificate(enrollmentId: string) {
  return jsonFetch(`/api/learning/enrollments/${encodeURIComponent(enrollmentId)}/certificate`);
}

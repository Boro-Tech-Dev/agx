import type { GovernanceDoc } from './types';

export const GOVERNANCE_SECTION_IDS = [
  'executive-summary',
  'access-control',
  'authorization',
  'data-retention',
  'llm-usage',
  'audit-trail',
  'encryption-network',
  'accessibility',
  'subprocessors',
] as const;

export function getGovernanceDoc(): GovernanceDoc {
  return GOVERNANCE_DOC;
}

const GOVERNANCE_DOC: GovernanceDoc = {
  title: 'Platform governance',
  lastVerifiedFromCode: '2026-05-17',
  heroSummary: [
    'This page describes how the internal operator dashboard and agent platform handle security, data retention, LLM inference, and audit logging—as implemented in code today.',
    'Access requires a valid Keycloak session. Inference is local-first (Ollama via model-router). Operational data persists in Postgres and attached volumes until operators delete it or wipe infrastructure.',
    'This is not legal advice, a HIPAA attestation, or a WCAG conformance certificate. Your organization defines corporate retention and compliance policies on top of these technical facts.',
  ],
  quickLinks: [
    { href: '/monitoring', label: 'Queues (token aggregates)' },
    { href: '/approvals', label: 'Approvals' },
    { href: '/memory', label: 'Memory' },
    { href: '/model', label: 'Models' },
  ],
  sections: [
    {
      id: 'executive-summary',
      title: 'Executive summary',
      paragraphs: [
        'Audience: operators, engineering, and leadership evaluating rollout of this internal platform.',
        'Primary access control is Keycloak-backed login to the web dashboard. The browser talks to agent-api only through the Next.js BFF (/api/*), which verifies JWTs and can refresh sessions.',
        'Durable memory is explicit (ingest/save flows and agent artifacts). Everything else—runs, documents, project data—remains in the database unless archived or removed by operators.',
      ],
      bullets: [
        'Not claimed: third-party SOC 2 report, HIPAA BAA, ADA/WCAG certification, or guaranteed data-subject deletion APIs.',
        'Claimed: transparent description of what the software actually stores, logs, and sends to models when self-hosted.',
      ],
    },
    {
      id: 'access-control',
      title: 'Access control and session security',
      paragraphs: [
        'Plain HTML landing at `/` (zero-JS Route Handler) and OIDC login on auth.idea-impact.com (no password form on the dashboard domain). Protected routes under `/home`, `/tools`, etc. Tokens live in httpOnly cookies dd_access_token and dd_refresh_token.',
        'Same-origin /api/* requests are proxied to agent-api only after resolveDashboardSession validates the access JWT or refreshes via Keycloak.',
      ],
      bullets: [
        'Realm platform, confidential client web-dashboard (see infra/keycloak/realm-platform.json).',
        'Access token lifespan: 12 hours (43200 s). SSO idle: 48 hours; SSO max: 7 days (realm import defaults).',
        'Cookies: httpOnly, SameSite=Lax, Secure when HTTPS or X-Forwarded-Proto: https (or AUTH_COOKIE_SECURE).',
        'JWT: RS256, exp required, JWKS loaded from iss; trusted iss hosts include KEYCLOAK_BASE_URL hostname, keycloak, localhost, loopbacks, or exact KEYCLOAK_ISSUER.',
        '/health is unauthenticated for load-balancer probes only.',
        'AUTH_DISABLED=1 or true bypasses auth for trusted local dev only—never in production.',
        'Do not set NEXT_PUBLIC_AGENT_API_URL in production: the browser would call agent-api directly and bypass the session gate.',
      ],
      tables: [
        {
          columns: [
            { key: 'surface', header: 'Surface' },
            { key: 'expectation', header: 'Deployment expectation' },
          ],
          rows: [
            {
              surface: 'web-dashboard :3000',
              expectation: 'Expose via TLS reverse proxy; only authenticated operators.',
            },
            {
              surface: 'agent-api :8080',
              expectation: 'Not on public internet—bind loopback or omit ports in Compose.',
            },
            {
              surface: 'browser-runner, tool-runner, postgres, redis, ollama',
              expectation: 'Internal network only unless deliberately hardened.',
            },
          ],
        },
      ],
      sourceRefs: [
        { path: 'docs/auth-keycloak.md' },
        { path: 'apps/web-dashboard/middleware.ts' },
        { path: 'apps/web-dashboard/lib/auth/verifyAccessToken.ts' },
        { path: 'apps/web-dashboard/lib/server/resolveDashboardSession.ts' },
        { path: 'infra/keycloak/realm-platform.json' },
      ],
    },
    {
      id: 'authorization',
      title: 'Authorization and human-in-the-loop',
      paragraphs: [
        'A valid dashboard session gates API access. Fine-grained per-user RBAC on agent actions is not fully implemented—treat shared operator accounts as an organizational risk.',
        'High-impact writes go through approval flows and sandboxed tools where configured.',
      ],
      bullets: [
        'Builder patch bundles can enter needs_approval; approve/reject/execute APIs record approval.* run_events (approver identity is not yet stored on the row).',
        'Brief ops draft writes may require x-brief-ops-token when BRIEF_OPS_TOKEN is set.',
        'tool-runner: workspace path confinement; blocks .env, keys, node_modules; secret patterns redacted as [REDACTED] in output.',
        'Shell commands off unless ALLOW_SHELL_COMMANDS=true; fixed allowlist when enabled.',
        'Repo writes off by default (ALLOW_REPO_WRITE=false in .env.example).',
        'Memory and hybrid search scoped by workspace_key and project_key; mismatches return 400/404.',
      ],
      sourceRefs: [
        { path: 'apps/agent-api/app/services/approval_service.py' },
        { path: 'apps/agent-api/app/services/brief_template_service.py', symbol: 'require_brief_ops_write' },
        { path: 'apps/tool-runner/tools/main.py', symbol: 'redact' },
        { path: 'apps/agent-api/app/services/memory_service.py' },
      ],
    },
    {
      id: 'data-retention',
      title: 'Data classification and retention (non-LLM)',
      paragraphs: [
        'There is no automated TTL purge for Postgres memories, runs, documents, or artifacts in application code. Data remains until an operator deletes rows, archives content, or wipes infrastructure volumes.',
        'Memories are the intentional long-term knowledge store; other tables are operational records with the same default persistence unless you define an organizational retention schedule.',
      ],
      tables: [
        {
          columns: [
            { key: 'dataClass', header: 'Data class' },
            { key: 'where', header: 'Where stored' },
            { key: 'retention', header: 'Default retention' },
            { key: 'saveAction', header: 'User save action' },
          ],
          rows: [
            {
              dataClass: 'Agent runs (prompts in input, outputs)',
              where: 'agent_runs',
              retention: 'Until manual delete or volume wipe',
              saveAction: 'Every agent run',
            },
            {
              dataClass: 'Run timeline / audit',
              where: 'run_events',
              retention: 'Same',
              saveAction: 'Automatic per run',
            },
            {
              dataClass: 'Uploaded documents and chunks',
              where: 'source_documents, document_chunks',
              retention: 'Same',
              saveAction: 'Ingest / upload flows',
            },
            {
              dataClass: 'Artifacts',
              where: 'DB + local-artifacts / local-uploads volumes',
              retention: 'Same',
              saveAction: 'Created on successful runs',
            },
            {
              dataClass: 'Project registry, items, timeline',
              where: 'Postgres project tables',
              retention: 'Same',
              saveAction: 'CRUD via UI/API',
            },
            {
              dataClass: 'Memories',
              where: 'memories (+ links)',
              retention: 'Same until archived or superseded',
              saveAction: 'Explicit ingest/save; status can be archived',
            },
            {
              dataClass: 'Session cookies',
              where: 'Browser httpOnly',
              retention: 'JWT exp / Keycloak SSO',
              saveAction: 'Login only',
            },
            {
              dataClass: 'Redis queues / embed cache',
              where: 'Redis',
              retention: 'Ephemeral (e.g. embed cache ~120s)',
              saveAction: 'Not durable memory',
            },
          ],
        },
      ],
      bullets: [
        'Soft archive: source_documents.archived_at; memories support status archived / superseded.',
        'Operator controls: database backup/restore, manual SQL, docker compose down with volume removal (scripts/compose-down.sh -v).',
        'Stale runs in running state may be marked failed after ~90 minutes (STALE_RUNNING_MINUTES)—this is liveness, not data deletion.',
      ],
      sourceRefs: [
        { path: 'infra/postgres/schema.sql' },
        { path: 'apps/agent-worker/worker/main.py', note: 'STALE_RUNNING_MINUTES' },
      ],
    },
    {
      id: 'llm-usage',
      title: 'LLM usage and inference retention',
      paragraphs: [
        'Current code paths use local Ollama only via the internal model-router service. There are no OpenAI, Anthropic, or Azure inference clients in apps/ today. Architecture documents mention optional future LiteLLM— not shipped; update this page if that changes.',
        'When fully self-hosted, prompt data does not leave your infrastructure for inference. Model weights are downloaded from the Ollama registry at deploy time (ollama pull).',
      ],
      bullets: [
        'Agents (nine): pm, synergy, clinic, builder, canon, forge, kitt, eddie, bubs—each calls POST model-router/v1/route.',
        'Also LLM-backed: brief autofill (builder), timeline CSV phase mapping (skippable via TIMELINE_MAP_MODE=fallback_only), embeddings for ingest and hybrid memory.',
        'Default model tags (Compose/.env.example): PM/HAL llama3.1:8b; builder qwen2.5:7b; forge/canon/synergy/clinic llama3.2:3b; kitt gemma3:270m; eddie deepseek-r1:1.5b; bubs tinyllama:1.1b. Embeddings: nomic-embed-text (default), plus embeddinggemma, mxbai-embed-large, bge-m3 per-agent on /admin/retrieval. Rerankers: TEI bge/jina, Ollama mxbai/qwen3, or off.',
        'Sent to the model: user prompt, project registry markdown (selected agents), up to 12 memory hits (body truncated to 1600 chars each), document chunks, optional repo summary for builder.',
        'Context window: OLLAMA_NUM_CTX default 2048 tokens—long registry + memory can truncate the tail of the user message.',
        'Embedding input capped at 6000 characters per call.',
      ],
      tables: [
        {
          columns: [
            { key: 'store', header: 'Store' },
            { key: 'content', header: 'Content' },
            { key: 'notes', header: 'Notes' },
          ],
          rows: [
            {
              store: 'agent_runs.input',
              content: 'Full run JSON including user text',
              notes: 'Primary prompt record',
            },
            {
              store: 'agent_runs.output + output._router',
              content: 'Structured JSON + raw model preview',
              notes: 'Up to 24000 chars (ROUTER_RAW_CONTENT_MAX_CHARS); SHA-256 of full text',
            },
            {
              store: 'run_events (model.router.*)',
              content: 'Metadata, token counts, short SHA preview',
              notes: 'Full prompts not stored in run_events by design',
            },
            {
              store: 'MODEL_ROUTER_LOG_FULL_MESSAGES',
              content: 'Full chat payloads in service logs',
              notes: 'Off by default—do not enable in production',
            },
            {
              store: 'Ollama process',
              content: 'KV cache / loaded weights',
              notes: 'Not a shared cross-user prompt log',
            },
          ],
        },
      ],
      sourceRefs: [
        { path: 'docs/local_llm.md' },
        { path: 'apps/model-router/router/hybrid.py' },
        { path: 'apps/agent-worker/worker/workflows/router_output_envelope.py' },
        { path: 'apps/agent-api/app/routes/monitoring.py', note: 'token aggregates from model.router.completed' },
        { path: 'docker-compose.yml', note: 'DEFAULT_*_MODEL env defaults' },
      ],
    },
    {
      id: 'audit-trail',
      title: 'Audit trail',
      paragraphs: [
        'run_events in Postgres is the durable operational audit log for agent runs. Each row has run_id, event_type, message, payload (JSONB), and created_at.',
        'Mid-run events insert as they occur so the dashboard timeline stays live; terminal events may be batched at run completion.',
      ],
      bullets: [
        'Lifecycle: run.queued, run.started, run.completed, run.failed, run.degraded, run.cancelled, run.needs_approval.',
        'Memory: memory.context, memory.embed.request / .completed / .failed / .skipped / .cache_hit.',
        'Model: model.router.request, model.router.completed, model.router.failed (token usage aggregated on Queues page).',
        'Approvals: approval.requested, approval.approved, approval.rejected, approval.executed.',
        'Workflow: workflow.* steps per agent (pm, kitt, builder, etc.).',
        'View in UI: /runs/[id], agent detail timelines, ToolCallTimeline component.',
        'Not implemented yet: immutable SIEM export, per-command tool-runner audit table (recommended in architecture only).',
        'Router debug also stores truncated model text under agent_runs.output._router (see LLM section).',
      ],
      sourceRefs: [
        { path: 'infra/postgres/schema.sql', symbol: 'run_events' },
        { path: 'apps/agent-api/app/services/common.py', symbol: 'event' },
        { path: 'apps/web-dashboard/app/runs/[id]/page.tsx' },
        { path: 'apps/web-dashboard/components/ToolCallTimeline.tsx' },
      ],
    },
    {
      id: 'encryption-network',
      title: 'Encryption and network',
      paragraphs: [
        'In transit: terminate TLS at the reverse proxy to the dashboard. Internal Docker Compose traffic is typically plain HTTP between services.',
        'At rest: the application does not implement Postgres/Redis/MinIO volume encryption—use infrastructure controls (disk encryption, secrets management, restricted backups).',
      ],
      bullets: [
        'Development Compose uses default credentials (e.g. postgres, minio)—not safe for production as-is.',
        'tool-runner redacts common secret patterns in read/search/shell output.',
        'WEB_ALLOW_INSECURE_TLS on browser-runner only when explicitly enabled for capture scenarios.',
        'Keycloak realm import sets sslRequired: none for local dev—production should harden realm and rely on proxy TLS.',
      ],
      sourceRefs: [
        { path: 'docker-compose.yml' },
        { path: 'apps/tool-runner/tools/main.py', symbol: 'SECRET_PATTERNS' },
        { path: 'apps/browser-runner/tools/capture_helpers.py', note: 'WEB_ALLOW_INSECURE_TLS' },
      ],
    },
    {
      id: 'accessibility',
      title: 'Accessibility (ADA / WCAG)',
      paragraphs: [
        'This internal operator dashboard includes incremental accessibility affordances but has not been audited or certified against WCAG 2.x or ADA/508.',
        'We continue improving keyboard and screen-reader usability on high-traffic routes; this is not positioned as a public-facing conformance claim.',
      ],
      bullets: [
        'Present: lang=en, color-scheme / theme support, Radix dialog focus behavior, partial ARIA on collapsibles and toolbars, ⌘K command palette, labeled login form, some aria-live regions.',
        'Not present: documented WCAG target, axe/Playwright a11y CI, VPAT, eslint-plugin-jsx-a11y on app source.',
        'Fragile areas: vis-timeline Gantt, Recharts charts, dnd-kit panel reorder (pointer-only), dense data tables, icon-only controls without labels.',
      ],
      sourceRefs: [
        { path: 'apps/web-dashboard/app/layout.tsx' },
        { path: 'apps/web-dashboard/components/home/HomeCommandPalette.tsx' },
        { path: 'apps/web-dashboard/components/workspaces/WorkspacesSortablePanels.tsx' },
      ],
    },
    {
      id: 'subprocessors',
      title: 'Subprocessors and data residency',
      paragraphs: [
        'When the stack runs entirely on infrastructure you control, inference subprocessors are none—prompts stay on your network to Ollama.',
        'Initial model downloads contact the Ollama model registry (deploy-time network boundary).',
        'There is no built-in data-subject deletion or export API; handle GDPR/CCPA-style requests via organizational DB procedures.',
      ],
      bullets: [
        'CLOUD_LLM_USD_PER_1K_TOKENS on agent-api is a hypothetical rate for estimated savings UI only—no cloud LLM API is called.',
        'If hosted LLM providers are added later, this page and operator contracts must be updated before enablement.',
      ],
      sourceRefs: [
        { path: 'apps/agent-api/app/routes/monitoring.py', note: 'cloud savings display' },
        { path: 'scripts/ollama-warm-models.sh', note: 'model pull at deploy' },
      ],
    },
  ],
  knownIssues: [
    {
      issue: 'No automated Postgres retention purge',
      whyItMatters: 'Prompts, outputs, and documents persist indefinitely in the database.',
      mitigationToday: 'Define operator backup/wipe policy; avoid MODEL_ROUTER_LOG_FULL_MESSAGES in production.',
    },
    {
      issue: 'agent-api lacks JWT validation if port is published',
      whyItMatters: 'Direct access bypasses the dashboard session gate.',
      mitigationToday: 'Do not expose :8080 publicly; optional Phase 2 JWT on agent-api (see docs/auth-keycloak.md).',
    },
    {
      issue: 'Approvals lack per-user attribution',
      whyItMatters: 'Weaker accountability on who approved a change.',
      mitigationToday: 'Internal tool + per-person Keycloak accounts; audit run_events for approval.* types.',
    },
    {
      issue: 'Multi-user RBAC deferred',
      whyItMatters: 'Shared operator credentials increase insider-risk surface.',
      mitigationToday: 'Provision individual realm users; limit who receives client secrets.',
    },
    {
      issue: 'Partial accessibility',
      whyItMatters: 'Keyboard and screen-reader gaps on charts, Gantt, and drag-reorder panels.',
      mitigationToday: 'Prioritize fixes on login, home, workspaces, and tools used daily.',
    },
    {
      issue: 'Keycloak sslRequired: none in dev realm import',
      whyItMatters: 'Misconfigured production realm could weaken transport expectations.',
      mitigationToday: 'TLS at reverse proxy; harden realm for production deployments.',
    },
    {
      issue: 'No application-level encryption at rest',
      whyItMatters: 'Volume compromise exposes Postgres/artifact files readable.',
      mitigationToday: 'Infrastructure disk encryption and restricted backup access.',
    },
  ],
};

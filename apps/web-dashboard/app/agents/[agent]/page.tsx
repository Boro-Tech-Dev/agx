'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { createRun, getRun, getRunEvents, listAgents, listProjects } from '../../../lib/api';
import {
  allowsStructuredBreakdown,
  BLOCKED_BREAKDOWN_AGENT_KEYS,
  isLogOnlyProjectType,
} from '../../../lib/projectTypes';
import { isPersonalPm } from '../../../lib/pmMode';
import {
  accentClasses,
  agentMeta,
  headerBadge,
  isAgentCatalogDisabled,
  type AgentNavKey,
} from '../../../lib/agents';
import { PmBreakdownSchemaDirections } from '../../../components/PmBreakdownSchemaDirections';
import { StructuredOutput } from '../../../components/StructuredOutput';
import { SubpageHeader } from '../../../components/SubpageHeader';
import { DashboardShell } from '../../../components/DashboardShell';
import { StatusPill } from '../../../components/ui/ragtag/StatusPill';
import { statusToVariant } from '../../../lib/ragtag/statusVariants';
import { RT_BTN_PRIMARY } from '../../../lib/ragtag/panelClasses';
import {
  eventStripeBorderClass,
  latestEventIdFromList,
  latestEventRowRingClass,
} from '../../../lib/runEventStripe';
import { AgentLaneBadge } from '../../../components/agents/AgentLaneBadge';
import { agentLaneRow } from '../../../lib/agentLanes';
import {
  agentRetrievalDefaultLabel,
  buildRerankerRunOptions,
  RERANKER_RUN_DEFAULT,
  rerankerOverrideForRun,
  type AgentRetrievalRow,
  type RerankerCatalogRow,
  type RerankerRunChoice,
} from '../../../lib/retrievalRunOptions';
import { ToolCallsPanel } from '../../../components/runs/ToolCallsPanel';

const terminal = new Set(['completed', 'degraded', 'failed', 'cancelled', 'needs_approval']);

const PROJECT_STORAGE_KEY = 'dd.project_key';

export default function AgentPage({ params }: { params: { agent: string } }) {
  const agentKey = params.agent;
  const cfg = agentMeta[agentKey as AgentNavKey] ?? agentMeta.pm;
  const c = accentClasses[cfg.accent];
  const hb = headerBadge[(agentKey in agentMeta ? agentKey : 'pm') as AgentNavKey];
  const navAgent = (agentKey in agentMeta ? agentKey : 'pm') as AgentNavKey;
  const [content, setContent] = useState('');
  const [repoPath, setRepoPath] = useState('.');
  const [projects, setProjects] = useState<any[]>([]);
  const [projectKey, setProjectKey] = useState('');
  const [runId, setRunId] = useState<string | null>(null);
  const [run, setRun] = useState<any>(null);
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [projectsError, setProjectsError] = useState<string | null>(null);
  const [pollError, setPollError] = useState<string | null>(null);
  const [agentCatalogDisabled, setAgentCatalogDisabled] = useState(false);
  const [deepLinkParent, setDeepLinkParent] = useState<string | null>(null);
  const [deepLinkFocusItemId, setDeepLinkFocusItemId] = useState<string | null>(null);
  const [continuationReply, setContinuationReply] = useState('');
  /** First PM/KITT run: opt-in to full Workspaces registry (defaults off in worker). */
  const [includeRegistryTimeline, setIncludeRegistryTimeline] = useState(false);
  const [includeRegistryOpenItems, setIncludeRegistryOpenItems] = useState(false);
  const [useTools, setUseTools] = useState(false);
  const [webSearch, setWebSearch] = useState(false);
  const [rerankerRunChoice, setRerankerRunChoice] = useState<RerankerRunChoice>(RERANKER_RUN_DEFAULT);
  const [retrievalCatalog, setRetrievalCatalog] = useState<RerankerCatalogRow[]>([]);
  const [agentRetrievalDefault, setAgentRetrievalDefault] = useState<AgentRetrievalRow | null>(null);
  const laneRow = agentLaneRow(agentKey);

  useEffect(() => {
    if (laneRow?.default_web_search) setWebSearch(true);
  }, [agentKey, laneRow?.default_web_search]);

  useEffect(() => {
    if (laneRow?.lane !== 'tool_capable') {
      setRetrievalCatalog([]);
      setAgentRetrievalDefault(null);
      setRerankerRunChoice(RERANKER_RUN_DEFAULT);
      return;
    }
    let cancelled = false;
    void fetch('/api/admin/retrieval/agents')
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error(res.statusText))))
      .then((json: { agents?: AgentRetrievalRow[]; rerankers?: RerankerCatalogRow[] }) => {
        if (cancelled) return;
        setRetrievalCatalog(json.rerankers ?? []);
        const row = (json.agents ?? []).find((a) => a.agent === agentKey) ?? null;
        setAgentRetrievalDefault(row);
        setRerankerRunChoice(RERANKER_RUN_DEFAULT);
      })
      .catch(() => {
        if (!cancelled) {
          setRetrievalCatalog([]);
          setAgentRetrievalDefault(null);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [agentKey, laneRow?.lane]);

  const rerankerRunOptions = useMemo(
    () => buildRerankerRunOptions(retrievalCatalog, agentRetrievalDefault),
    [retrievalCatalog, agentRetrievalDefault],
  );

  const applyRerankerOverride = useCallback(
    (payload: Record<string, unknown>) => {
      const override = rerankerOverrideForRun(rerankerRunChoice);
      if (override) payload.reranker_override = override;
    },
    [rerankerRunChoice],
  );

  const loadProjects = useCallback(async () => {
    setProjectsError(null);
    try {
    const rows = await listProjects();
    setProjects(rows);
    const keys = (rows as { key: string }[]).map((p) => p.key);
    const urlPk =
      typeof window !== 'undefined'
        ? new URLSearchParams(window.location.search).get('project_key')
        : null;
    setProjectKey((prev) => {
      if (urlPk && keys.includes(urlPk)) return urlPk;
      if (prev && keys.includes(prev)) return prev;
      const saved = typeof localStorage !== 'undefined' ? localStorage.getItem(PROJECT_STORAGE_KEY) : null;
      if (saved && keys.includes(saved)) return saved;
      return keys[0] || '';
    });
    } catch (e: unknown) {
      setProjects([]);
      setProjectsError(e instanceof Error ? e.message : String(e));
    }
  }, []);

  useEffect(() => {
    loadProjects();
  }, [loadProjects]);

  useEffect(() => {
    let cancelled = false;
    void listAgents()
      .then((rows) => {
        if (cancelled) return;
        const row = (rows as { key: string; ui?: unknown }[]).find((r) => r.key === agentKey);
        setAgentCatalogDisabled(row ? isAgentCatalogDisabled(row.ui) : false);
      })
      .catch(() => {
        if (!cancelled) setAgentCatalogDisabled(false);
      });
    return () => {
      cancelled = true;
    };
  }, [agentKey]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const sp = new URLSearchParams(window.location.search);
    const pr = sp.get('parent_run');
    if (pr) setDeepLinkParent(pr);
    const pi = sp.get('project_item_id');
    if (pi) setDeepLinkFocusItemId(pi);
    const seed = sp.get('continuation_seed');
    if (seed) {
      try {
        setContinuationReply(decodeURIComponent(seed));
      } catch {
        setContinuationReply(seed);
      }
      sp.delete('continuation_seed');
      const qs = sp.toString();
      const path = window.location.pathname;
      window.history.replaceState({}, '', qs ? `${path}?${qs}` : path);
    }
  }, []);

  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === 'visible') loadProjects();
    };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, [loadProjects]);

  useEffect(() => {
    if (projectKey) localStorage.setItem(PROJECT_STORAGE_KEY, projectKey);
    const p = projects.find((x: any) => x.key === projectKey);
    if (p?.workspace_key) localStorage.setItem('dd.workspace_key', p.workspace_key);
  }, [projectKey, projects]);

  async function refresh(id:string){
    setPollError(null);
    const [r,e] = await Promise.all([getRun(id), getRunEvents(id)]);
    setRun(r); setEvents(e);
    return r;
  }
  const selectedProject = projects.find((x: any) => x.key === projectKey);
  const personalProject = isPersonalPm(selectedProject);
  const businessPmOrKittOnPersonal =
    (agentKey === 'pm' || agentKey === 'kitt') && personalProject;
  const bubsOnBusiness = agentKey === 'bubs' && !personalProject;
  const logOnlyBlocked =
    BLOCKED_BREAKDOWN_AGENT_KEYS.has(agentKey) &&
    Boolean(projectKey && selectedProject) &&
    isLogOnlyProjectType((selectedProject as { project_type?: string }).project_type) &&
    !allowsStructuredBreakdown(selectedProject);
  const clinicBusinessBanner = agentKey === 'clinic' && !personalProject;
  /** Main request field (minimal registry by default; optional checkboxes add timeline / open items). */
  const effectiveContent = useMemo(() => content.trim(), [content]);

  const canRunPrimary = useMemo(() => Boolean(effectiveContent), [effectiveContent]);

  async function runAgent() {
    if (!projectKey) {
      setError('Select a project before running an agent.');
      return;
    }
    if (businessPmOrKittOnPersonal) {
      setError(
        'Personal projects use Synergy or Bubs, not PM or KITT. Open Synergy or Bubs from the home grid or sidebar.',
      );
      return;
    }
    if (bubsOnBusiness) {
      setError('Business projects use PM or KITT, not Bubs.');
      return;
    }
    if (logOnlyBlocked) {
      setError(
        'This project is log-only: breakdown agents are disabled until you enable “Allow structured breakdown” under Workspaces → current project.',
      );
      return;
    }
    setLoading(true); setError(null); setRun(null); setEvents([]); setRunId(null);
    const stripAgentUrlParams = Boolean(deepLinkParent || deepLinkFocusItemId);
    try {
      const base: Record<string, unknown> = { project_key: projectKey };
      if (deepLinkFocusItemId) base.focus_project_item_id = deepLinkFocusItemId;
      if (agentKey === 'pm' || agentKey === 'kitt') {
        base.include_registry_timeline = includeRegistryTimeline;
        base.include_registry_open_items = includeRegistryOpenItems;
      }
      if (laneRow?.lane === 'tool_capable' && useTools) base.use_tools = true;
      if (webSearch) base.web_search = true;
      applyRerankerOverride(base);
      const created = await createRun(
        agentKey,
        cfg.workflow,
        effectiveContent,
        agentKey === 'builder' ? { ...base, repo_path: repoPath } : base
      );
      setRunId(created.run_id);
      setRun(created);
      setDeepLinkParent(null);
      setDeepLinkFocusItemId(null);
      if (typeof window !== 'undefined' && stripAgentUrlParams) {
        window.history.replaceState({}, '', window.location.pathname);
      }
      await refresh(created.run_id);
    } catch (e:any) { setError(e.message || String(e)); }
    finally { setLoading(false); }
  }

  async function queueContinuation(parentRunId: string) {
    if (!projectKey) {
      setError('Select a project before continuing a run.');
      return;
    }
    const reply = continuationReply.trim();
    const continuationMain = content.trim();
    if (!reply && !continuationMain) {
      setError(
        'Add your answers in the continuation box and/or extra context in the main request field.',
      );
      return;
    }
    if (businessPmOrKittOnPersonal) {
      setError('Personal projects use Synergy or Bubs, not PM or KITT.');
      return;
    }
    if (bubsOnBusiness) {
      setError('Business projects use PM or KITT, not Bubs.');
      return;
    }
    if (logOnlyBlocked) {
      setError(
        'This project is log-only: enable “Allow structured breakdown” under Workspaces → current project to run this agent.',
      );
      return;
    }
    setLoading(true);
    setError(null);
    setRun(null);
    setEvents([]);
    setRunId(null);
    try {
      const contExtra: Record<string, unknown> = {
        project_key: projectKey,
        parent_run_id: parentRunId,
        reply: reply || undefined,
        include_parent_summary: true,
        ...(agentKey === 'builder' ? { repo_path: repoPath } : {}),
        ...(agentKey === 'pm' || agentKey === 'kitt'
          ? {
              include_registry_timeline: includeRegistryTimeline,
              include_registry_open_items: includeRegistryOpenItems,
            }
          : {}),
      };
      if (deepLinkFocusItemId) contExtra.focus_project_item_id = deepLinkFocusItemId;
      if (laneRow?.lane === 'tool_capable' && useTools) contExtra.use_tools = true;
      if (webSearch) contExtra.web_search = true;
      applyRerankerOverride(contExtra);
      const contText = continuationMain;
      const created = await createRun(agentKey, cfg.workflow, contText, contExtra);
      setRunId(created.run_id);
      setRun(created);
      setContinuationReply('');
      setDeepLinkParent(null);
      setDeepLinkFocusItemId(null);
      if (typeof window !== 'undefined') {
        window.history.replaceState({}, '', window.location.pathname);
      }
      await refresh(created.run_id);
    } catch (e: any) {
      setError(e.message || String(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!runId || (run?.status && terminal.has(run.status))) return;
    const t = setInterval(() => {
      refresh(runId).catch((e: unknown) => {
        setPollError(e instanceof Error ? e.message : String(e));
      });
    }, 1600);
    return () => clearInterval(t);
  }, [runId, run?.status]);

  const latestEvId = useMemo(() => latestEventIdFromList(events), [events]);
  const runNonTerminal = Boolean(run?.status && !terminal.has(run.status));

  return (
    <DashboardShell
      header={
        <SubpageHeader
          badge={hb.label}
          title={cfg.name}
          trailing={laneRow ? <AgentLaneBadge agentKey={agentKey} /> : undefined}
        />
      }
      activeAgent={navAgent}
      rightAside={
        <aside className="rounded-lg border border-app-border bg-app-surface p-2 shadow-xs desktop:min-w-0">
          <div className="text-xs font-semibold text-app-text">Run Events</div>
          <div className="mt-2 max-h-48 space-y-1.5 overflow-auto text-[11px] desktop:max-h-[560px]">
            {events.length ? (
              events.map((ev) => (
                <div
                  key={ev.id}
                  className={`rounded-md border-l-4 ${eventStripeBorderClass(ev.event_type)} bg-app-fill p-2 ${latestEventRowRingClass(ev.id, latestEvId, runNonTerminal)}`}
                >
                  <div className="font-semibold text-app-text">{ev.event_type}</div>
                  <div className="text-app-muted">{ev.message}</div>
                  <div className="text-[10px] text-app-muted">{ev.created_at}</div>
                </div>
              ))
            ) : (
              <div className="text-app-muted">Events appear after a run is queued.</div>
            )}
          </div>
        </aside>
      }
    >
      <section className={`min-w-0 rounded-lg border border-app-border border-l-4 ${c.border} bg-app-surface p-3 shadow-xs`}>
        <div className="flex flex-col gap-density-gap tablet:flex-row tablet:items-start tablet:justify-between tablet:gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-density-gap">
              <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${c.chip}`}>{cfg.workflow}</span>
            </div>
            <p className="mt-1 flex flex-wrap items-center gap-2 font-mono text-[11px] text-rt-ice/70">
              <span>Status</span>
              <StatusPill status={run?.status || 'idle'} variant={statusToVariant(run?.status)} />
            </p>
          </div>
          <button
            onClick={runAgent}
            disabled={
              loading ||
              !canRunPrimary ||
              !projectKey ||
              businessPmOrKittOnPersonal ||
              bubsOnBusiness ||
              logOnlyBlocked ||
              agentCatalogDisabled
            }
            className={`w-full shrink-0 tablet:w-auto ${RT_BTN_PRIMARY} disabled:opacity-40`}
          >
            {loading ? 'Queueing...' : 'Run Agent'}
          </button>
        </div>
        {agentKey === 'clinic' && (
          <div className="mt-2 rounded-md border border-teal-200 bg-teal-50/90 p-2 text-[11px] leading-snug text-teal-950 dark:border-teal-500/30 dark:bg-teal-500/10 dark:text-teal-100">
            <strong>Medical disclaimer:</strong> H.E.L.P.eR organizes text you provide and retrieved project memories. It
            does not diagnose, prescribe, or replace licensed clinicians. For decisions about care or medications, consult
            your health care team.
          </div>
        )}
        {clinicBusinessBanner && (
          <div className="mt-2 rounded-md border border-amber-200 bg-amber-50 p-2 text-[11px] text-amber-950 dark:border-amber-500/35 dark:bg-amber-500/10 dark:text-amber-100">
            Health-related data is sensitive. Consider using a <strong>personal</strong> project for PHI-style material;
            business projects still work, but separation reduces accidental sharing in team contexts.
          </div>
        )}
        {agentCatalogDisabled && (
          <div className="mt-2 rounded-md border border-amber-200 bg-amber-50 p-2 text-[11px] text-amber-950 dark:border-amber-500/35 dark:bg-amber-500/10 dark:text-amber-100">
            This agent is <strong>disabled</strong> in the catalog (<code className="rounded bg-amber-100/80 px-0.5 dark:bg-amber-500/25">agents.ui.disabled</code>). It
            stays in the database but is hidden from the home grid and cannot queue runs until an operator clears that flag.
          </div>
        )}
        {businessPmOrKittOnPersonal && (
          <div className="mt-2 rounded-md border border-rose-200 bg-rose-50 p-2 text-[11px] text-rose-900 dark:border-rose-500/35 dark:bg-rose-500/10 dark:text-rose-100">
            This project is set to <strong>personal</strong>. Use{' '}
            <a
              href="/agents/synergy"
              className="font-semibold text-cyan-700 underline hover:text-cyan-900 dark:text-cyan-400 dark:hover:text-cyan-300"
            >
              Synergy
            </a>{' '}
            or{' '}
            <a
              href="/agents/bubs"
              className="font-semibold text-cyan-700 underline hover:text-cyan-900 dark:text-cyan-400 dark:hover:text-cyan-300"
            >
              Bubs
            </a>{' '}
            instead of PM or KITT.
          </div>
        )}
        {bubsOnBusiness && (
          <div className="mt-2 rounded-md border border-rose-200 bg-rose-50 p-2 text-[11px] text-rose-900 dark:border-rose-500/35 dark:bg-rose-500/10 dark:text-rose-100">
            This project is <strong>business</strong>. Use{' '}
            <a
              href="/agents/pm"
              className="font-semibold text-cyan-700 underline hover:text-cyan-900 dark:text-cyan-400 dark:hover:text-cyan-300"
            >
              PM
            </a>{' '}
            or{' '}
            <a
              href="/agents/kitt"
              className="font-semibold text-cyan-700 underline hover:text-cyan-900 dark:text-cyan-400 dark:hover:text-cyan-300"
            >
              KITT
            </a>{' '}
            instead of Bubs.
          </div>
        )}
        {logOnlyBlocked && (
          <div className="mt-2 rounded-md border border-amber-200 bg-amber-50 p-2 text-[11px] text-amber-950 dark:border-amber-500/35 dark:bg-amber-500/10 dark:text-amber-100">
            <strong>Log-only project:</strong> PM, Synergy, H.E.L.P.eR, and similar breakdown agents are turned off unless
            you enable <strong>Allow structured breakdown</strong> on the{' '}
            <a href="/workspaces" className="font-semibold text-cyan-700 underline hover:text-cyan-900 dark:text-cyan-400">
              Workspaces
            </a>{' '}
            page (current project card). Use <strong>Quick log</strong> on the home page to add memories instead.
          </div>
        )}
        <div className="mt-2">
          <label className="block text-[10px] font-semibold uppercase tracking-wide text-app-muted">Project</label>
          <select
            value={projectKey}
            onChange={(e) => setProjectKey(e.target.value)}
            className="mt-1 w-full rounded-md border border-app-border bg-app-fill p-2 text-xs text-app-text outline-none focus:border-cyan-400 focus:bg-app-surface dark:focus:border-cyan-500"
          >
            {projects.length === 0 && <option value="">No projects — add one on the Workspaces page</option>}
            {projects.map((p: any) => (
              <option key={p.key} value={p.key}>
                {p.name} ({p.key}){p.workspace_key ? ` · ${p.workspace_key}` : ''}
              </option>
            ))}
          </select>
          <p className="mt-1 text-[10px] text-app-muted">
            Memory retrieval and breakdown task/risk rows are scoped to this project.{' '}
            <a href="/workspaces" className="font-semibold text-cyan-600 hover:text-cyan-700 dark:text-cyan-400 dark:hover:text-cyan-300">
              Manage workspaces →
            </a>
          </p>
        </div>
        {(agentKey === 'pm' || agentKey === 'kitt') && !personalProject && (
          <div className="mt-2 rounded-md border border-app-border bg-app-fill/80 p-2 text-[10px] leading-snug text-app-text">
            <div className="font-semibold text-app-muted">Registry on first PM or KITT run</div>
            <p className="mt-0.5 text-app-muted">
              By default only the project profile (and focused question, if any) is sent so your update stays front and
              center. Turn on below if the model should see Workspaces timeline or prior tasks/risks.
            </p>
            <label className="mt-1.5 flex cursor-pointer items-start gap-density-gap">
              <input
                type="checkbox"
                className="mt-0.5"
                checked={includeRegistryTimeline}
                onChange={(e) => setIncludeRegistryTimeline(e.target.checked)}
              />
              <span>Include timeline key dates from uploads (calendar table)</span>
            </label>
            <label className="mt-1 flex cursor-pointer items-start gap-density-gap">
              <input
                type="checkbox"
                className="mt-0.5"
                checked={includeRegistryOpenItems}
                onChange={(e) => setIncludeRegistryOpenItems(e.target.checked)}
              />
              <span>Include open project items (tasks, risks, questions from Workspaces)</span>
            </label>
          </div>
        )}
        {laneRow ? (
          <div className="mt-2 rounded-md border border-app-border bg-app-fill/80 p-2 text-[10px] leading-snug text-app-text">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-semibold text-app-muted">Agent lane</span>
              <AgentLaneBadge agentKey={agentKey} />
            </div>
            <p className="mt-1 text-app-muted">{laneRow.lane_description}</p>
            {laneRow.lane === 'tool_capable' ? (
              <label className="mt-1.5 flex cursor-pointer items-start gap-density-gap">
                <input
                  type="checkbox"
                  className="mt-0.5"
                  checked={useTools}
                  onChange={(e) => setUseTools(e.target.checked)}
                />
                <span>
                  <strong>Use tools</strong> — autonomous tool loop (search, URL read, repo tools) via model-router
                </span>
              </label>
            ) : null}
            <label className="mt-1 flex cursor-pointer items-start gap-density-gap">
              <input
                type="checkbox"
                className="mt-0.5"
                checked={webSearch}
                onChange={(e) => setWebSearch(e.target.checked)}
              />
              <span>
                <strong>Pre-fetch web search</strong>
                {laneRow.default_web_search ? ' (default on for this agent)' : ''} — injects ## Web_search_facts
              </span>
            </label>
            {laneRow.lane === 'tool_capable' ? (
              <label className="mt-1.5 block text-[10px] text-app-text">
                <span className="font-semibold">Memory reranker (this run)</span>
                <select
                  className="mt-1 w-full max-w-md rounded border border-app-border bg-app-surface px-2 py-1 text-[10px] text-app-text"
                  value={rerankerRunChoice}
                  onChange={(e) => setRerankerRunChoice(e.target.value)}
                >
                  {rerankerRunOptions.map((opt) => (
                    <option key={opt.value || 'agent-default'} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
                <span className="mt-0.5 block text-app-muted">
                  Playground default for {agentKey}: {agentRetrievalDefaultLabel(agentRetrievalDefault)}. Agent
                  default omits override; other choices send <code className="font-mono">reranker_override</code>.
                </span>
              </label>
            ) : null}
          </div>
        ) : null}
        {cfg.extras && (
          <input
            className="mt-2 w-full rounded-md border border-app-border bg-app-fill p-2 text-xs text-app-text outline-none focus:border-cyan-400 focus:bg-app-surface dark:focus:border-cyan-500"
            value={repoPath}
            onChange={(e) => setRepoPath(e.target.value)}
            placeholder="Repo path inside /workspace, e.g. . or deploydeliver"
          />
        )}
        {(agentKey === 'pm' || agentKey === 'kitt') && !personalProject && (
          <PmBreakdownSchemaDirections variant="business" />
        )}
        {(agentKey === 'synergy' || agentKey === 'bubs') && <PmBreakdownSchemaDirections variant="personal" />}
        <textarea
          className="mt-2 h-28 w-full rounded-md border border-app-border bg-app-fill p-2 text-xs text-app-text outline-none focus:border-cyan-400 focus:bg-app-surface dark:focus:border-cyan-500"
          placeholder={cfg.starter}
          value={content}
          onChange={(e) => setContent(e.target.value)}
        />
        {/* Scenario Planner moved to /tools. */}
        {deepLinkParent && (
          <div className="mt-2 rounded-md border border-amber-200 bg-amber-50/80 p-2 dark:border-amber-500/35 dark:bg-amber-500/10">
            <div className="text-[10px] font-semibold uppercase tracking-wide text-amber-900 dark:text-amber-100">
              Continue from prior run
            </div>
            <p className="mt-0.5 text-[10px] text-amber-950/90 dark:text-amber-100/90">
              Parent run <span className="font-mono">{deepLinkParent}</span>. Your reply is merged with that run&apos;s output for the next model call.
            </p>
            <textarea
              className="mt-1.5 h-20 w-full rounded-md border border-amber-200/80 bg-app-surface p-2 text-xs text-app-text outline-none focus:border-amber-400 dark:border-amber-500/40 dark:bg-app-elevated"
              placeholder="Answers / clarifications for the prior run…"
              value={continuationReply}
              onChange={(e) => setContinuationReply(e.target.value)}
            />
            <button
              type="button"
              disabled={
                loading ||
                !projectKey ||
                businessPmOrKittOnPersonal ||
                bubsOnBusiness ||
                logOnlyBlocked ||
                agentCatalogDisabled ||
                (!continuationReply.trim() && !effectiveContent)
              }
              onClick={() => queueContinuation(deepLinkParent)}
              className="mt-1.5 w-full rounded-md bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-700 disabled:opacity-40 tablet:w-auto"
            >
              {loading ? 'Queueing…' : 'Queue continuation run'}
            </button>
          </div>
        )}
        {(agentKey === 'pm' ||
          agentKey === 'synergy' ||
          agentKey === 'clinic' ||
          agentKey === 'kitt' ||
          agentKey === 'bubs') &&
          run?.status === 'completed' &&
          Array.isArray(run?.output?.open_questions) &&
          run.output.open_questions.length > 0 &&
          runId && (
            <div className="mt-2 rounded-md border border-sky-200 bg-sky-50/80 p-2 dark:border-sky-500/35 dark:bg-sky-500/10">
              <div className="text-[10px] font-semibold uppercase tracking-wide text-sky-900 dark:text-sky-100">
                Open questions from this run
              </div>
              <ul className="mt-1 list-inside list-disc text-[10px] text-sky-950/90 dark:text-sky-100/90">
                {run.output.open_questions.slice(0, 12).map((q: unknown, i: number) => (
                  <li key={i} className="break-words">
                    {typeof q === 'object' && q !== null && 'question' in (q as object)
                      ? String((q as { question?: string }).question)
                      : String(q)}
                  </li>
                ))}
              </ul>
              <textarea
                className="mt-1.5 h-20 w-full rounded-md border border-sky-200/80 bg-app-surface p-2 text-xs text-app-text outline-none focus:border-sky-400 dark:border-sky-500/40 dark:bg-app-elevated"
                placeholder="Your answers / follow-up (optional extra context in the main request field above)…"
                value={continuationReply}
                onChange={(e) => setContinuationReply(e.target.value)}
              />
              <button
                type="button"
                disabled={
                  loading ||
                  !projectKey ||
                businessPmOrKittOnPersonal ||
                bubsOnBusiness ||
                logOnlyBlocked ||
                agentCatalogDisabled ||
                (!continuationReply.trim() && !effectiveContent)
              }
                onClick={() => queueContinuation(runId)}
                className="mt-1.5 w-full rounded-md bg-sky-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-sky-700 disabled:opacity-40 tablet:w-auto"
              >
                {loading
                  ? 'Queueing…'
                  : agentKey === 'synergy'
                    ? 'Continue as new Synergy run'
                    : agentKey === 'bubs'
                      ? 'Continue as new Bubs run'
                      : agentKey === 'clinic'
                        ? 'Continue as new H.E.L.P.eR run'
                        : agentKey === 'kitt'
                          ? 'Continue as new KITT run'
                          : 'Continue as new PM run'}
              </button>
            </div>
          )}
        {projectsError && (
          <div className="mt-2 rounded-md border border-rose-200 bg-rose-50 p-2 text-xs text-rose-700 dark:border-rose-500/35 dark:bg-rose-500/10 dark:text-rose-100">
            Could not load projects: {projectsError}
          </div>
        )}
        {pollError && (
          <div className="mt-2 rounded-md border border-amber-200 bg-amber-50 p-2 text-xs text-amber-900 dark:border-amber-500/35 dark:bg-amber-500/10 dark:text-amber-100">
            Run poll failed (showing last good data): {pollError}
          </div>
        )}
        {error && (
          <div className="mt-2 rounded-md border border-rose-200 bg-rose-50 p-2 text-xs text-rose-700 dark:border-rose-500/35 dark:bg-rose-500/10 dark:text-rose-100">
            {error}
          </div>
        )}
        {runId && (
          <a
            className="mt-2 inline-block text-[11px] font-semibold text-cyan-600 hover:text-cyan-700 dark:text-cyan-400 dark:hover:text-cyan-300"
            href={`/runs/${runId}`}
          >
            Open run detail →
          </a>
        )}
        <ToolCallsPanel events={events} />
        <div className="mt-2 rounded-md border border-app-border bg-app-fill p-2">
          <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-app-muted">Structured Output</div>
          <StructuredOutput
            run={run}
            pmMode={
              agentKey === 'clinic'
                ? 'clinical'
                : agentKey === 'synergy' || agentKey === 'bubs'
                  ? 'personal'
                  : 'business'
            }
          />
        </div>
      </section>
    </DashboardShell>
  );
}

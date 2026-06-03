'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { getProject, getRunDetail } from '../../../../lib/api';
import { describeRunWallDuration } from '../../../../lib/runDuration';
import { StructuredOutput } from '../../../../components/StructuredOutput';
import { isPersonalPm } from '../../../../lib/pmMode';
import { SubpageHeader } from '../../../../components/SubpageHeader';
import { DashboardShell } from '../../../../components/DashboardShell';
import { OperatorFlow } from '../../../../components/ui/ragtag/OperatorFlow';
import { StatusPill } from '../../../../components/ui/ragtag/StatusPill';
import { outputRailBorderLeftClass } from '../../../../lib/workspaces/chips';
import { statusToVariant } from '../../../../lib/ragtag/statusVariants';
import { RT_BTN_SECONDARY } from '../../../../lib/ragtag/panelClasses';
import {
  eventStripeBorderClass,
  latestEventIdFromList,
  latestEventRowRingClass,
} from '../../../../lib/runEventStripe';
import { AgentLaneBadge } from '../../../../components/agents/AgentLaneBadge';
import { ToolCallsPanel } from '../../../../components/runs/ToolCallsPanel';

const terminal = new Set(['completed', 'degraded', 'failed', 'cancelled', 'needs_approval']);

export default function RunPage({params}:{params:{id:string}}){
  const [run,setRun]=useState<any>(null);
  const [events,setEvents]=useState<any[]>([]);
  const [error,setError]=useState<string|null>(null);
  const [pollError,setPollError]=useState<string|null>(null);
  const [pmModeForRun, setPmModeForRun] = useState<'business' | 'personal' | 'clinical'>('business');
  const [pmModeLoad, setPmModeLoad] = useState<'ok' | 'error'>('ok');
  const [nowTick, setNowTick] = useState(() => Date.now());
  const refresh = useCallback(async () => {
    setPollError(null);
    try {
      const d = await getRunDetail(params.id);
      setRun(d.run);
      setEvents(Array.isArray(d.events) ? d.events : []);
      setError(null);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [params.id]);
  useEffect(() => {
    refresh();
  }, [refresh]);
  useEffect(() => {
    if (run?.status && terminal.has(run.status)) return;
    let cancelled = false;
    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    const pollMs = () =>
      typeof document !== 'undefined' && document.visibilityState === 'hidden' ? 5000 : 2000;
    const schedule = () => {
      timeoutId = setTimeout(async () => {
        if (cancelled) return;
        await refresh().catch((e: unknown) => {
          setPollError(e instanceof Error ? e.message : String(e));
        });
        if (!cancelled) schedule();
      }, pollMs());
    };
    schedule();
    const onVis = () => {
      if (timeoutId) clearTimeout(timeoutId);
      if (!cancelled) schedule();
    };
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', onVis);
    }
    return () => {
      cancelled = true;
      if (timeoutId) clearTimeout(timeoutId);
      if (typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', onVis);
      }
    };
  }, [params.id, run?.status, refresh]);

  useEffect(() => {
    if (!run?.started_at || run?.completed_at) return;
    const id = setInterval(() => setNowTick(Date.now()), 1000);
    return () => clearInterval(id);
  }, [run?.started_at, run?.completed_at]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (run?.agent_key === 'synergy' || run?.agent_key === 'bubs') {
        if (!cancelled) setPmModeForRun('personal');
        if (!cancelled) setPmModeLoad('ok');
        return;
      }
      if (run?.agent_key === 'clinic') {
        if (!cancelled) setPmModeForRun('clinical');
        if (!cancelled) setPmModeLoad('ok');
        return;
      }
      if (run?.agent_key === 'kitt') {
        if (!cancelled) setPmModeForRun('business');
        if (!cancelled) setPmModeLoad('ok');
        return;
      }
      if (run?.agent_key !== 'pm') {
        setPmModeForRun('business');
        setPmModeLoad('ok');
        return;
      }
      let inp = run?.input;
      if (typeof inp === 'string') {
        try {
          inp = JSON.parse(inp);
        } catch {
          inp = null;
        }
      }
      const pk = inp && typeof inp === 'object' ? (inp as { project_key?: string }).project_key : null;
      if (!pk) {
        setPmModeForRun('business');
        setPmModeLoad('ok');
        return;
      }
      try {
        const p = await getProject(String(pk));
        if (!cancelled) {
          setPmModeForRun(isPersonalPm(p) ? 'personal' : 'business');
          setPmModeLoad('ok');
        }
      } catch {
        if (!cancelled) {
          setPmModeForRun('business');
          setPmModeLoad('error');
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [run?.id, run?.agent_key, run?.input]);

  const latestEvId = latestEventIdFromList(events);
  const runNonTerminal = Boolean(run?.status && !terminal.has(run.status));
  const wallDuration = useMemo(() => describeRunWallDuration(run, nowTick), [run, nowTick]);

  return (
    <DashboardShell
      header={
        <>
          <SubpageHeader
            badge="Run"
            title="Detail"
            trailing={
              <span className="flex flex-wrap items-center gap-2">
                {run?.agent_key ? <AgentLaneBadge agentKey={run.agent_key} /> : null}
                <StatusPill status={run?.status || 'loading'} variant={statusToVariant(run?.status)} />
                {wallDuration && (
                  <span className="rounded border border-app-border bg-app-fill px-1.5 py-0.5 text-[10px] text-app-muted">
                    <span className="font-semibold text-app-text">{wallDuration.label}</span>
                    <span className="mx-1 text-app-muted">·</span>
                    {wallDuration.text}
                  </span>
                )}
              </span>
            }
            actions={
              <button
                type="button"
                onClick={refresh}
                className={`w-full shrink-0 tablet:w-auto ${RT_BTN_SECONDARY}`}
              >
                Refresh
              </button>
            }
          />
          <p className="mb-3 break-all text-[10px] text-app-muted">{params.id}</p>
        </>
      }
    >
    {error && (
      <div className="mb-3 rounded-md border border-rose-200 bg-rose-50 p-2 text-xs text-rose-700 dark:border-rose-500/35 dark:bg-rose-500/10 dark:text-rose-100">
        {error}
      </div>
    )}
    {pollError && (
      <div className="mb-3 rounded-md border border-amber-200 bg-amber-50 p-2 text-xs text-amber-900 dark:border-amber-500/35 dark:bg-amber-500/10 dark:text-amber-100">
        Poll failed (showing last good data): {pollError}
      </div>
    )}
    {pmModeLoad === 'error' && run?.agent_key === 'pm' && (
      <div className="mb-3 rounded-md border border-amber-200 bg-amber-50 p-2 text-[11px] text-amber-950 dark:border-amber-500/35 dark:bg-amber-500/10 dark:text-amber-100">
        Could not load project metadata for this run; PM labels default to business mode until the project API succeeds.
      </div>
    )}

    <div className="mb-4 border border-rt-panel bg-rt-charcoal/40 p-3">
      <OperatorFlow runId={params.id} />
    </div>

    <ToolCallsPanel events={events} />

    <div className="grid grid-cols-1 gap-2 desktop:grid-cols-[minmax(0,1fr)_minmax(0,20rem)]">
      <section
        className={`min-w-0 rounded-lg border border-app-border border-l-4 ${outputRailBorderLeftClass(run?.status)} bg-app-surface p-2.5 shadow-xs`}
      >
        <h2 className="text-sm font-semibold text-app-text">Output</h2>
        <div className="mt-2">
          <StructuredOutput run={run} pmMode={pmModeLoad === 'error' ? 'business' : pmModeForRun} />
        </div>
      </section>
      <aside className="rounded-lg border border-app-border bg-app-surface p-2 shadow-xs">
        <h2 className="text-xs font-semibold text-app-text">Events</h2>
        <div className="mt-2 max-h-48 space-y-1.5 overflow-auto text-[11px] desktop:max-h-[760px]">
          {events.map((ev:any)=>(
            <div
              key={ev.id}
              className={`rounded-md border-l-4 ${eventStripeBorderClass(ev.event_type)} bg-app-fill p-2 ${latestEventRowRingClass(ev.id, latestEvId, runNonTerminal)}`}
            >
              <div className="font-semibold text-app-text">{ev.event_type}</div>
              <div className="text-app-muted">{ev.message}</div>
              <div className="mt-0.5 text-[10px] text-app-muted">{ev.created_at}</div>
            </div>
          ))}
        </div>
      </aside>
    </div>
    </DashboardShell>
  );
}

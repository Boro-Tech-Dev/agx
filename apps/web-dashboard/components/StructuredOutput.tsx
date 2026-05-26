import { TaskTable } from './TaskTable';
import { RiskMatrix } from './RiskMatrix';
import { PatchViewer } from './PatchViewer';
import { OpportunityScoreCard } from './OpportunityScoreCard';
import { MemoryCitationPanel } from './MemoryCitationPanel';
import { pmStructuredSectionLabels, pmStructuredSectionLabelsClinical } from '../lib/pmMode';

function chip(label: string, classes: string) {
  return (
    <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${classes}`}>{label}</span>
  );
}

function nonEmptyStrings(xs: unknown): string[] {
  if (!Array.isArray(xs)) return [];
  return xs.filter((x): x is string => typeof x === 'string' && x.trim().length > 0).map((s) => s.trim());
}

/** Omit reserved diagnostics blob from Raw JSON (shown in its own panel). */
function jsonForRawDisplay(out: Record<string, unknown>) {
  const { _router: _ignored, ...rest } = out;
  return JSON.stringify(rest, null, 2);
}

export function StructuredOutput({
  run,
  pmMode,
}: {
  run: any;
  pmMode?: 'business' | 'personal' | 'clinical';
}) {
  const out = run?.output;
  const personal = pmMode === 'personal';
  const L =
    pmMode === 'clinical' ? pmStructuredSectionLabelsClinical() : pmStructuredSectionLabels(personal);
  const errMsg = run?.error_message ? String(run.error_message) : '';
  const isDegraded = String(run?.status || '').toLowerCase() === 'degraded';
  const parseWarn = out && typeof out === 'object' && out.parse_warning ? String(out.parse_warning) : '';
  if (!out)
    return (
      <pre className="max-h-[520px] overflow-auto whitespace-pre-wrap rounded-md bg-app-fill p-2 text-[11px] leading-relaxed text-app-text ring-1 ring-app-border">
        {JSON.stringify(run || { note: 'No run yet.' }, null, 2)}
      </pre>
    );
  const anomalyFallback =
    pmMode === 'clinical' ? 'Notable finding' : personal ? 'Detail' : 'Anomaly';
  return (
    <div className="min-w-0 space-y-2 text-xs">
      {(isDegraded || errMsg || parseWarn) && (
        <div
          className={`rounded-md border p-2 text-[11px] leading-snug ${
            isDegraded || errMsg
              ? 'border-amber-200 bg-amber-50 text-amber-950 dark:border-amber-500/35 dark:bg-amber-500/10 dark:text-amber-100'
              : 'border-sky-200 bg-sky-50 text-sky-950 dark:border-sky-500/35 dark:bg-sky-500/10 dark:text-sky-100'
          }`}
        >
          {isDegraded && (
            <div className="font-semibold text-amber-900 dark:text-amber-100">
              Run status: degraded — the model or router reported an error; output below may be fallback or partial.
            </div>
          )}
          {errMsg ? (
            <div className={isDegraded ? 'mt-1 whitespace-pre-wrap text-amber-900 dark:text-amber-100' : 'font-semibold'}>
              {errMsg}
            </div>
          ) : null}
          {parseWarn ? <div className="mt-1 text-sky-900 dark:text-sky-100">Parse note: {parseWarn}</div> : null}
        </div>
      )}
      {out.summary && (
        <section>
          {chip(L.summary, 'bg-slate-200 text-slate-700 dark:bg-white/15 dark:text-stone-200')}
          <p className="mt-1 text-app-text">{out.summary}</p>
        </section>
      )}
      {typeof out.project_context === 'string' && out.project_context.trim() ? (
        <section>
          {chip(L.projectContext, 'bg-slate-200 text-slate-700 dark:bg-white/15 dark:text-stone-200')}
          <p className="mt-1 whitespace-pre-wrap text-app-text">{out.project_context.trim()}</p>
        </section>
      ) : null}
      {out.answer && (
        <section>
          {chip('Answer', 'bg-indigo-100 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-200')}
          <p className="mt-1 whitespace-pre-wrap text-app-text">{out.answer}</p>
        </section>
      )}
      {out.intent && (
        <section>
          {chip('Intent', 'bg-cyan-100 text-cyan-700 dark:bg-cyan-500/15 dark:text-cyan-200')}
          <p className="mt-1 text-app-text">{out.intent}</p>
        </section>
      )}
      {nonEmptyStrings(out.recommended_next_actions).length > 0 ? (
        <section>
          {chip(
            L.recommendedNextActions,
            'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-200',
          )}
          <ul className="mt-1.5 list-inside list-disc space-y-1 text-app-text">
            {nonEmptyStrings(out.recommended_next_actions).map((line, i) => (
              <li key={i} className="leading-snug">
                {line}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      {nonEmptyStrings(out.assumptions).length > 0 ? (
        <section>
          {chip(L.assumptions, 'bg-amber-100 text-amber-900 dark:bg-amber-500/15 dark:text-amber-200')}
          <ul className="mt-1.5 list-inside list-disc space-y-1 text-app-text">
            {nonEmptyStrings(out.assumptions).map((line, i) => (
              <li key={i} className="leading-snug">
                {line}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      {nonEmptyStrings(out.open_questions).length > 0 ? (
        <section>
          {chip(L.openQuestions, 'bg-sky-100 text-sky-900 dark:bg-sky-500/15 dark:text-sky-200')}
          <ul className="mt-1.5 list-inside list-disc space-y-1 text-app-text">
            {nonEmptyStrings(out.open_questions).map((line, i) => (
              <li key={i} className="leading-snug">
                {line}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      {Array.isArray(out.tasks) && (
        <section>
          {chip(L.tasks, 'bg-cyan-100 text-cyan-700 dark:bg-cyan-500/15 dark:text-cyan-200')}
          <div className="mt-1.5">
            <TaskTable tasks={out.tasks} />
          </div>
        </section>
      )}
      {Array.isArray(out.risks) && (
        <section>
          {chip(L.risks, 'bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-200')}
          <div className="mt-1.5">
            <RiskMatrix risks={out.risks} />
          </div>
        </section>
      )}
      {Array.isArray(out.decisions) && out.decisions.length > 0 ? (
        <section>
          {chip(L.decisions, 'bg-indigo-100 text-indigo-800 dark:bg-indigo-500/15 dark:text-indigo-200')}
          <ul className="mt-1.5 list-inside list-disc space-y-1.5 text-app-text">
            {out.decisions.map((d: any, i: number) => (
              <li key={i} className="leading-snug">
                <span className="font-medium">
                  {typeof d === 'object' && d ? d.title || d.decision || d.name || 'Decision' : String(d)}
                </span>
                {typeof d === 'object' && d && d.status ? (
                  <span className="text-app-muted"> ({String(d.status)})</span>
                ) : null}
                {typeof d === 'object' && d && d.description ? (
                  <span className="text-app-muted"> — {String(d.description)}</span>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      {Array.isArray(out.costs) && out.costs.length > 0 && (
        <section>
          {chip(
            L.costs,
            'bg-orange-100 text-orange-900 dark:bg-orange-500/15 dark:text-orange-200',
          )}
          <ul className="mt-1.5 list-inside list-disc space-y-1 text-app-text">
            {out.costs.map((c: any, i: number) => (
              <li key={i} className="leading-snug">
                <span className="font-medium">
                  {typeof c === 'object' && c ? c.title || c.cost || 'Cost' : String(c)}
                </span>
                {typeof c === 'object' && c && (c.description || c.note) ? (
                  <span className="text-app-muted"> — {String(c.description || c.note)}</span>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      )}
      {Array.isArray(out.anomalies) && out.anomalies.length > 0 && (
        <section>
          {chip(L.anomalies, 'bg-lime-100 text-lime-900 dark:bg-lime-500/15 dark:text-lime-200')}
          <ul className="mt-1.5 list-inside list-disc space-y-1 text-app-text">
            {out.anomalies.map((a: any, i: number) => (
              <li key={i} className="leading-snug">
                <span className="font-medium">
                  {typeof a === 'object' && a ? a.title || a.anomaly || anomalyFallback : String(a)}
                </span>
                {typeof a === 'object' && a && (a.note || a.description) ? (
                  <span className="text-app-muted"> — {String(a.note || a.description)}</span>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      )}
      {Array.isArray(out.reflections) && out.reflections.length > 0 && (
        <section>
          {chip(L.reflections, 'bg-violet-100 text-violet-900 dark:bg-violet-500/15 dark:text-violet-200')}
          <ul className="mt-1.5 list-inside list-disc space-y-1 text-app-text">
            {out.reflections.map((r: unknown, i: number) => (
              <li key={i}>{typeof r === 'string' ? r : JSON.stringify(r)}</li>
            ))}
          </ul>
        </section>
      )}
      {Array.isArray(out.patches) && (
        <section>
          {chip('Patch Preview', 'bg-indigo-100 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-200')}
          <div className="mt-1.5">
            <PatchViewer patches={out.patches} />
          </div>
        </section>
      )}
      {Array.isArray(out.opportunities) && (
        <section>
          {chip('Opportunities', 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-200')}
          <div className="mt-1.5 grid gap-1.5">
            {out.opportunities.map((o: any, i: number) => (
              <OpportunityScoreCard key={i} opportunity={o} />
            ))}
          </div>
        </section>
      )}
      {Array.isArray(out.supporting_memories) && (
        <section>
          {chip('Supporting Memory', 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-200')}
          <div className="mt-1.5">
            <MemoryCitationPanel memories={out.supporting_memories} />
          </div>
        </section>
      )}
      {out._router && typeof out._router === 'object' && out._router !== null ? (
        <details className="rounded-md border border-app-border bg-app-fill p-2">
          <summary className="cursor-pointer text-[11px] font-medium text-app-muted">
            Model / router diagnostics
          </summary>
          <dl className="mt-2 grid gap-1 text-[11px] text-app-text">
            {(
              [
                ['model_used', (out._router as Record<string, unknown>).model_used],
                ['parse_failed', (out._router as Record<string, unknown>).parse_failed],
                ['fallback_used', (out._router as Record<string, unknown>).fallback_used],
                ['loose_unparsed', (out._router as Record<string, unknown>).loose_unparsed],
                ['raw_content_truncated', (out._router as Record<string, unknown>).raw_content_truncated],
                ['raw_content_char_len', (out._router as Record<string, unknown>).raw_content_char_len],
                ['raw_content_sha256', (out._router as Record<string, unknown>).raw_content_sha256],
                ['grammar_failure_fallback_used', (out._router as Record<string, unknown>).grammar_failure_fallback_used],
                ['schema_fallback_used', (out._router as Record<string, unknown>).schema_fallback_used],
              ] as [string, unknown][]
            ).map(([k, v]) => (
              <div key={k} className="flex flex-wrap gap-x-2 border-b border-app-border/40 pb-1 last:border-0">
                <dt className="font-medium text-app-muted">{k}</dt>
                <dd className="min-w-0 break-all font-mono text-[10px]">
                  {v === '' || v === undefined ? '—' : String(v)}
                </dd>
              </div>
            ))}
          </dl>
          {(out._router as Record<string, unknown>).router_warning ? (
            <div className="mt-2 rounded-md border border-amber-500/30 bg-amber-500/10 p-2 text-[11px] text-amber-950 dark:text-amber-100">
              <span className="font-semibold">Router warning: </span>
              <span className="whitespace-pre-wrap">{(out._router as Record<string, unknown>).router_warning as string}</span>
            </div>
          ) : null}
          {(out._router as Record<string, unknown>).error != null && String((out._router as Record<string, unknown>).error).length > 0 ? (
            <div className="mt-2 rounded-md border border-rose-500/30 bg-rose-500/10 p-2 text-[11px] text-rose-950 dark:text-rose-100">
              <span className="font-semibold">Router error (copy): </span>
              <span className="whitespace-pre-wrap">{String((out._router as Record<string, unknown>).error)}</span>
            </div>
          ) : null}
          {(out._router as Record<string, unknown>).raw_content_preview ? (
            <pre className="mt-2 max-h-[360px] overflow-auto whitespace-pre-wrap rounded-md bg-app-surface p-2 font-mono text-[10px] leading-relaxed text-app-text ring-1 ring-app-border">
              {String((out._router as Record<string, unknown>).raw_content_preview)}
            </pre>
          ) : (
            <p className="mt-2 text-[11px] text-app-muted">No raw content preview on this run.</p>
          )}
        </details>
      ) : null}
      <details className="rounded-md border border-app-border bg-app-fill p-2">
        <summary className="cursor-pointer text-[11px] font-medium text-app-muted">Raw JSON</summary>
        <pre className="mt-2 max-h-[420px] overflow-auto whitespace-pre-wrap text-[11px] text-app-muted">
          {jsonForRawDisplay(out as Record<string, unknown>)}
        </pre>
      </details>
    </div>
  );
}

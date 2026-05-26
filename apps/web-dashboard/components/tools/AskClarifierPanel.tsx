'use client';

import { useEffect, useMemo, useState } from 'react';

import { apiUrlForFetch, postAskClarifier } from '../../lib/api';
import { ASK_CLARIFIER_EXAMPLES } from '../../lib/askClarifier/examples';
import { renderAskClarifierMarkdown } from '../../lib/askClarifier/renderMarkdown';
import { useLearningMissionParams } from '../../lib/learning/useLearningMissionParams';
import { LEARNING_EXAMPLE_INDEX_BY_STEP } from '../../lib/learning/learningExamples';
import { validateLearningAfterSave } from '../../lib/learning/validateAfterToolSave';
import { saveToolOutputAsMemory } from '../../lib/tools/saveToolOutputAsMemory';
import { useToolsProject } from '../../lib/tools/toolsProjectContext';
import type {
  AskClarifierMode,
  AskClarifierResult,
  AskClarifierTone,
  ClarifierQuestion,
} from '../../lib/askClarifier/types';

type Props = {
  projectKey: string;
};

const MODES: { value: AskClarifierMode; label: string; hint: string }[] = [
  { value: 'intake', label: 'Intake', hint: 'New ask before assignment' },
  { value: 'feedback', label: 'Feedback', hint: 'Messy client/internal comments' },
  { value: 'timeline', label: 'Timeline', hint: 'Date or rush ask' },
  { value: 'scope', label: 'Scope', hint: 'Potential free work/change request' },
  { value: 'handoff', label: 'Handoff', hint: 'Prepare team assignment' },
];

const TONES: { value: AskClarifierTone; label: string }[] = [
  { value: 'diplomatic', label: 'Diplomatic' },
  { value: 'client_ready', label: 'Client-ready' },
  { value: 'internal', label: 'Internal/direct' },
  { value: 'direct', label: 'Very direct' },
];

function readinessLabel(value: AskClarifierResult['overall_readiness']) {
  switch (value) {
    case 'ready_to_assign':
      return 'Ready to assign';
    case 'high_risk':
      return 'High risk';
    default:
      return 'Needs clarification';
  }
}

function readinessClass(value: AskClarifierResult['overall_readiness']) {
  switch (value) {
    case 'ready_to_assign':
      return 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200';
    case 'high_risk':
      return 'border-rose-500/30 bg-rose-500/10 text-rose-200';
    default:
      return 'border-amber-500/30 bg-amber-500/10 text-amber-100';
  }
}

function priorityClass(value: ClarifierQuestion['priority']) {
  switch (value) {
    case 'critical':
      return 'bg-rose-500/15 text-rose-200 border-rose-500/30';
    case 'important':
      return 'bg-amber-500/15 text-amber-100 border-amber-500/30';
    default:
      return 'bg-app-fill text-app-muted border-app-border';
  }
}

function copyText(value: string) {
  void navigator.clipboard?.writeText(value);
}

export function AskClarifierPanel({ projectKey }: Props) {
  const mission = useLearningMissionParams();
  const { workspaceKey } = useToolsProject();
  const [requestText, setRequestText] = useState('');
  const [projectContext, setProjectContext] = useState('');
  const [knownScope, setKnownScope] = useState('');
  const [knownTimeline, setKnownTimeline] = useState('');
  const [mode, setMode] = useState<AskClarifierMode>('intake');
  const [tone, setTone] = useState<AskClarifierTone>('diplomatic');
  const [result, setResult] = useState<AskClarifierResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const canRun = requestText.trim().length > 0 && !busy;
  const markdown = useMemo(() => (result ? renderAskClarifierMarkdown(result) : ''), [result]);

  async function run() {
    if (!canRun) return;
    setBusy(true);
    setError(null);
    setStatus(null);
    try {
      const res = (await postAskClarifier({
        request_text: requestText,
        mode,
        tone,
        project_context: projectContext || undefined,
        known_scope: knownScope || undefined,
        known_timeline: knownTimeline || undefined,
      })) as AskClarifierResult;
      setResult(res);
      setStatus(res.model_used ? `Analyzed with ${res.model_used}.` : 'Analysis complete.');
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function saveMarkdown() {
    if (!result) return;
    setSaving(true);
    setError(null);
    setStatus(null);
    try {
      const stamp = new Date().toISOString().replace(/[:.]/g, '-');
      await saveToolOutputAsMemory({
        projectKey,
        workspaceKey: workspaceKey || undefined,
        title: `Ask Clarifier (${stamp})`,
        body: markdown,
        sourceTool: 'ask_clarifier',
        learningEnrollmentId: mission.enrollmentId ?? undefined,
        learningStepId: mission.stepId ?? undefined,
      });
      const validated = await validateLearningAfterSave(mission.enrollmentId, mission.stepId);
      setStatus(validated ?? 'Saved to project memory. View on Memory.');
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }

  function loadExample(index: number) {
    const ex = ASK_CLARIFIER_EXAMPLES[index];
    if (!ex) return;
    setMode(ex.mode);
    setTone('diplomatic');
    setRequestText(ex.text);
    setProjectContext(ex.projectContext || '');
    setKnownScope(ex.knownScope || '');
    setKnownTimeline(ex.knownTimeline || '');
    setResult(null);
    setStatus(`Loaded example: ${ex.label}`);
    setError(null);
  }

  useEffect(() => {
    if (!mission.stepId) return;
    const idx =
      mission.exampleIndex ??
      LEARNING_EXAMPLE_INDEX_BY_STEP[mission.stepId] ??
      null;
    if (idx != null && !Number.isNaN(idx)) loadExample(idx);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- load once per mission step
  }, [mission.stepId, mission.exampleIndex]);

  return (
    <div className="grid gap-3 lg:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)]">
      <section className="space-y-3 rounded-xl border border-app-border bg-app-surface p-3 shadow-sm">
        <div>
          <h2 className="text-[13px] font-semibold text-app-text">Ask Clarifier</h2>
          <p className="mt-1 text-[11px] leading-relaxed text-app-muted">
            Paste the vague client ask, meeting note, or internal request. RagTag turns it into the exact questions a PM or Account lead should ask before the team starts work.
          </p>
        </div>

        <div className="grid gap-2 sm:grid-cols-2">
          <label className="space-y-1 text-[10px] font-medium uppercase tracking-wide text-app-muted">
            Mode
            <select
              value={mode}
              onChange={(e) => setMode(e.target.value as AskClarifierMode)}
              className="w-full rounded-lg border border-app-border bg-app-fill px-2 py-1.5 text-[11px] normal-case tracking-normal text-app-text outline-none focus:border-nav-active-border"
            >
              {MODES.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label} — {m.hint}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-1 text-[10px] font-medium uppercase tracking-wide text-app-muted">
            Reply tone
            <select
              value={tone}
              onChange={(e) => setTone(e.target.value as AskClarifierTone)}
              className="w-full rounded-lg border border-app-border bg-app-fill px-2 py-1.5 text-[11px] normal-case tracking-normal text-app-text outline-none focus:border-nav-active-border"
            >
              {TONES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        <label className="block space-y-1 text-[10px] font-medium uppercase tracking-wide text-app-muted">
          Request to clarify
          <textarea
            value={requestText}
            onChange={(e) => setRequestText(e.target.value)}
            rows={7}
            placeholder="Example: Can we get a few homepage concepts for the new campaign? Would be great to see options by next week."
            className="w-full resize-y rounded-lg border border-app-border bg-app-fill px-2 py-2 text-[11px] normal-case leading-relaxed tracking-normal text-app-text outline-none focus:border-nav-active-border"
          />
        </label>

        <div className="grid gap-2">
          <label className="block space-y-1 text-[10px] font-medium uppercase tracking-wide text-app-muted">
            Project context <span className="font-normal normal-case tracking-normal text-app-muted/80">optional</span>
            <textarea
              value={projectContext}
              onChange={(e) => setProjectContext(e.target.value)}
              rows={3}
              placeholder="Client, channel, active workstream, known stakeholder context…"
              className="w-full resize-y rounded-lg border border-app-border bg-app-fill px-2 py-2 text-[11px] normal-case leading-relaxed tracking-normal text-app-text outline-none focus:border-nav-active-border"
            />
          </label>
          <label className="block space-y-1 text-[10px] font-medium uppercase tracking-wide text-app-muted">
            Known scope <span className="font-normal normal-case tracking-normal text-app-muted/80">optional</span>
            <textarea
              value={knownScope}
              onChange={(e) => setKnownScope(e.target.value)}
              rows={3}
              placeholder="Scoped deliverables, rounds, excluded work, SOW notes…"
              className="w-full resize-y rounded-lg border border-app-border bg-app-fill px-2 py-2 text-[11px] normal-case leading-relaxed tracking-normal text-app-text outline-none focus:border-nav-active-border"
            />
          </label>
          <label className="block space-y-1 text-[10px] font-medium uppercase tracking-wide text-app-muted">
            Known timeline <span className="font-normal normal-case tracking-normal text-app-muted/80">optional</span>
            <textarea
              value={knownTimeline}
              onChange={(e) => setKnownTimeline(e.target.value)}
              rows={2}
              placeholder="Due date, review date, launch date, dependency, holiday, blocker…"
              className="w-full resize-y rounded-lg border border-app-border bg-app-fill px-2 py-2 text-[11px] normal-case leading-relaxed tracking-normal text-app-text outline-none focus:border-nav-active-border"
            />
          </label>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={run}
            disabled={!canRun}
            className="rounded-lg border border-nav-active-border bg-nav-active-bg px-3 py-1.5 text-[11px] font-semibold text-nav-active-fg disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy ? 'Clarifying…' : 'Generate questions'}
          </button>
          <button
            type="button"
            onClick={() => loadExample(0)}
            className="rounded-lg border border-app-border bg-app-fill px-2 py-1.5 text-[11px] text-app-muted hover:bg-app-fill-hover hover:text-app-text"
          >
            Load homepage example
          </button>
          <button
            type="button"
            onClick={() => loadExample(1)}
            className="rounded-lg border border-app-border bg-app-fill px-2 py-1.5 text-[11px] text-app-muted hover:bg-app-fill-hover hover:text-app-text"
          >
            Load scope example
          </button>
        </div>

        <p className="text-[10px] leading-relaxed text-app-muted">
          API: <code className="rounded bg-app-fill px-1 py-0.5">POST {apiUrlForFetch('/api/ask-clarifier/analyze')}</code>. Results can be saved to project documents as Markdown.
        </p>
        {status ? <p className="rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-2 py-1 text-[11px] text-emerald-100">{status}</p> : null}
        {error ? <p className="rounded-lg border border-rose-500/20 bg-rose-500/10 px-2 py-1 text-[11px] text-rose-100">{error}</p> : null}
      </section>

      <section className="min-h-[620px] rounded-xl border border-app-border bg-app-surface p-3 shadow-sm">
        {result ? (
          <div className="space-y-3">
            <div className="flex flex-wrap items-start justify-between gap-2 border-b border-app-border pb-2">
              <div>
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className={`rounded-md border px-1.5 py-0.5 text-[10px] font-semibold ${readinessClass(result.overall_readiness)}`}>
                    {readinessLabel(result.overall_readiness)}
                  </span>
                  <span className="rounded-md border border-app-border bg-app-fill px-1.5 py-0.5 text-[10px] font-medium text-app-muted">
                    Clarity {result.clarity_score}/100
                  </span>
                  <span className="rounded-md border border-app-border bg-app-fill px-1.5 py-0.5 text-[10px] font-medium text-app-muted">
                    {result.request_type}
                  </span>
                </div>
                <p className="mt-2 max-w-2xl text-[11px] leading-relaxed text-app-muted">{result.summary}</p>
              </div>
              <div className="flex flex-wrap gap-1">
                <button
                  type="button"
                  onClick={() => copyText(result.suggested_reply)}
                  className="rounded-md border border-app-border bg-app-fill px-2 py-1 text-[10px] font-medium text-app-muted hover:bg-app-fill-hover hover:text-app-text"
                >
                  Copy reply
                </button>
                <button
                  type="button"
                  onClick={() => copyText(markdown)}
                  className="rounded-md border border-app-border bg-app-fill px-2 py-1 text-[10px] font-medium text-app-muted hover:bg-app-fill-hover hover:text-app-text"
                >
                  Copy Markdown
                </button>
                <button
                  type="button"
                  onClick={saveMarkdown}
                  disabled={saving}
                  className="rounded-md border border-app-border bg-app-fill px-2 py-1 text-[10px] font-medium text-app-muted hover:bg-app-fill-hover hover:text-app-text disabled:opacity-50"
                >
                  {saving ? 'Saving…' : 'Save'}
                </button>
              </div>
            </div>

            <div className="grid gap-2 md:grid-cols-2">
              <div className="rounded-lg border border-app-border bg-app-fill/40 p-2">
                <h3 className="text-[11px] font-semibold text-app-text">Recommended next step</h3>
                <p className="mt-1 text-[11px] leading-relaxed text-app-muted">{result.recommended_next_step}</p>
              </div>
              <div className="rounded-lg border border-app-border bg-app-fill/40 p-2">
                <h3 className="text-[11px] font-semibold text-app-text">Internal handoff note</h3>
                <p className="mt-1 text-[11px] leading-relaxed text-app-muted">{result.internal_handoff_note}</p>
              </div>
            </div>

            <div className="rounded-lg border border-app-border bg-app-fill/40 p-2">
              <div className="mb-2 flex items-center justify-between gap-2">
                <h3 className="text-[11px] font-semibold text-app-text">Clarifying questions</h3>
                <span className="text-[10px] text-app-muted">{result.clarifying_questions.length} questions</span>
              </div>
              <div className="space-y-2">
                {result.clarifying_questions.map((q, idx) => (
                  <article key={`${q.question}-${idx}`} className="rounded-lg border border-app-border bg-app-surface p-2">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="rounded bg-app-fill px-1.5 py-0.5 text-[9px] font-semibold text-app-muted">#{idx + 1}</span>
                      <span className={`rounded border px-1.5 py-0.5 text-[9px] font-semibold ${priorityClass(q.priority)}`}>{q.priority}</span>
                      <span className="rounded bg-app-fill px-1.5 py-0.5 text-[9px] font-medium text-app-muted">{q.category}</span>
                      {q.suggested_owner ? <span className="rounded bg-app-fill px-1.5 py-0.5 text-[9px] font-medium text-app-muted">Owner: {q.suggested_owner}</span> : null}
                    </div>
                    <p className="mt-1 text-[12px] font-semibold leading-snug text-app-text">{q.question}</p>
                    <p className="mt-1 text-[10px] leading-relaxed text-app-muted"><span className="font-medium text-app-text">Why:</span> {q.why_it_matters}</p>
                    <p className="mt-1 text-[10px] leading-relaxed text-app-muted"><span className="font-medium text-app-text">Risk:</span> {q.risk_if_unanswered}</p>
                  </article>
                ))}
                {result.clarifying_questions.length === 0 ? <p className="text-[11px] text-app-muted">No clarifying questions returned.</p> : null}
              </div>
            </div>

            <div className="grid gap-2 md:grid-cols-2">
              <div className="rounded-lg border border-app-border bg-app-fill/40 p-2">
                <h3 className="text-[11px] font-semibold text-app-text">Assumptions to validate</h3>
                <ul className="mt-1 space-y-1 text-[10px] leading-relaxed text-app-muted">
                  {result.assumptions_to_validate.map((a, i) => (
                    <li key={`${a.assumption}-${i}`}>• <span className="font-medium text-app-text">{a.assumption}</span> <span className="text-app-muted/80">({a.confidence})</span>{a.confirm_with ? ` — ${a.confirm_with}` : ''}</li>
                  ))}
                  {result.assumptions_to_validate.length === 0 ? <li>None.</li> : null}
                </ul>
              </div>
              <div className="rounded-lg border border-app-border bg-app-fill/40 p-2">
                <h3 className="text-[11px] font-semibold text-app-text">Risks</h3>
                <ul className="mt-1 space-y-1 text-[10px] leading-relaxed text-app-muted">
                  {result.risks.map((r, i) => (
                    <li key={`${r.risk}-${i}`}>• <span className="font-medium text-app-text">{r.severity.toUpperCase()}:</span> {r.risk} <span className="text-app-muted/80">Mitigation: {r.mitigation}</span></li>
                  ))}
                  {result.risks.length === 0 ? <li>None.</li> : null}
                </ul>
              </div>
            </div>

            <div className="rounded-lg border border-app-border bg-app-fill/40 p-2">
              <div className="mb-1 flex items-center justify-between gap-2">
                <h3 className="text-[11px] font-semibold text-app-text">Suggested reply</h3>
                <button type="button" onClick={() => copyText(result.suggested_reply)} className="text-[10px] font-medium text-app-muted hover:text-app-text">Copy</button>
              </div>
              <p className="whitespace-pre-wrap rounded-md border border-app-border bg-app-surface p-2 text-[11px] leading-relaxed text-app-muted">
                {result.suggested_reply || 'No suggested reply generated.'}
              </p>
            </div>
          </div>
        ) : (
          <div className="flex h-full min-h-[560px] items-center justify-center rounded-lg border border-dashed border-app-border bg-app-fill/30 p-8 text-center">
            <div className="max-w-md">
              <p className="text-[13px] font-semibold text-app-text">Paste an ask. Get the questions before the work starts.</p>
              <p className="mt-2 text-[11px] leading-relaxed text-app-muted">
                This tool is built for the moment before a request becomes a task. It catches missing deliverables, scope assumptions, timeline traps, owner ambiguity, and approval gaps.
              </p>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}

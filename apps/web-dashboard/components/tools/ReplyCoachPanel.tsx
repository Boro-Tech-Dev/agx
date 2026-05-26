'use client';

import { useEffect, useMemo, useState } from 'react';

import { apiUrlForFetch, postReplyCoach } from '../../lib/api';
import { LEARNING_EXAMPLE_INDEX_BY_STEP } from '../../lib/learning/learningExamples';
import { useLearningMissionParams } from '../../lib/learning/useLearningMissionParams';
import { validateLearningAfterSave } from '../../lib/learning/validateAfterToolSave';
import { REPLY_COACH_EXAMPLES } from '../../lib/replyCoach/examples';
import { renderReplyCoachMarkdown } from '../../lib/replyCoach/renderMarkdown';
import { saveToolOutputAsMemory } from '../../lib/tools/saveToolOutputAsMemory';
import { useToolsProject } from '../../lib/tools/toolsProjectContext';
import type {
  ReplyCoachAudience,
  ReplyCoachResult,
  ReplyCoachRiskLevel,
  ReplyCoachSituation,
  ReplyCoachTone,
} from '../../lib/replyCoach/types';

type Props = {
  projectKey: string;
};

const SITUATIONS: { value: ReplyCoachSituation; label: string }[] = [
  { value: 'general', label: 'General response' },
  { value: 'client_pushback', label: 'Client pushback' },
  { value: 'scope_pressure', label: 'Scope pressure' },
  { value: 'timeline_pressure', label: 'Timeline pressure' },
  { value: 'feedback_response', label: 'Feedback response' },
  { value: 'internal_alignment', label: 'Internal alignment' },
];

const TONES: { value: ReplyCoachTone; label: string }[] = [
  { value: 'diplomatic', label: 'Diplomatic' },
  { value: 'firm', label: 'Firm / scope-safe' },
  { value: 'warm', label: 'Warm' },
  { value: 'executive', label: 'Executive' },
  { value: 'internal_direct', label: 'Internal/direct' },
];

const AUDIENCES: { value: ReplyCoachAudience; label: string }[] = [
  { value: 'client', label: 'Client' },
  { value: 'internal', label: 'Internal team' },
  { value: 'vendor', label: 'Vendor' },
  { value: 'mixed', label: 'Mixed' },
];

function riskClass(value: ReplyCoachRiskLevel) {
  switch (value) {
    case 'high':
      return 'border-rose-500/30 bg-rose-500/10 text-rose-200';
    case 'medium':
      return 'border-amber-500/30 bg-amber-500/10 text-amber-100';
    default:
      return 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200';
  }
}

function copyText(value: string) {
  void navigator.clipboard?.writeText(value);
}

function ListCard({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="rounded-lg border border-app-border bg-app-fill/40 p-2">
      <h3 className="text-[11px] font-semibold text-app-text">{title}</h3>
      <ul className="mt-1 space-y-1 text-[10px] leading-relaxed text-app-muted">
        {items.map((item, idx) => (
          <li key={`${title}-${idx}`}>• {item}</li>
        ))}
        {items.length === 0 ? <li>None.</li> : null}
      </ul>
    </div>
  );
}

export function ReplyCoachPanel({ projectKey }: Props) {
  const mission = useLearningMissionParams();
  const { workspaceKey } = useToolsProject();
  const [messageText, setMessageText] = useState('');
  const [goal, setGoal] = useState('');
  const [projectContext, setProjectContext] = useState('');
  const [constraints, setConstraints] = useState('');
  const [situation, setSituation] = useState<ReplyCoachSituation>('general');
  const [tone, setTone] = useState<ReplyCoachTone>('diplomatic');
  const [audience, setAudience] = useState<ReplyCoachAudience>('client');
  const [result, setResult] = useState<ReplyCoachResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const canRun = messageText.trim().length > 0 && !busy;
  const markdown = useMemo(() => (result ? renderReplyCoachMarkdown(result) : ''), [result]);

  async function run() {
    if (!canRun) return;
    setBusy(true);
    setError(null);
    setStatus(null);
    try {
      const res = (await postReplyCoach({
        message_text: messageText,
        situation,
        tone,
        audience,
        goal: goal || undefined,
        project_context: projectContext || undefined,
        constraints: constraints || undefined,
      })) as ReplyCoachResult;
      setResult(res);
      setStatus(res.model_used ? `Drafted with ${res.model_used}.` : 'Reply coaching complete.');
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
        title: `Reply Coach (${stamp})`,
        body: markdown,
        sourceTool: 'reply_coach',
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
    const ex = REPLY_COACH_EXAMPLES[index];
    if (!ex) return;
    setSituation(ex.situation);
    setTone(ex.tone);
    setAudience(ex.audience);
    setMessageText(ex.text);
    setGoal(ex.goal || '');
    setProjectContext(ex.projectContext || '');
    setConstraints(ex.constraints || '');
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
          <h2 className="text-[13px] font-semibold text-app-text">Reply Coach</h2>
          <p className="mt-1 text-[11px] leading-relaxed text-app-muted">
            Paste a tricky client, internal, or vendor message. Bubs helps you answer clearly without overcommitting the team, accepting hidden scope, or sounding defensive.
          </p>
        </div>

        <div className="grid gap-2 sm:grid-cols-3">
          <label className="space-y-1 text-[10px] font-medium uppercase tracking-wide text-app-muted">
            Situation
            <select value={situation} onChange={(e) => setSituation(e.target.value as ReplyCoachSituation)} className="w-full rounded-lg border border-app-border bg-app-fill px-2 py-1.5 text-[11px] normal-case tracking-normal text-app-text outline-none focus:border-nav-active-border">
              {SITUATIONS.map((x) => <option key={x.value} value={x.value}>{x.label}</option>)}
            </select>
          </label>
          <label className="space-y-1 text-[10px] font-medium uppercase tracking-wide text-app-muted">
            Tone
            <select value={tone} onChange={(e) => setTone(e.target.value as ReplyCoachTone)} className="w-full rounded-lg border border-app-border bg-app-fill px-2 py-1.5 text-[11px] normal-case tracking-normal text-app-text outline-none focus:border-nav-active-border">
              {TONES.map((x) => <option key={x.value} value={x.value}>{x.label}</option>)}
            </select>
          </label>
          <label className="space-y-1 text-[10px] font-medium uppercase tracking-wide text-app-muted">
            Audience
            <select value={audience} onChange={(e) => setAudience(e.target.value as ReplyCoachAudience)} className="w-full rounded-lg border border-app-border bg-app-fill px-2 py-1.5 text-[11px] normal-case tracking-normal text-app-text outline-none focus:border-nav-active-border">
              {AUDIENCES.map((x) => <option key={x.value} value={x.value}>{x.label}</option>)}
            </select>
          </label>
        </div>

        <label className="block space-y-1 text-[10px] font-medium uppercase tracking-wide text-app-muted">
          Message to answer
          <textarea value={messageText} onChange={(e) => setMessageText(e.target.value)} rows={7} placeholder="Example: Can you turn this around by tomorrow? It should just be a quick update." className="w-full resize-y rounded-lg border border-app-border bg-app-fill px-2 py-2 text-[11px] normal-case leading-relaxed tracking-normal text-app-text outline-none focus:border-nav-active-border" />
        </label>

        <label className="block space-y-1 text-[10px] font-medium uppercase tracking-wide text-app-muted">
          Goal of the reply <span className="font-normal normal-case tracking-normal text-app-muted/80">optional</span>
          <textarea value={goal} onChange={(e) => setGoal(e.target.value)} rows={2} placeholder="What do you need this reply to accomplish?" className="w-full resize-y rounded-lg border border-app-border bg-app-fill px-2 py-2 text-[11px] normal-case leading-relaxed tracking-normal text-app-text outline-none focus:border-nav-active-border" />
        </label>

        <div className="grid gap-2">
          <label className="block space-y-1 text-[10px] font-medium uppercase tracking-wide text-app-muted">
            Project/account context <span className="font-normal normal-case tracking-normal text-app-muted/80">optional</span>
            <textarea value={projectContext} onChange={(e) => setProjectContext(e.target.value)} rows={3} placeholder="Client politics, active workstream, who needs alignment, project status…" className="w-full resize-y rounded-lg border border-app-border bg-app-fill px-2 py-2 text-[11px] normal-case leading-relaxed tracking-normal text-app-text outline-none focus:border-nav-active-border" />
          </label>
          <label className="block space-y-1 text-[10px] font-medium uppercase tracking-wide text-app-muted">
            Constraints / watchouts <span className="font-normal normal-case tracking-normal text-app-muted/80">optional</span>
            <textarea value={constraints} onChange={(e) => setConstraints(e.target.value)} rows={3} placeholder="Scope boundaries, timing risks, review rules, approvals, what not to promise…" className="w-full resize-y rounded-lg border border-app-border bg-app-fill px-2 py-2 text-[11px] normal-case leading-relaxed tracking-normal text-app-text outline-none focus:border-nav-active-border" />
          </label>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={run} disabled={!canRun} className="rounded-lg border border-nav-active-border bg-nav-active-bg px-3 py-1.5 text-[11px] font-semibold text-nav-active-fg disabled:cursor-not-allowed disabled:opacity-50">
            {busy ? 'Coaching…' : 'Draft response'}
          </button>
          <button type="button" onClick={() => loadExample(0)} className="rounded-lg border border-app-border bg-app-fill px-2 py-1.5 text-[11px] text-app-muted hover:bg-app-fill-hover hover:text-app-text">Load rush example</button>
          <button type="button" onClick={() => loadExample(1)} className="rounded-lg border border-app-border bg-app-fill px-2 py-1.5 text-[11px] text-app-muted hover:bg-app-fill-hover hover:text-app-text">Load scope example</button>
        </div>

        <p className="text-[10px] leading-relaxed text-app-muted">
          API: <code className="rounded bg-app-fill px-1 py-0.5">POST {apiUrlForFetch('/api/reply-coach/draft')}</code>. Routes through Bubs with <code className="rounded bg-app-fill px-1 py-0.5">tinyllama:1.1b</code>.
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
                  <span className={`rounded-md border px-1.5 py-0.5 text-[10px] font-semibold ${riskClass(result.risk_level)}`}>Risk: {result.risk_level}</span>
                  <span className="rounded-md border border-app-border bg-app-fill px-1.5 py-0.5 text-[10px] font-medium text-app-muted">Bubs / tinyllama</span>
                </div>
                <p className="mt-2 max-w-2xl text-[11px] leading-relaxed text-app-muted">{result.situation_summary}</p>
              </div>
              <div className="flex flex-wrap gap-1">
                <button type="button" onClick={() => copyText(result.suggested_reply)} className="rounded-md border border-app-border bg-app-fill px-2 py-1 text-[10px] font-medium text-app-muted hover:bg-app-fill-hover hover:text-app-text">Copy reply</button>
                <button type="button" onClick={() => copyText(markdown)} className="rounded-md border border-app-border bg-app-fill px-2 py-1 text-[10px] font-medium text-app-muted hover:bg-app-fill-hover hover:text-app-text">Copy Markdown</button>
                <button type="button" onClick={saveMarkdown} disabled={saving} className="rounded-md border border-app-border bg-app-fill px-2 py-1 text-[10px] font-medium text-app-muted hover:bg-app-fill-hover hover:text-app-text disabled:opacity-50">{saving ? 'Saving…' : 'Save'}</button>
              </div>
            </div>

            <div className="grid gap-2 md:grid-cols-2">
              <div className="rounded-lg border border-app-border bg-app-fill/40 p-2">
                <h3 className="text-[11px] font-semibold text-app-text">Recommended posture</h3>
                <p className="mt-1 text-[11px] leading-relaxed text-app-muted">{result.recommended_posture}</p>
              </div>
              <div className="rounded-lg border border-app-border bg-app-fill/40 p-2">
                <h3 className="text-[11px] font-semibold text-app-text">Primary risk</h3>
                <p className="mt-1 text-[11px] leading-relaxed text-app-muted">{result.primary_risk}</p>
              </div>
            </div>

            <div className="rounded-lg border border-app-border bg-app-fill/40 p-2">
              <h3 className="text-[11px] font-semibold text-app-text">Reply strategy</h3>
              <p className="mt-1 text-[11px] leading-relaxed text-app-muted">{result.reply_strategy}</p>
            </div>

            <div className="grid gap-2 md:grid-cols-3">
              <div className="rounded-lg border border-app-border bg-app-fill/40 p-2 md:col-span-3">
                <div className="mb-1 flex items-center justify-between gap-2">
                  <h3 className="text-[11px] font-semibold text-app-text">Suggested reply</h3>
                  <button type="button" onClick={() => copyText(result.suggested_reply)} className="text-[10px] font-medium text-app-muted hover:text-app-text">Copy</button>
                </div>
                <p className="whitespace-pre-wrap rounded-md border border-app-border bg-app-surface p-2 text-[11px] leading-relaxed text-app-muted">{result.suggested_reply || 'No suggested reply generated.'}</p>
              </div>
              <div className="rounded-lg border border-app-border bg-app-fill/40 p-2">
                <h3 className="text-[11px] font-semibold text-app-text">Short reply</h3>
                <p className="mt-1 whitespace-pre-wrap text-[11px] leading-relaxed text-app-muted">{result.short_reply || 'None.'}</p>
              </div>
              <div className="rounded-lg border border-app-border bg-app-fill/40 p-2">
                <h3 className="text-[11px] font-semibold text-app-text">Firmer reply</h3>
                <p className="mt-1 whitespace-pre-wrap text-[11px] leading-relaxed text-app-muted">{result.firm_reply || 'None.'}</p>
              </div>
              <div className="rounded-lg border border-app-border bg-app-fill/40 p-2">
                <h3 className="text-[11px] font-semibold text-app-text">Internal note</h3>
                <p className="mt-1 whitespace-pre-wrap text-[11px] leading-relaxed text-app-muted">{result.internal_note || 'None.'}</p>
              </div>
            </div>

            <div className="grid gap-2 md:grid-cols-2">
              <ListCard title="Questions to ask" items={result.questions_to_ask} />
              <ListCard title="Commitments to avoid" items={result.commitments_to_avoid} />
              <ListCard title="Do not say" items={result.do_not_say} />
              <ListCard title="Next steps" items={result.next_steps} />
            </div>
          </div>
        ) : (
          <div className="flex h-full min-h-[560px] items-center justify-center rounded-lg border border-dashed border-app-border bg-app-fill/30 p-8 text-center">
            <div className="max-w-md">
              <p className="text-[13px] font-semibold text-app-text">Paste the message. Get the sane response.</p>
              <p className="mt-2 text-[11px] leading-relaxed text-app-muted">
                Reply Coach is built for the moment when you need to answer quickly, stay helpful, and not accidentally sign the team up for impossible work.
              </p>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}

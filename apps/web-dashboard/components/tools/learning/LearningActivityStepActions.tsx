'use client';

import Link from 'next/link';
import { useState } from 'react';

import { completeLearningStep, validateLearningStep } from '../../../lib/api';
import type { LearningPlaybookStep } from '../../../lib/learning/activityTypes';
import { LEARNING_EXAMPLE_INDEX_BY_STEP } from '../../../lib/learning/learningExamples';
import { saveLearningMemory } from '../../../lib/learning/saveLearningMemory';
import { LearningCoachDrawer } from './LearningCoachDrawer';

function appendMissionParams(href: string, enrollmentId: string, stepId: string): string {
  const sep = href.includes('?') ? '&' : '?';
  let out = `${href}${sep}enrollment=${encodeURIComponent(enrollmentId)}&step=${encodeURIComponent(stepId)}`;
  const exampleIdx = LEARNING_EXAMPLE_INDEX_BY_STEP[stepId];
  if (exampleIdx != null) {
    out += `&example=${exampleIdx}`;
  }
  return out;
}

export function LearningActivityStepActions({
  step,
  enrollmentId,
  sandboxProjectKey,
  onProgress,
}: {
  step: LearningPlaybookStep;
  enrollmentId: string;
  sandboxProjectKey: string;
  onProgress: () => void | Promise<void>;
}) {
  const [quizAnswers, setQuizAnswers] = useState<Record<string, number>>({});
  const [reflection, setReflection] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const toolCta = step.activity?.tool_cta;
  const reflectionPrompt =
    step.activity?.reflection_prompt ??
    'Write a short reflection on how you will apply this on your next assignment.';

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setErr(null);
    try {
      await fn();
      await onProgress();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mt-8 space-y-4 border-t border-app-border pt-6">
      {err ? <p className="text-[11px] text-rose-500">{err}</p> : null}

      {toolCta?.href ? (
        <div className="rounded-lg border border-app-border bg-app-surface p-3">
          <p className="text-[11px] font-medium text-app-text">{toolCta.label}</p>
          {toolCta.hint ? <p className="mt-1 text-[11px] text-app-muted">{toolCta.hint}</p> : null}
          <Link
            href={appendMissionParams(toolCta.href, enrollmentId, step.id)}
            className="mt-2 inline-block text-[11px] font-medium text-teal-700 underline dark:text-teal-300"
          >
            Open tool →
          </Link>
        </div>
      ) : null}

      {step.kind === 'quiz' && step.quiz ? (
        <div className="space-y-3">
          {(step.quiz.questions ?? []).map((q) => (
            <fieldset key={q.id} className="space-y-1 rounded-md border border-app-border p-3">
              <legend className="text-[12px] font-medium text-app-text">{q.prompt}</legend>
              {q.options.map((opt, i) => (
                <label key={i} className="flex items-center gap-2 text-[11px]">
                  <input
                    type="radio"
                    name={q.id}
                    checked={quizAnswers[q.id] === i}
                    onChange={() => setQuizAnswers((a) => ({ ...a, [q.id]: i }))}
                  />
                  {opt}
                </label>
              ))}
            </fieldset>
          ))}
          <button
            type="button"
            disabled={busy}
            onClick={() =>
              void run(async () => {
                await completeLearningStep(enrollmentId, step.id, { answers: quizAnswers });
              })
            }
            className="rounded-md border border-teal-500/40 bg-teal-500/15 px-3 py-1.5 text-[11px] font-medium"
          >
            Submit quiz
          </button>
          {step.governance_anchor ? (
            <Link href={`/governance#${step.governance_anchor}`} className="block text-[10px] underline">
              Review governance section
            </Link>
          ) : null}
        </div>
      ) : null}

      {step.kind === 'reflection' ? (
        <div className="space-y-2">
          <p className="text-[11px] text-app-muted">{reflectionPrompt}</p>
          <textarea
            value={reflection}
            onChange={(e) => setReflection(e.target.value)}
            rows={5}
            className="w-full rounded border border-app-border bg-app-fill p-2 text-[11px]"
            placeholder="Write your reflection…"
          />
          <button
            type="button"
            disabled={busy || !reflection.trim()}
            onClick={() =>
              void run(async () => {
                await saveLearningMemory({
                  projectKey: sandboxProjectKey,
                  title: step.validation?.title ?? step.title,
                  body: reflection,
                  enrollmentId,
                  stepId: step.id,
                });
                await validateLearningStep(enrollmentId, step.id);
                setReflection('');
              })
            }
            className="rounded-md border border-app-border bg-app-fill px-3 py-1.5 text-[11px]"
          >
            Save & validate
          </button>
        </div>
      ) : null}

      {step.kind !== 'quiz' && step.kind !== 'reflection' ? (
        <div className="flex flex-wrap gap-2">
          {step.validation?.type !== 'manual' ? (
            <button
              type="button"
              disabled={busy}
              onClick={() => void run(() => validateLearningStep(enrollmentId, step.id).then(() => undefined))}
              className="rounded-md border border-teal-500/40 bg-teal-500/10 px-3 py-1.5 text-[11px] font-medium"
            >
              Check completion
            </button>
          ) : null}
          <button
            type="button"
            disabled={busy}
            onClick={() => void run(() => completeLearningStep(enrollmentId, step.id).then(() => undefined))}
            className="rounded-md border border-app-border bg-app-fill px-3 py-1.5 text-[11px]"
          >
            Mark complete
          </button>
        </div>
      ) : null}

      <LearningCoachDrawer enrollmentId={enrollmentId} stepId={step.id} />
    </div>
  );
}

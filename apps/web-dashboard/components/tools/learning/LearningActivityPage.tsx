'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { getLearningEnrollment, getLearningPlaybook } from '../../../lib/api';
import {
  type LearningPlaybook,
  type LearningPlaybookStep,
  stepHasActivityContent,
} from '../../../lib/learning/activityTypes';
import { learningActivityHref, learningMissionHref } from '../../../lib/learning/moduleCatalog';
import { toolRouteHref } from '../../../lib/toolCatalog';
import { LearningActivityContent } from './LearningActivityContent';
import { LearningActivityStepActions } from './LearningActivityStepActions';

function findStep(playbook: LearningPlaybook, stepId: string): LearningPlaybookStep | null {
  for (const m of playbook.missions ?? []) {
    for (const s of m.steps ?? []) {
      if (s.id === stepId) return s;
    }
  }
  return null;
}

export function LearningActivityPage({
  playbookId,
  stepId,
  brandKey,
}: {
  playbookId: string;
  stepId: string;
  brandKey?: string | null;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const enrollmentParam = searchParams.get('enrollment');

  const [playbook, setPlaybook] = useState<LearningPlaybook | null>(null);
  const [enrollment, setEnrollment] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const enrollmentId = (enrollment?.id as string) ?? enrollmentParam ?? '';

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const pb = (await getLearningPlaybook(playbookId, brandKey)) as LearningPlaybook;
      setPlaybook(pb);
      if (enrollmentParam) {
        const en = (await getLearningEnrollment(enrollmentParam)) as Record<string, unknown>;
        setEnrollment(en);
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [playbookId, brandKey, enrollmentParam]);

  useEffect(() => {
    void load();
  }, [load]);

  const step = useMemo(
    () => (playbook ? findStep(playbook, stepId) : null),
    [playbook, stepId],
  );

  const refreshEnrollment = async () => {
    if (!enrollmentId) return;
    const en = (await getLearningEnrollment(enrollmentId)) as Record<string, unknown>;
    setEnrollment(en);
    const next = (en.current_step_id as string) || stepId;
    if (next && next !== stepId) {
      router.replace(learningActivityHref(playbookId, next, enrollmentId, brandKey));
    }
  };

  if (loading) {
    return <p className="text-[11px] text-app-muted">Loading activity…</p>;
  }

  if (!playbook || !step) {
    return <p className="text-[11px] text-rose-500">{err ?? 'Step not found.'}</p>;
  }

  const missionHref = enrollmentId
    ? learningMissionHref(playbookId, enrollmentId, stepId)
    : learningMissionHref(playbookId);

  const hasContent = stepHasActivityContent(step);

  return (
    <div className="space-y-4">
      <nav className="flex flex-wrap items-center gap-2 text-[11px] text-app-muted">
        <Link href={toolRouteHref('learning')} className="hover:text-app-text">
          Learning hub
        </Link>
        <span>/</span>
        <Link href={missionHref} className="hover:text-app-text">
          {playbook.title}
        </Link>
        <span>/</span>
        <span className="text-app-text">{step.title}</span>
      </nav>

      <header>
        <h1 className="text-lg font-semibold text-app-text">{step.title}</h1>
        {step.activity?.summary ? (
          <p className="mt-1 text-[12px] text-app-muted">{step.activity.summary}</p>
        ) : null}
      </header>

      {err ? <p className="text-[11px] text-rose-500">{err}</p> : null}

      {!enrollmentId ? (
        <p className="rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-[11px]">
          Enroll in this path from the{' '}
          <Link href={missionHref} className="font-medium underline">
            mission map
          </Link>{' '}
          to save progress and complete this activity.
        </p>
      ) : null}

      {!hasContent ? (
        <div className="rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-[11px] text-app-text">
          Content pending for this step. Return to the{' '}
          <Link href={missionHref} className="font-medium underline">
            mission map
          </Link>
          .
        </div>
      ) : (
        <LearningActivityContent step={step} />
      )}

      {enrollmentId && hasContent ? (
        <LearningActivityStepActions
          step={step}
          enrollmentId={enrollmentId}
          sandboxProjectKey={String(enrollment?.sandbox_project_key ?? '')}
          onProgress={refreshEnrollment}
        />
      ) : null}
    </div>
  );
}

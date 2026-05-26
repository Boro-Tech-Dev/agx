'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { enrollLearning, getLearningPlaybook } from '../../../lib/api';
import { learningActivityHref, learningMissionHref } from '../../../lib/learning/moduleCatalog';
import { useLearningEnrollment } from '../../../lib/learning/enrollmentContext';
import { toolRouteHref } from '../../../lib/toolCatalog';
import { LearningCertificateButton } from './LearningCertificateButton';
import { LearningCoachDrawer } from './LearningCoachDrawer';
import { LearningMissionMap } from './LearningMissionMap';
import type { LearningPlaybook } from '../../../lib/learning/activityTypes';

function allStepIds(pb: LearningPlaybook): string[] {
  const ids: string[] = [];
  for (const m of pb.missions ?? []) {
    for (const s of m.steps ?? []) {
      if (s.id) ids.push(s.id);
    }
  }
  return ids;
}

export function LearningMissionPage({
  playbookId,
  brandKey,
}: {
  playbookId: string;
  brandKey?: string | null;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const enrollmentParam = searchParams.get('enrollment');
  const stepParam = searchParams.get('step');
  const { enrollments, refreshEnrollments } = useLearningEnrollment();

  const [playbook, setPlaybook] = useState<LearningPlaybook | null>(null);
  const [enrollment, setEnrollment] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const enrollmentId = (enrollment?.id as string) ?? enrollmentParam ?? '';

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const pb = (await getLearningPlaybook(playbookId, brandKey)) as LearningPlaybook;
      setPlaybook(pb);
      let en: Record<string, unknown> | null = null;
      if (enrollmentParam) {
        const { getLearningEnrollment } = await import('../../../lib/api');
        en = (await getLearningEnrollment(enrollmentParam)) as Record<string, unknown>;
      } else {
        const existing = enrollments.find(
          (e) =>
            e.playbook_id === playbookId &&
            e.status === 'active' &&
            (e.brand_key ?? '') === (brandKey ?? ''),
        );
        if (existing) {
          const { getLearningEnrollment } = await import('../../../lib/api');
          en = (await getLearningEnrollment(existing.id)) as Record<string, unknown>;
        }
      }
      setEnrollment(en);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [playbookId, brandKey, enrollmentParam, enrollments]);

  useEffect(() => {
    void load();
  }, [load]);

  const completedSet = useMemo(() => {
    const ids = (enrollment?.completed_step_ids as string[]) ?? [];
    return new Set(ids);
  }, [enrollment]);

  const missions = useMemo(() => {
    if (!playbook) return [];
    const steps = allStepIds(playbook);
    return (playbook.missions ?? []).map((mission) => ({
      id: mission.id,
      title: mission.title,
      steps: (mission.steps ?? []).map((step) => {
        const idx = steps.indexOf(step.id);
        const prev = idx > 0 ? steps[idx - 1] : null;
        const locked = prev != null && !completedSet.has(prev);
        return {
          id: step.id,
          title: step.title,
          kind: step.kind,
          locked,
          done: completedSet.has(step.id),
        };
      }),
    }));
  }, [playbook, completedSet]);

  const activeStep = useMemo(() => {
    if (!playbook) return null;
    const sid = stepParam || (enrollment?.current_step_id as string);
    for (const m of playbook.missions ?? []) {
      for (const s of m.steps ?? []) {
        if (s.id === sid) return s;
      }
    }
    return null;
  }, [playbook, stepParam, enrollment]);

  const handleEnroll = async () => {
    setBusy(true);
    setErr(null);
    try {
      const en = await enrollLearning(playbookId, brandKey);
      setEnrollment(en as Record<string, unknown>);
      await refreshEnrollments();
      router.replace(learningMissionHref(playbookId, String((en as { id: string }).id)));
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return <p className="text-[11px] text-app-muted">Loading mission…</p>;
  }

  if (!playbook) {
    return <p className="text-[11px] text-rose-500">{err ?? 'Playbook not found.'}</p>;
  }

  const total = allStepIds(playbook).length;
  const done = completedSet.size;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <Link href={toolRouteHref('learning')} className="text-[11px] text-app-muted hover:text-app-text">
            ← Learning hub
          </Link>
          <h2 className="mt-1 text-sm font-semibold text-app-text">{playbook.title}</h2>
          <p className="text-[11px] text-app-muted">
            Progress {done}/{total}
            {enrollment?.sandbox_project_key ? (
              <>
                {' '}
                · Sandbox{' '}
                <Link
                  href={`/workspaces?project_key=${encodeURIComponent(String(enrollment.sandbox_project_key))}`}
                  className="font-mono underline"
                >
                  {String(enrollment.sandbox_project_key)}
                </Link>
              </>
            ) : null}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {!enrollment ? (
            <button
              type="button"
              disabled={busy}
              onClick={() => void handleEnroll()}
              className="rounded-md border border-teal-500/40 bg-teal-500/15 px-3 py-1.5 text-[11px] font-medium text-teal-900 dark:text-teal-100"
            >
              Enroll
            </button>
          ) : null}
          {enrollment?.status === 'completed' && enrollmentId ? (
            <LearningCertificateButton enrollmentId={enrollmentId} />
          ) : null}
        </div>
      </div>

      {enrollment?.content_update ? (
        <div className="rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-[11px] text-app-text">
          {(enrollment.content_update as { summary?: string }).summary}
          <button
            type="button"
            className="ml-2 underline"
            onClick={() => {
              void import('../../../lib/api').then((api) =>
                api.markLearningContentSeen(enrollmentId).then(() => load()),
              );
            }}
          >
            Dismiss
          </button>
        </div>
      ) : null}

      {err ? <p className="text-[11px] text-rose-500">{err}</p> : null}

      <div className="grid gap-4 desktop:grid-cols-[1fr_minmax(0,18rem)]">
        <LearningMissionMap
          missions={missions}
          currentStepId={activeStep?.id}
          onSelectStep={(id) => {
            if (!enrollmentId) return;
            router.replace(learningMissionHref(playbookId, enrollmentId, id));
          }}
        />

        <aside className="rounded-lg border border-app-border bg-app-surface p-3">
          {!enrollment ? (
            <p className="text-[11px] text-app-muted">Enroll to start this path.</p>
          ) : !activeStep ? (
            <p className="text-[11px] text-app-muted">Select a step from the map.</p>
          ) : (
            <div className="space-y-3">
              <h3 className="text-xs font-semibold text-app-text">{activeStep.title}</h3>
              <p className="text-[11px] text-app-muted">
                {activeStep.kind === 'quiz'
                  ? 'Quiz activity'
                  : activeStep.kind === 'reflection'
                    ? 'Reflection activity'
                    : activeStep.kind === 'read'
                      ? 'Reading activity'
                      : 'Practice activity'}
              </p>
              <Link
                href={learningActivityHref(playbookId, activeStep.id, enrollmentId, brandKey)}
                className="block rounded-md border border-teal-500/40 bg-teal-500/15 px-3 py-2 text-center text-[11px] font-medium text-teal-900 dark:text-teal-100"
              >
                Open activity →
              </Link>
              {enrollmentId ? (
                <LearningCoachDrawer enrollmentId={enrollmentId} stepId={activeStep.id} />
              ) : null}
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}

'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';

import { getLearningEnrollment } from '../../../lib/api';
import { learningMissionHref } from '../../../lib/learning/moduleCatalog';

export function LearningMissionBanner() {
  const searchParams = useSearchParams();
  const enrollmentId = searchParams.get('enrollment');
  const stepId = searchParams.get('step');
  const [meta, setMeta] = useState<{ playbookId: string; title: string } | null>(null);

  useEffect(() => {
    if (!enrollmentId) {
      setMeta(null);
      return;
    }
    void getLearningEnrollment(enrollmentId)
      .then((e) => {
        setMeta({
          playbookId: String(e.playbook_id),
          title: String((e.playbook as { title?: string })?.title ?? e.playbook_id),
        });
      })
      .catch(() => setMeta(null));
  }, [enrollmentId]);

  if (!enrollmentId || !meta) return null;

  const label = stepId
    ? `Learning: ${meta.title} — step ${stepId.replace(/_/g, ' ')}`
    : `Learning: ${meta.title}`;

  return (
    <div className="mb-2 flex flex-wrap items-center justify-between gap-2 rounded-md border border-teal-500/30 bg-teal-500/10 px-2.5 py-1.5 text-[11px]">
      <span className="text-app-text">{label}</span>
      <Link
        href={learningMissionHref(meta.playbookId, enrollmentId, stepId ?? undefined)}
        className="font-medium text-teal-700 underline dark:text-teal-300"
      >
        Back to mission
      </Link>
    </div>
  );
}

'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

import { listLearningRecapDue, listMyLearningEnrollments } from '../../lib/api';
import { learningMissionHref } from '../../lib/learning/moduleCatalog';
import { toolRouteHref } from '../../lib/toolCatalog';

export function LearningHomeCard() {
  const [active, setActive] = useState<{ label: string; href: string } | null>(null);
  const [recapCount, setRecapCount] = useState(0);

  useEffect(() => {
    void listMyLearningEnrollments()
      .then(({ enrollments }) => {
        const a = enrollments.find((e) => e.status === 'active');
        if (a) {
          setActive({
            label: `${a.playbook_id.replace(/_/g, ' ')} — ${a.progress_label ?? ''}`,
            href: learningMissionHref(a.playbook_id, a.id, a.current_step_id ?? undefined),
          });
        }
      })
      .catch(() => setActive(null));
    void listLearningRecapDue()
      .then(({ enrollments }) => setRecapCount(enrollments.length))
      .catch(() => setRecapCount(0));
  }, []);

  if (!active && recapCount === 0) return null;

  return (
    <section className="mb-3 rounded-lg border border-teal-500/30 bg-teal-500/5 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-xs font-semibold text-app-text">Learning</h3>
        <Link href={toolRouteHref('learning')} className="text-[11px] font-medium text-teal-700 underline dark:text-teal-300">
          Open Learning tool
        </Link>
      </div>
      {active ? (
        <p className="mt-1 text-[11px] text-app-muted">
          In progress:{' '}
          <Link href={active.href} className="font-medium text-app-text underline">
            {active.label}
          </Link>
        </p>
      ) : null}
      {recapCount > 0 ? (
        <p className="mt-1 text-[11px] text-amber-800 dark:text-amber-200">
          {recapCount} path{recapCount === 1 ? '' : 's'} due for spaced review.
        </p>
      ) : null}
    </section>
  );
}

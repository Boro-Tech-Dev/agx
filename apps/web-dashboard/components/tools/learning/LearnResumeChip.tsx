'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

import {
  listLearningCatalog,
  listMyLearningEnrollments,
  type LearningCatalogRow,
  type LearningEnrollmentRow,
} from '../../../lib/api';
import { learningMissionHref, resumeChipLabel } from '../../../lib/learning/moduleCatalog';

export function LearnResumeChip() {
  const [chip, setChip] = useState<{ href: string; label: string } | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const [{ enrollments }, { playbooks }] = await Promise.all([
          listMyLearningEnrollments(),
          listLearningCatalog(),
        ]);
        const titles = new Map((playbooks as LearningCatalogRow[]).map((p) => [p.id, p.title]));
        const active = (enrollments as LearningEnrollmentRow[]).filter((e) => e.status === 'active');
        if (!active.length) {
          setChip(null);
          return;
        }
        const e = active[0]!;
        const title = titles.get(e.playbook_id) ?? e.playbook_id;
        const parts = (e.progress_label ?? '0/0').split('/');
        const completed = parseInt(parts[0] ?? '0', 10) || 0;
        const total = parseInt(parts[1] ?? '0', 10) || 0;
        setChip({
          href: learningMissionHref(e.playbook_id, e.id, e.current_step_id ?? undefined),
          label: resumeChipLabel(title, completed, total),
        });
      } catch {
        setChip(null);
      }
    })();
  }, []);

  if (!chip) return null;

  return (
    <Link
      href={chip.href}
      className="hidden rounded-full border border-teal-500/40 bg-teal-500/10 px-2.5 py-0.5 text-[10px] font-medium text-teal-900 hover:bg-teal-500/20 dark:text-teal-100 tablet:inline-flex"
    >
      {chip.label}
    </Link>
  );
}

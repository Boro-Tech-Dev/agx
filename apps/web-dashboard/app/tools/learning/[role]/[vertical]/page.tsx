'use client';

import { Suspense } from 'react';

import { LearningMissionPage } from '../../../../../components/tools/learning/LearningMissionPage';
import { playbookIdFromRoleVertical } from '../../../../../lib/learning/moduleCatalog';

export default function LearningRolePage({
  params,
}: {
  params: { role: string; vertical: string };
}) {
  const playbookId = playbookIdFromRoleVertical(params.role, params.vertical);
  return (
    <Suspense fallback={<p className="text-[11px] text-app-muted">Loading…</p>}>
      <LearningMissionPage playbookId={playbookId} />
    </Suspense>
  );
}

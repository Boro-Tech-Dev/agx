'use client';

import { Suspense } from 'react';

import { LearningMissionPage } from '../../../../components/tools/learning/LearningMissionPage';

export default function LearningPharmaPage() {
  return (
    <Suspense fallback={<p className="text-[11px] text-app-muted">Loading…</p>}>
      <LearningMissionPage playbookId="pharma_knowledge" />
    </Suspense>
  );
}

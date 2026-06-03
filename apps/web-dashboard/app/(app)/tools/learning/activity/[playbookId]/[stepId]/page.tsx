'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';

import { LearningActivityPage } from '../../../../../../../components/tools/learning/LearningActivityPage';

function ActivityPageInner({
  params,
}: {
  params: { playbookId: string; stepId: string };
}) {
  const searchParams = useSearchParams();
  const brand = searchParams.get('brand');
  return (
    <LearningActivityPage
      playbookId={decodeURIComponent(params.playbookId)}
      stepId={decodeURIComponent(params.stepId)}
      brandKey={brand}
    />
  );
}

export default function LearningActivityRoutePage({
  params,
}: {
  params: { playbookId: string; stepId: string };
}) {
  return (
    <Suspense fallback={<p className="text-[11px] text-app-muted">Loading…</p>}>
      <ActivityPageInner params={params} />
    </Suspense>
  );
}

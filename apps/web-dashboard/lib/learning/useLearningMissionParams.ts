'use client';

import { useSearchParams } from 'next/navigation';

export function useLearningMissionParams() {
  const searchParams = useSearchParams();
  const enrollmentId = searchParams.get('enrollment');
  const stepId = searchParams.get('step');
  const exampleIndex = searchParams.get('example');
  return {
    enrollmentId,
    stepId,
    exampleIndex: exampleIndex != null ? parseInt(exampleIndex, 10) : null,
    active: Boolean(enrollmentId),
  };
}

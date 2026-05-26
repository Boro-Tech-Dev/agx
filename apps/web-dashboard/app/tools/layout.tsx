'use client';

import type { ReactNode } from 'react';

import { LearningEnrollmentProvider } from '../../lib/learning/enrollmentContext';

export default function ToolsLayout({ children }: { children: ReactNode }) {
  return <LearningEnrollmentProvider>{children}</LearningEnrollmentProvider>;
}

'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import {
  getLearningEnrollment,
  listMyLearningEnrollments,
  type LearningEnrollmentRow,
} from '../api';

type LearningEnrollmentContextValue = {
  enrollments: LearningEnrollmentRow[];
  activeEnrollmentId: string | null;
  setActiveEnrollmentId: (id: string | null) => void;
  refreshEnrollments: () => Promise<void>;
  loadEnrollmentDetail: (id: string) => Promise<Record<string, unknown> | null>;
};

const LearningEnrollmentContext = createContext<LearningEnrollmentContextValue | null>(null);

export function LearningEnrollmentProvider({ children }: { children: ReactNode }) {
  const [enrollments, setEnrollments] = useState<LearningEnrollmentRow[]>([]);
  const [activeEnrollmentId, setActiveEnrollmentId] = useState<string | null>(null);

  const refreshEnrollments = useCallback(async () => {
    try {
      const data = await listMyLearningEnrollments();
      setEnrollments(data.enrollments ?? []);
    } catch {
      setEnrollments([]);
    }
  }, []);

  useEffect(() => {
    void refreshEnrollments();
  }, [refreshEnrollments]);

  const loadEnrollmentDetail = useCallback(async (id: string) => {
    try {
      return (await getLearningEnrollment(id)) as Record<string, unknown>;
    } catch {
      return null;
    }
  }, []);

  const value = useMemo(
    () => ({
      enrollments,
      activeEnrollmentId,
      setActiveEnrollmentId,
      refreshEnrollments,
      loadEnrollmentDetail,
    }),
    [enrollments, activeEnrollmentId, refreshEnrollments, loadEnrollmentDetail],
  );

  return (
    <LearningEnrollmentContext.Provider value={value}>{children}</LearningEnrollmentContext.Provider>
  );
}

export function useLearningEnrollment() {
  const ctx = useContext(LearningEnrollmentContext);
  if (!ctx) {
    throw new Error('useLearningEnrollment requires LearningEnrollmentProvider');
  }
  return ctx;
}

export function useLearningEnrollmentOptional() {
  return useContext(LearningEnrollmentContext);
}

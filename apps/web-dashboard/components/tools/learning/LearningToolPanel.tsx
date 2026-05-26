'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';

import { listLearningCatalog, listLearningRecapDue } from '../../../lib/api';
import {
  NON_PHARMA_ROLE_PLAYBOOK_IDS,
  PHARMA_KNOWLEDGE_ID,
  PHARMA_ROLE_PLAYBOOK_IDS,
  SPECIALIST_PHARMA_PLAYBOOK_IDS,
  specialistComingSoon,
} from '../../../lib/learning/catalogGroups';
import { learningMissionHref, type LearningPlaybookMeta } from '../../../lib/learning/moduleCatalog';
import { useLearningEnrollment } from '../../../lib/learning/enrollmentContext';
import { toolAccentClasses, toolMonogram } from '../../../lib/toolCatalog';
import { LearningEnrollModal } from './LearningEnrollModal';
import { LearningMusingsSection } from './LearningMusingsSection';

type CatalogMeta = LearningPlaybookMeta & { total_steps?: number };

function PlaybookCard({
  p,
  enrollments,
  onEnroll,
  comingSoon,
}: {
  p: CatalogMeta;
  enrollments: { playbook_id: string; status: string; id: string; current_step_id?: string | null }[];
  onEnroll: (p: CatalogMeta) => void;
  comingSoon?: boolean;
}) {
  const active = enrollments.find((e) => e.playbook_id === p.id && e.status === 'active');

  return (
    <div className="rounded-lg border border-app-border bg-app-surface p-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-app-text">{p.title}</p>
          <p className="mt-0.5 text-[10px] text-app-muted">
            {p.agency_role?.replace(/_/g, ' ') ?? 'Pharma advertising'}
            {p.vertical ? ` · ${p.vertical.replace(/_/g, ' ')}` : ''}
            {p.estimatedMinutes ? ` · ~${p.estimatedMinutes} min` : ''}
            {p.total_steps ? ` · ${p.total_steps} steps` : ''}
          </p>
        </div>
        {comingSoon ? (
          <span className="shrink-0 rounded bg-app-fill px-1.5 py-0.5 text-[9px] font-medium uppercase text-app-muted">
            Coming soon
          </span>
        ) : null}
      </div>
      <div className="mt-2 flex flex-wrap gap-2">
        {comingSoon ? (
          <span className="text-[11px] text-app-muted">Content in progress</span>
        ) : active ? (
          <Link
            href={learningMissionHref(p.id, active.id, active.current_step_id ?? undefined)}
            className="text-[11px] font-medium text-teal-700 underline dark:text-teal-300"
          >
            Resume
          </Link>
        ) : (
          <button
            type="button"
            onClick={() => onEnroll(p)}
            className="text-[11px] font-medium text-teal-700 underline dark:text-teal-300"
          >
            Enroll
          </button>
        )}
      </div>
    </div>
  );
}


export function LearningToolPanel() {
  const { enrollments, refreshEnrollments } = useLearningEnrollment();
  const [catalog, setCatalog] = useState<CatalogMeta[]>([]);
  const [recap, setRecap] = useState<{ playbook_id: string; id: string }[]>([]);
  const [enrollTarget, setEnrollTarget] = useState<CatalogMeta | null>(null);
  const [showGeneral, setShowGeneral] = useState(false);

  useEffect(() => {
    void listLearningCatalog()
      .then((d) => setCatalog((d.playbooks ?? []) as CatalogMeta[]))
      .catch(() => setCatalog([]));
    void listLearningRecapDue()
      .then((d) => setRecap((d.enrollments ?? []) as { playbook_id: string; id: string }[]))
      .catch(() => setRecap([]));
  }, []);

  const byId = useMemo(() => Object.fromEntries(catalog.map((p) => [p.id, p])), [catalog]);

  const pharmaKnowledge = byId[PHARMA_KNOWLEDGE_ID];
  const pharmaRoles = PHARMA_ROLE_PLAYBOOK_IDS.map((id) => byId[id]).filter(Boolean) as CatalogMeta[];
  const specialists = SPECIALIST_PHARMA_PLAYBOOK_IDS.map((id) => byId[id]).filter(Boolean) as CatalogMeta[];
  const generalRoles = NON_PHARMA_ROLE_PLAYBOOK_IDS.map((id) => byId[id]).filter(Boolean) as CatalogMeta[];

  const accent = toolAccentClasses('learning');
  const activeEnrollments = enrollments.filter((e) => e.status === 'active');

  const pharmaKnowledgeDone = enrollments.some(
    (e) => e.playbook_id === PHARMA_KNOWLEDGE_ID && e.status === 'completed',
  );

  return (
    <div className="space-y-4">
      {recap.length > 0 ? (
        <section className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3">
          <h3 className="text-xs font-semibold text-app-text">Review soon</h3>
          <p className="mt-1 text-[11px] text-app-muted">Spaced recap — revisit completed paths.</p>
          <ul className="mt-2 space-y-1">
            {recap.map((r) => (
              <li key={r.id}>
                <Link
                  href={learningMissionHref(r.playbook_id, r.id)}
                  className="text-[11px] font-medium text-teal-700 underline dark:text-teal-300"
                >
                  {r.playbook_id.replace(/_/g, ' ')}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {activeEnrollments.length > 0 ? (
        <section className="rounded-lg border border-app-border bg-app-surface p-3">
          <h3 className="text-xs font-semibold text-app-text">Continue learning</h3>
          <ul className="mt-2 space-y-1.5">
            {activeEnrollments.map((e) => (
              <li key={e.id}>
                <Link
                  href={learningMissionHref(e.playbook_id, e.id, e.current_step_id ?? undefined)}
                  className="flex items-center justify-between rounded-md border border-app-border bg-app-fill px-2 py-1.5 text-[11px] hover:bg-app-fill-hover"
                >
                  <span className="font-medium text-app-text">{e.playbook_id.replace(/_/g, ' ')}</span>
                  <span className="text-app-muted">{e.progress_label ?? ''}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section>
        <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-app-muted">
          Pharma advertising — start here
        </h3>
        <p className="mb-2 text-[11px] text-app-muted">
          Day-one literacy for regulated promotional work (not brand- or role-specific).
        </p>
        {pharmaKnowledge ? (
          <Link
            href="/tools/learning/pharma"
            className={`block rounded-lg border p-3 ${accent.ring} bg-app-surface`}
          >
            <div className="flex items-center gap-2">
              <span
                className={`flex h-8 w-8 items-center justify-center rounded text-xs font-bold ${accent.chip}`}
              >
                {toolMonogram('learning')}
              </span>
              <div>
                <span className="text-sm font-semibold text-app-text">{pharmaKnowledge.title}</span>
                <p className="text-[11px] text-app-muted">
                  {pharmaKnowledge.total_steps ?? 12} steps
                  {pharmaKnowledge.estimatedMinutes ? ` · ~${pharmaKnowledge.estimatedMinutes} min` : ''}
                </p>
              </div>
            </div>
          </Link>
        ) : null}
      </section>

      <section>
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-app-muted">
          Role certifications (pharma)
        </h3>
        {!pharmaKnowledgeDone ? (
          <p className="mb-2 text-[11px] text-amber-700 dark:text-amber-300">
            Complete Pharma Knowledge first to unlock role paths.
          </p>
        ) : null}
        <div className="grid gap-2 sm:grid-cols-2">
          {pharmaRoles.map((p) => (
            <PlaybookCard
              key={p.id}
              p={p}
              enrollments={enrollments}
              onEnroll={setEnrollTarget}
            />
          ))}
        </div>
      </section>

      {specialists.length > 0 ? (
        <section>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-app-muted">
            Specialist paths (pharma)
          </h3>
          <div className="grid gap-2 sm:grid-cols-2">
            {specialists.map((p) => (
              <PlaybookCard
                key={p.id}
                p={p}
                enrollments={enrollments}
                onEnroll={setEnrollTarget}
                comingSoon={specialistComingSoon(p.total_steps ?? 0)}
              />
            ))}
          </div>
        </section>
      ) : null}

      <section className="rounded-lg border border-app-border bg-app-surface">
        <button
          type="button"
          onClick={() => setShowGeneral((v) => !v)}
          className="flex w-full items-center justify-between px-3 py-2 text-left text-xs font-semibold text-app-text"
        >
          General agency paths (non-pharma)
          <span className="text-app-muted">{showGeneral ? '−' : '+'}</span>
        </button>
        {showGeneral ? (
          <div className="grid gap-2 border-t border-app-border p-3 sm:grid-cols-2">
            {generalRoles.map((p) => (
              <PlaybookCard
                key={p.id}
                p={p}
                enrollments={enrollments}
                onEnroll={setEnrollTarget}
              />
            ))}
          </div>
        ) : null}
      </section>

      <LearningMusingsSection />

      {enrollTarget ? (
        <LearningEnrollModal
          playbook={enrollTarget}
          onClose={() => setEnrollTarget(null)}
          onEnrolled={async (enrollmentId) => {
            setEnrollTarget(null);
            await refreshEnrollments();
            window.location.href = learningMissionHref(enrollTarget.id, enrollmentId);
          }}
        />
      ) : null}
    </div>
  );
}

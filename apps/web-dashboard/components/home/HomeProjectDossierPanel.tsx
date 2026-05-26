'use client';

import dynamic from 'next/dynamic';
import { useEffect, useState } from 'react';

import Link from 'next/link';

import {
  DOSSIER_FIRST_DAY_PM_HREF,
  DOSSIER_HERO,
  DOSSIER_INTRO,
  GLOSSARY,
  STACK_GROUPS,
  type StackGroup,
} from '../../lib/home/projectDossierCopy';
import { PanelChevron } from '../workspaces/PanelChevron';

const LS_KEY = 'dd.home.projectDossierExpanded';

function readLs(key: string, fallback: string): string {
  if (typeof window === 'undefined') return fallback;
  return localStorage.getItem(key) ?? fallback;
}

function readLsBool(key: string, fallback: boolean): boolean {
  const v = readLs(key, fallback ? '1' : '0');
  return v === '1' || v === 'true';
}

function writeLs(key: string, value: string) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(key, value);
}

const groupCardClass: Record<StackGroup['accent'], string> = {
  rose: 'border-rose-200 bg-rose-50/90 dark:border-rose-500/30 dark:bg-rose-500/10',
  amber: 'border-amber-200 bg-amber-50/90 dark:border-amber-500/30 dark:bg-amber-500/10',
  indigo: 'border-indigo-200 bg-indigo-50/90 dark:border-indigo-500/30 dark:bg-indigo-500/10',
  emerald: 'border-emerald-200 bg-emerald-50/90 dark:border-emerald-500/30 dark:bg-emerald-500/10',
  violet: 'border-violet-200 bg-violet-50/90 dark:border-violet-500/30 dark:bg-violet-500/10',
  sky: 'border-sky-200 bg-sky-50/90 dark:border-sky-500/30 dark:bg-sky-500/10',
  slate: 'border-slate-200 bg-slate-50/90 dark:border-slate-500/30 dark:bg-slate-500/10',
};

const DossierViz = dynamic(() => import('./HomeProjectDossierViz'), {
  ssr: false,
  loading: () => (
    <div className="rounded-lg border border-dashed border-app-border bg-app-fill/40 px-3 py-8 text-center text-[11px] text-app-muted">
      Loading interactive diagrams…
    </div>
  ),
});

export function HomeProjectDossierPanel({ embedded = false }: { embedded?: boolean } = {}) {
  const [expanded, setExpanded] = useState(() => readLsBool(LS_KEY, true));
  const bodyId = 'home-project-dossier-body';

  useEffect(() => {
    writeLs(LS_KEY, expanded ? '1' : '0');
  }, [expanded]);

  return (
    <section
      className={`${embedded ? 'mt-0' : 'mt-3'} overflow-hidden rounded-lg border border-app-border bg-app-surface shadow-xs`}
    >
      <div className="flex flex-wrap items-start justify-between gap-2 border-b border-app-border p-2.5">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-app-text">Project Dossier</h2>
          <p className="mt-0.5 text-[11px] text-app-muted">What RagTag is, what runs locally, and how the pieces connect.</p>
        </div>
        <button
          type="button"
          className="flex shrink-0 items-center justify-center rounded px-1 py-0.5 text-app-muted hover:bg-app-fill-hover"
          aria-label={expanded ? 'Collapse Project Dossier' : 'Expand Project Dossier'}
          aria-expanded={expanded}
          aria-controls={bodyId}
          onClick={() => setExpanded((v) => !v)}
        >
          <PanelChevron expanded={expanded} />
        </button>
      </div>

      <div id={bodyId} className={expanded ? 'p-2.5 pt-0 tablet:p-3 tablet:pt-0' : 'hidden'}>
        <p className="text-[12px] font-medium leading-snug text-app-text">{DOSSIER_HERO}</p>
        <div className="mt-2 space-y-2 text-[11px] leading-relaxed text-app-muted">
          {DOSSIER_INTRO.map((p, i) => (
            <p key={i}>{p}</p>
          ))}
          <p>
            New to pharma PM workflows?{' '}
            <Link href={DOSSIER_FIRST_DAY_PM_HREF} className="font-medium text-teal-700 underline dark:text-teal-300">
              Start the first-day Project Management (Pharma) path
            </Link>{' '}
            in Learning.
          </p>
        </div>

        <div className="mt-3">
          <DossierViz />
        </div>

        <div className="mt-4">
          <h3 className="text-[11px] font-semibold uppercase tracking-wide text-app-muted">Stack (compose services)</h3>
          <div className="mt-2 grid grid-cols-1 gap-2 tablet:grid-cols-2 desktop:grid-cols-3">
            {STACK_GROUPS.map((g) => (
              <div
                key={g.title}
                className={`rounded-lg border p-2.5 shadow-xs ${groupCardClass[g.accent]}`}
              >
                <div className="text-[11px] font-semibold text-app-text">{g.title}</div>
                <ul className="mt-1.5 space-y-1 text-[10px] text-app-muted">
                  {g.items.map((it) => (
                    <li key={it.name}>
                      <span className="font-medium text-app-text">{it.name}</span>
                      {it.note ? <span className="text-app-muted"> — {it.note}</span> : null}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-4 border-t border-app-border pt-3">
          <h3 className="text-[11px] font-semibold uppercase tracking-wide text-app-muted">Quick glossary</h3>
          <div className="mt-2 space-y-1.5">
            {GLOSSARY.map((g) => (
              <details key={g.term} className="group rounded-md border border-app-border bg-app-fill/40 px-2 py-1.5 text-[11px] dark:bg-app-fill/20">
                <summary className="cursor-pointer list-none font-medium text-app-text marker:content-none [&::-webkit-details-marker]:hidden">
                  <span className="text-app-muted group-open:hidden">▸ </span>
                  <span className="hidden text-app-muted group-open:inline">▾ </span>
                  {g.term}
                </summary>
                <p className="mt-1.5 pl-3 text-app-muted">{g.body}</p>
              </details>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

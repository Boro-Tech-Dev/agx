'use client';

import { useEffect, useId, useState } from 'react';

import {
  EDUCATION_OPENING,
  EDUCATION_RAG,
  EDUCATION_TAG,
  homeOperationsEducationList,
  homeToolEducationList,
} from '../../lib/home/homeEducationalCopy';
import { PanelChevron } from '../workspaces/PanelChevron';
import { EducationLinkList } from './EducationLinkList';

const LS_KEY = 'dd.home.educationExpanded';

function readLsBool(key: string, fallback: boolean): boolean {
  if (typeof window === 'undefined') return fallback;
  const v = localStorage.getItem(key);
  if (v == null) return fallback;
  return v === '1' || v === 'true';
}

function writeLs(key: string, value: string) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(key, value);
}

export function HomeEducationExpandable() {
  const [expanded, setExpanded] = useState(() => readLsBool(LS_KEY, false));
  const bodyId = useId();
  const tools = homeToolEducationList();
  const operations = homeOperationsEducationList();

  useEffect(() => {
    writeLs(LS_KEY, expanded ? '1' : '0');
  }, [expanded]);

  return (
    <section className="overflow-hidden rounded-lg border border-app-border bg-app-surface/80 shadow-xs">
      <button
        type="button"
        className="flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left transition-colors hover:bg-app-fill/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-nav-active-border"
        aria-expanded={expanded}
        aria-controls={bodyId}
        onClick={() => setExpanded((v) => !v)}
      >
        <span>
          <span className="block text-[11px] font-semibold text-app-text">Learn more about RagTag</span>
          <span className="mt-0.5 block text-[10px] text-app-muted">
            Full overview of RAG, TAG, tools, and operations
          </span>
        </span>
        <PanelChevron expanded={expanded} />
      </button>
      {expanded ? (
        <div id={bodyId} className="border-t border-app-border px-3 pb-3 pt-2">
          <article className="max-w-3xl space-y-3">
            <p className="text-[12px] leading-relaxed text-app-text">{EDUCATION_OPENING}</p>

            <div className="space-y-2.5 border-t border-app-border/60 pt-2.5">
              <section>
                <h2 className="text-[11px] font-semibold uppercase tracking-wide text-shell-edge-agents">
                  {EDUCATION_RAG.title}
                </h2>
                <p className="mt-1 text-[11px] leading-relaxed text-app-muted">{EDUCATION_RAG.body}</p>
              </section>

              <section>
                <h2 className="text-[11px] font-semibold uppercase tracking-wide text-shell-edge-agents">
                  {EDUCATION_TAG.title}
                </h2>
                <p className="mt-1 text-[11px] leading-relaxed text-app-muted">{EDUCATION_TAG.body}</p>
              </section>
            </div>

            <div className="space-y-2 border-t border-app-border/60 pt-2.5">
              <h2 className="text-[11px] font-semibold uppercase tracking-wide text-app-text">Tools</h2>
              <p className="text-[11px] leading-relaxed text-app-muted">
                The applications under <span className="font-medium text-app-text">Tools</span> in the menu handle
                structured work you can open directly or run in the context of a project.
              </p>
              <EducationLinkList items={tools} />
            </div>

            <div className="space-y-2 border-t border-app-border/60 pt-2.5">
              <h2 className="text-[11px] font-semibold uppercase tracking-wide text-app-text">Operations</h2>
              <p className="text-[11px] leading-relaxed text-app-muted">
                The areas under <span className="font-medium text-app-text">Operations</span> in the menu support
                day-to-day running of the platform—projects, knowledge, outputs, oversight, and health.
              </p>
              <EducationLinkList items={operations} />
            </div>
          </article>
        </div>
      ) : null}
    </section>
  );
}

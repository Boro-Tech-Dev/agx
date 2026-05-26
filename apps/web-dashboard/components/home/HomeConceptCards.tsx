'use client';

import type { ReactNode } from 'react';
import { motion, useReducedMotion } from 'framer-motion';

import { EDUCATION_RAG, EDUCATION_TAG } from '../../lib/home/homeEducationalCopy';

function ConceptCard({
  monogram,
  title,
  body,
  diagram,
}: {
  monogram: string;
  title: string;
  body: string;
  diagram: ReactNode;
}) {
  return (
    <article className="flex h-full flex-col rounded-xl border border-app-border bg-gradient-to-br from-shell-edge-agents/10 to-app-surface p-3 shadow-xs ring-1 ring-inset ring-black/[0.03] dark:ring-white/[0.05]">
      <div className="flex items-start justify-between gap-2">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-app-border bg-app-fill font-mono text-[11px] font-bold text-shell-edge-agents">
          {monogram}
        </span>
        {diagram}
      </div>
      <h3 className="mt-2 text-[11px] font-semibold uppercase tracking-wide text-shell-edge-agents">{title}</h3>
      <p className="mt-1 line-clamp-4 flex-1 text-[10px] leading-snug text-app-muted">{body}</p>
    </article>
  );
}

function RagDiagram() {
  return (
    <svg viewBox="0 0 80 28" className="h-7 w-20 shrink-0 text-app-muted" aria-hidden>
      <rect x="0" y="8" width="22" height="12" rx="3" fill="currentColor" opacity="0.2" />
      <text x="11" y="17" textAnchor="middle" fontSize="7" fill="currentColor">
        docs
      </text>
      <path d="M26 14h10" stroke="currentColor" strokeWidth="1.2" markerEnd="url(#rag-arrow)" />
      <rect x="38" y="8" width="22" height="12" rx="3" fill="currentColor" opacity="0.35" />
      <text x="49" y="17" textAnchor="middle" fontSize="7" fill="currentColor">
        model
      </text>
      <path d="M62 14h10" stroke="currentColor" strokeWidth="1.2" />
      <circle cx="76" cy="14" r="4" fill="currentColor" opacity="0.5" />
      <defs>
        <marker id="rag-arrow" markerWidth="4" markerHeight="4" refX="3" refY="2" orient="auto">
          <path d="M0,0 L4,2 L0,4 Z" fill="currentColor" />
        </marker>
      </defs>
    </svg>
  );
}

function TagDiagram() {
  return (
    <svg viewBox="0 0 80 28" className="h-7 w-20 shrink-0 text-app-muted" aria-hidden>
      {[0, 1, 2].map((col) =>
        [0, 1].map((row) => (
          <rect
            key={`${col}-${row}`}
            x={8 + col * 22}
            y={4 + row * 12}
            width="14"
            height="8"
            rx="2"
            fill="currentColor"
            opacity={0.15 + (col + row) * 0.08}
          />
        )),
      )}
    </svg>
  );
}

export function HomeConceptCards() {
  const reduceMotion = useReducedMotion();

  return (
    <motion.div
      className="grid grid-cols-1 gap-2 tablet:grid-cols-2"
      initial={reduceMotion ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
    >
      <ConceptCard
        monogram="R"
        title={EDUCATION_RAG.title}
        body={EDUCATION_RAG.body}
        diagram={<RagDiagram />}
      />
      <ConceptCard
        monogram="T"
        title={EDUCATION_TAG.title}
        body={EDUCATION_TAG.body}
        diagram={<TagDiagram />}
      />
    </motion.div>
  );
}

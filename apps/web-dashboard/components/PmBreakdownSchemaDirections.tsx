'use client';

import { useState } from 'react';

import { PanelChevron } from './workspaces/PanelChevron';

/**
 * Summarizes worker `PM_SCHEMA_BUSINESS` / `PM_SCHEMA_PERSONAL` from
 * `apps/agent-worker/worker/workflows/schemas.py` for the breakdown input panel.
 */
export function PmBreakdownSchemaDirections({ variant }: { variant: 'business' | 'personal' }) {
  const personal = variant === 'personal';
  const [open, setOpen] = useState(false);
  return (
    <details
      className="mt-2 rounded-md border border-app-border bg-app-fill/80 p-2 text-[10px] leading-snug text-app-text open:pb-2"
      open={open}
      onToggle={(e) => setOpen(e.currentTarget.open)}
    >
      <summary className="flex cursor-pointer list-none items-center justify-between gap-2 font-semibold text-app-muted [&::-webkit-details-marker]:hidden">
        <span>Structured output shape (JSON the model fills)</span>
        <span className="pointer-events-none shrink-0" aria-hidden>
          <PanelChevron expanded={open} />
        </span>
      </summary>
      <p className="mt-1.5 text-app-muted">
        You write natural language below. The run&apos;s structured result is JSON with these top-level properties (aligned
        with the worker schema{personal ? ' — Synergy uses the personal variant' : ''}).
      </p>
      <div className="mt-1.5 space-y-1.5">
        <div>
          <div className="font-semibold text-app-text">Required</div>
          <ul className="mt-0.5 list-inside list-disc text-app-muted">
            <li>
              <span className="font-mono text-app-text">summary</span> — string
            </li>
            <li>
              <span className="font-mono text-app-text">tasks</span> — array of objects; each needs{' '}
              <span className="font-mono text-app-text">title</span> (optional: description, priority, status, owner, due_date,
              dependencies, acceptance_criteria)
            </li>
            <li>
              <span className="font-mono text-app-text">risks</span> — array of objects; each needs{' '}
              <span className="font-mono text-app-text">risk</span> (optional: impact, likelihood, mitigation)
            </li>
            <li>
              <span className="font-mono text-app-text">recommended_next_actions</span> — array of strings
            </li>
          </ul>
        </div>
        <div>
          <div className="font-semibold text-app-text">Optional top-level</div>
          <ul className="mt-0.5 list-inside list-disc text-app-muted">
            <li>
              <span className="font-mono text-app-text">project_context</span> — string
            </li>
            <li>
              <span className="font-mono text-app-text">assumptions</span> — array of strings
            </li>
            {personal && (
              <li>
                <span className="font-mono text-app-text">open_questions</span> — array of strings
              </li>
            )}
            <li>
              <span className="font-mono text-app-text">decisions</span> — objects with required <span className="font-mono text-app-text">title</span>{' '}
              (optional: decision, description, status)
            </li>
            <li>
              <span className="font-mono text-app-text">costs</span> — objects with required <span className="font-mono text-app-text">title</span>{' '}
              (optional: cost, description, note, amount)
            </li>
            <li>
              <span className="font-mono text-app-text">anomalies</span> — objects with required <span className="font-mono text-app-text">title</span>{' '}
              (optional: anomaly, note, description)
            </li>
            {personal && (
              <li>
                <span className="font-mono text-app-text">reflections</span> — strings (personal / Synergy only)
              </li>
            )}
          </ul>
        </div>
      </div>
    </details>
  );
}

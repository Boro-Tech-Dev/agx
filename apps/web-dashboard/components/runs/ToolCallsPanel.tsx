'use client';

import { useMemo } from 'react';

type RunEvent = {
  id?: string;
  event_type?: string;
  message?: string;
  payload?: Record<string, unknown>;
  created_at?: string;
};

export function ToolCallsPanel({ events }: { events: RunEvent[] }) {
  const toolEvents = useMemo(
    () =>
      (events || []).filter(
        (ev) =>
          typeof ev.event_type === 'string' &&
          (ev.event_type.startsWith('tool.call.') || ev.event_type.startsWith('model.router.tools')),
      ),
    [events],
  );
  if (!toolEvents.length) return null;
  return (
    <section className="mb-4 rounded-lg border border-app-border bg-app-surface p-2 shadow-xs">
      <h2 className="text-xs font-semibold text-app-text">Tool calls</h2>
      <p className="text-[10px] text-app-muted">Autonomous tool-loop events from model-router and worker.</p>
      <ul className="mt-2 max-h-40 space-y-1 overflow-auto text-[11px]">
        {toolEvents.map((ev) => (
          <li key={ev.id ?? `${ev.event_type}-${ev.created_at}`} className="rounded border border-app-border/60 bg-app-fill p-1.5">
            <span className="font-medium text-app-text">{ev.event_type}</span>
            <span className="text-app-muted"> — {ev.message}</span>
            {ev.payload && typeof ev.payload === 'object' ? (
              <pre className="mt-1 max-h-24 overflow-auto text-[9px] text-app-muted">
                {JSON.stringify(ev.payload, null, 0)}
              </pre>
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  );
}

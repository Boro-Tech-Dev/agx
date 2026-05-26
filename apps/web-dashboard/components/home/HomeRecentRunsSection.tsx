'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

import { formatRunTotalTimeForList } from '../../lib/runDuration';
import { StatusPill } from '../ui/ragtag/StatusPill';
import { statusToVariant } from '../../lib/ragtag/statusVariants';
import { PanelChevron } from '../workspaces/PanelChevron';

const LS_KEY = 'dd.home.recentRunsExpanded';

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

export function HomeRecentRunsSection({
  runs,
  embedded = false,
  onSelectRun,
  selectedRunId,
}: {
  runs: any[];
  embedded?: boolean;
  onSelectRun?: (runId: string) => void;
  selectedRunId?: string | null;
}) {
  const [expanded, setExpanded] = useState(() => readLsBool(LS_KEY, true));
  const bodyId = 'home-recent-runs-body';

  useEffect(() => {
    writeLs(LS_KEY, expanded ? '1' : '0');
  }, [expanded]);

  return (
    <section
      className={`${embedded ? 'mt-0' : 'mt-3'} border border-rt-panel bg-rt-charcoal/40 p-2.5`}
    >
      <div className="flex flex-wrap items-start justify-between gap-2 border-b border-rt-panel pb-2">
        <h2 className="font-mono text-xs font-semibold uppercase tracking-widest text-rt-ice">
          Recent runs
        </h2>
        <button
          type="button"
          className="flex shrink-0 items-center justify-center rounded px-1 py-0.5 text-rt-ice/60 hover:bg-rt-panel"
          aria-label={expanded ? 'Collapse Recent Runs' : 'Expand Recent Runs'}
          aria-expanded={expanded}
          aria-controls={bodyId}
          onClick={() => setExpanded((v) => !v)}
        >
          <PanelChevron expanded={expanded} />
        </button>
      </div>
      <div id={bodyId} className={expanded ? 'min-w-0' : 'hidden'}>
        <div className="mt-2 -mx-1 min-w-0 overflow-x-auto px-1 tablet:mx-0 tablet:px-0">
          <table className="w-full min-w-[40rem] text-left font-mono text-[11px]">
            <thead className="text-[10px] uppercase tracking-wide text-rt-ice/50">
              <tr>
                <th className="px-2 py-1">Agent</th>
                <th className="px-2 py-1">Status</th>
                <th className="px-2 py-1">Model</th>
                <th className="px-2 py-1">Created</th>
                <th className="px-2 py-1 whitespace-nowrap">Total time</th>
                <th className="px-2 py-1">Trace</th>
                <th className="px-2 py-1">Open</th>
              </tr>
            </thead>
            <tbody>
              {runs.slice(0, 12).map((r: any) => {
                const id = String(r.id);
                const selected = selectedRunId === id;
                return (
                  <tr
                    key={r.id}
                    className={`border-t border-rt-panel even:bg-rt-black/30 ${selected ? 'bg-rt-cyan/10' : ''}`}
                  >
                    <td className="px-2 py-1 font-medium text-rt-white">{r.agent_key}</td>
                    <td className="px-2 py-1">
                      <StatusPill status={r.status} variant={statusToVariant(r.status)} />
                    </td>
                    <td className="px-2 py-1 text-rt-ice/60">{r.model_used || '—'}</td>
                    <td className="px-2 py-1 text-rt-ice/60">{r.created_at}</td>
                    <td className="px-2 py-1 tabular-nums text-rt-ice/60">
                      {formatRunTotalTimeForList(r)}
                    </td>
                    <td className="px-2 py-1">
                      {onSelectRun ? (
                        <button
                          type="button"
                          onClick={() => onSelectRun(id)}
                          className={`font-semibold uppercase tracking-wide ${
                            selected
                              ? 'text-rt-cyan'
                              : 'text-rt-yellow hover:text-rt-cyan'
                          }`}
                        >
                          {selected ? 'focused' : 'focus'}
                        </button>
                      ) : null}
                    </td>
                    <td className="px-2 py-1">
                      <Link
                        className="font-semibold text-rt-cyan hover:text-rt-white"
                        href={`/runs/${r.id}`}
                      >
                        view
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}

'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Check,
  Clock,
  FileUp,
  HelpCircle,
  Zap,
  AlertTriangle,
} from 'lucide-react';

import { getRun, getRunEvents } from '../../../lib/api';
import {
  computeFlowStages,
  FLOW_STAGES,
  type FlowStageStatus,
} from '../../../lib/ragtag/operatorFlowStages';
import { cn } from '../../../lib/cn';

const STAGE_ICONS = [FileUp, HelpCircle, Zap, Clock, Check, Check];

function stageIcon(status: FlowStageStatus) {
  if (status === 'complete') return Check;
  if (status === 'failed') return AlertTriangle;
  if (status === 'active') return Zap;
  return Clock;
}

export function OperatorFlow({ runId }: { runId?: string | null }) {
  const [events, setEvents] = useState<{ id?: string | number; event_type?: string; created_at?: string }[]>(
    [],
  );
  const [runStatus, setRunStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!runId) {
      setEvents([]);
      setRunStatus(null);
      return;
    }
    let cancelled = false;

    async function load() {
      try {
        const [r, e] = await Promise.all([getRun(runId), getRunEvents(runId)]);
        if (cancelled) return;
        setRunStatus(typeof r?.status === 'string' ? r.status : null);
        setEvents(Array.isArray(e) ? e : []);
        setError(null);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err));
      }
    }

    void load();
    const t = setInterval(() => void load(), 2000);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, [runId]);

  const stages = useMemo(() => computeFlowStages(events, runStatus), [events, runStatus]);

  if (!runId) {
    return (
      <p className="py-4 text-center font-mono text-[10px] uppercase tracking-widest text-rt-ice/50">
        Select a run to trace the operator pipeline
      </p>
    );
  }

  if (error) {
    return <p className="text-[10px] text-rt-orange">{error}</p>;
  }

  return (
    <div className="relative flex flex-col space-y-0">
      <div className="absolute bottom-8 left-[19px] top-4 z-0 w-px border-l border-dashed border-rt-panel/50" />
      {FLOW_STAGES.map((stage, idx) => {
        const computed = stages.find((s) => s.stageId === stage.id)!;
        const status = computed.status;
        const isActive = status === 'active';
        const isComplete = status === 'complete';
        const isFailed = status === 'failed';
        const Icon = stageIcon(status);
        const FallbackIcon = STAGE_ICONS[idx] ?? Clock;

        return (
          <div key={stage.id} className="relative z-10 flex flex-col">
            <div className="flex items-start gap-4 py-3">
              <div
                className={cn(
                  'flex h-10 w-10 shrink-0 items-center justify-center rounded border bg-rt-black transition-colors',
                  isActive && 'border-rt-cyan text-rt-cyan shadow-[0_0_10px_rgba(0,187,211,0.2)]',
                  isComplete && 'border-rt-panel text-rt-ice/50',
                  isFailed && 'border-rt-orange text-rt-orange',
                  status === 'queued' && 'border-rt-panel/50 text-rt-panel/50',
                )}
              >
                {isComplete ? (
                  <Check className="h-4 w-4" />
                ) : (
                  <FallbackIcon className={cn('h-4 w-4', isActive && 'motion-safe:animate-pulse')} />
                )}
              </div>

              <div
                className={cn(
                  'flex flex-1 flex-col border p-3 transition-colors',
                  isActive && 'border-rt-cyan bg-rt-cyan/5',
                  isComplete && 'border-rt-panel bg-rt-charcoal/50',
                  isFailed && 'border-rt-orange/50 bg-rt-orange/5',
                  status === 'queued' && 'border-rt-panel/30 bg-rt-black',
                )}
              >
                <div className="mb-1 flex items-start justify-between">
                  <span
                    className={cn(
                      'text-xs font-bold uppercase tracking-wider',
                      isActive ? 'text-rt-white' : isComplete ? 'text-rt-ice' : 'text-rt-panel',
                    )}
                  >
                    {idx + 1}. {stage.label}
                  </span>
                  <span className="font-mono text-[9px] opacity-50 text-rt-ice">
                    {computed.time ?? ''}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {computed.eventId ? (
                    <span
                      className={cn(
                        'rounded-sm px-1 font-mono text-[10px]',
                        isActive ? 'bg-rt-cyan text-rt-black' : 'border border-rt-panel/50 text-rt-panel',
                      )}
                    >
                      {computed.eventId.slice(0, 8)}
                    </span>
                  ) : null}
                  {isActive ? (
                    <span className="animate-pulse text-[9px] uppercase tracking-widest text-rt-cyan">
                      Processing…
                    </span>
                  ) : null}
                  {isFailed ? (
                    <span className="text-[9px] uppercase tracking-widest text-rt-orange">Failed</span>
                  ) : null}
                </div>
              </div>
            </div>
            {idx < FLOW_STAGES.length - 1 ? <div className="h-4" /> : null}
          </div>
        );
      })}
    </div>
  );
}

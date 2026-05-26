export type FlowStageId =
  | 'ask_received'
  | 'clarify'
  | 'route'
  | 'generate'
  | 'review'
  | 'resolve';

export type FlowStageStatus = 'queued' | 'active' | 'complete' | 'failed';

export type FlowStage = {
  id: FlowStageId;
  label: string;
  order: number;
};

export const FLOW_STAGES: FlowStage[] = [
  { id: 'ask_received', label: 'Ask received', order: 0 },
  { id: 'clarify', label: 'Clarify ambiguity', order: 1 },
  { id: 'route', label: 'Route to tool', order: 2 },
  { id: 'generate', label: 'Generate artifact', order: 3 },
  { id: 'review', label: 'Review / approve', order: 4 },
  { id: 'resolve', label: 'Resolve', order: 5 },
];

const TERMINAL_FAIL = new Set(['failed', 'degraded', 'cancelled', 'run.failed', 'run.degraded']);

const TERMINAL_OK = new Set(['completed', 'run.completed']);

const TERMINAL_REVIEW = new Set(['needs_approval', 'run.needs_approval']);

function normalizeEventType(t: string): string {
  return (t || '').trim().toLowerCase();
}

export function stageForEventType(eventType: string): FlowStageId | null {
  const t = normalizeEventType(eventType);
  if (!t) return null;
  if (t === 'run.queued') return 'ask_received';
  if (t.startsWith('ask_clarifier') || t.includes('clarifier')) return 'clarify';
  if (t.startsWith('workflow.') || t.startsWith('project.')) return 'route';
  if (
    t.startsWith('model.') ||
    t.startsWith('memory.embed') ||
    t.startsWith('artifact.') ||
    t.startsWith('persist_items.')
  ) {
    return 'generate';
  }
  if (t.startsWith('approval.') || TERMINAL_REVIEW.has(t)) return 'review';
  if (TERMINAL_OK.has(t) || TERMINAL_FAIL.has(t) || t === 'run.cancelled') return 'resolve';
  if (t === 'run.started') return 'route';
  return null;
}

export type StageComputation = {
  stageId: FlowStageId;
  status: FlowStageStatus;
  eventId?: string;
  time?: string;
};

export function computeFlowStages(
  events: { id?: string | number; event_type?: string; created_at?: string }[],
  runStatus?: string | null,
): StageComputation[] {
  const hits: Partial<
    Record<FlowStageId, { eventId?: string; time?: string; failed?: boolean; lastOrder: number }>
  > = {};

  events.forEach((ev, idx) => {
    const stage = stageForEventType(String(ev.event_type ?? ''));
    if (!stage) return;
    const t = normalizeEventType(String(ev.event_type ?? ''));
    const failed = TERMINAL_FAIL.has(t) || t.endsWith('.failed') || t.includes('enqueue_failed');
    const existing = hits[stage];
    if (!existing || idx >= existing.lastOrder) {
      hits[stage] = {
        eventId: ev.id != null ? String(ev.id) : undefined,
        time: ev.created_at ? String(ev.created_at) : undefined,
        failed,
        lastOrder: idx,
      };
    }
  });

  const rs = normalizeEventType(runStatus ?? '');
  const runTerminal = TERMINAL_OK.has(rs) || TERMINAL_FAIL.has(rs) || rs === 'cancelled' || rs === 'needs_approval';

  let highestComplete = -1;
  for (const s of FLOW_STAGES) {
    if (hits[s.id]) highestComplete = Math.max(highestComplete, s.order);
  }

  let activeOrder = runTerminal ? FLOW_STAGES.length : highestComplete + 1;
  if (activeOrder > FLOW_STAGES.length - 1) activeOrder = FLOW_STAGES.length - 1;

  return FLOW_STAGES.map((s) => {
    const hit = hits[s.id];
    if (hit?.failed) {
      return { stageId: s.id, status: 'failed' as const, eventId: hit.eventId, time: hit.time };
    }
    if (s.order < highestComplete || (hit && s.order <= highestComplete)) {
      return { stageId: s.id, status: 'complete' as const, eventId: hit?.eventId, time: hit?.time };
    }
    if (s.order === activeOrder && !runTerminal) {
      return { stageId: s.id, status: 'active' as const, eventId: hit?.eventId, time: hit?.time ?? 'In Progress' };
    }
    return { stageId: s.id, status: 'queued' as const, time: 'Waiting' };
  });
}

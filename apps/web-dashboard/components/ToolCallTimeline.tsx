import {
  eventStripeBorderClass,
  latestEventIdFromList,
  latestEventRowRingClass,
} from '../lib/runEventStripe';

export function ToolCallTimeline({
  events = [],
  highlightLatestWhileActive = false,
}: {
  events?: { id?: string | number; event_type?: string; message?: string }[];
  /** When true and last event exists, ring the last row (caller passes whether parent run is non-terminal). */
  highlightLatestWhileActive?: boolean;
}) {
  const latestId = latestEventIdFromList(events);
  return (
    <div className="space-y-1.5">
      {events.map((e, i) => (
        <div
          key={e.id || i}
          className={`rounded-md border-l-4 ${eventStripeBorderClass(e.event_type || '')} bg-app-surface p-2 text-[11px] shadow-xs ${latestEventRowRingClass(e.id, latestId, highlightLatestWhileActive)}`}
        >
          <div className="font-semibold text-app-text">{e.event_type}</div>
          <div className="text-app-muted">{e.message}</div>
        </div>
      ))}
    </div>
  );
}

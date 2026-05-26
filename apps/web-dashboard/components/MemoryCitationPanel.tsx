function memoryBodyText(m: Record<string, unknown>): string {
  const raw =
    m.body ??
    m.message ??
    m.content ??
    m.text ??
    m.full_text ??
    m.excerpt;
  if (raw == null) return '';
  if (typeof raw === 'string') return raw;
  if (typeof raw === 'object') return JSON.stringify(raw, null, 2);
  return String(raw);
}

function displayTitle(m: Record<string, unknown>, body: string): string {
  const t = (m.title as string | undefined)?.trim();
  if (t && t.toLowerCase() !== 'memory') return t;
  const first = body.split(/\r?\n/).find((line) => line.trim())?.trim();
  if (first) return first.length > 120 ? `${first.slice(0, 117)}…` : first;
  return 'Referenced memory';
}

export function MemoryCitationPanel({ memories = [] }: { memories?: any[] }) {
  if (!memories.length) return <div className="text-[11px] text-app-muted">No memory citations.</div>;
  return (
    <div className="grid gap-1.5">
      {memories.map((m, i) => {
        const body = memoryBodyText(m);
        const title = displayTitle(m, body);
        const kind = m.source_type || m.memory_type || m.type || m.source_kind;
        return (
          <div
            key={m.memory_id || m.id || i}
            className="rounded-md border border-app-border border-l-4 border-l-emerald-500 bg-app-surface p-2 text-[11px] shadow-xs"
          >
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0 font-semibold text-emerald-700 dark:text-emerald-300">{title}</div>
              {kind ? (
                <span className="shrink-0 rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-200">
                  {String(kind)}
                </span>
              ) : null}
            </div>
            {body ? (
              <div className="mt-1 max-h-80 overflow-auto whitespace-pre-wrap break-words text-app-muted">{body}</div>
            ) : (
              <div className="mt-1 text-app-muted">No message text stored for this citation.</div>
            )}
          </div>
        );
      })}
    </div>
  );
}

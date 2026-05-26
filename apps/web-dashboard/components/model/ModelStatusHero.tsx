import type { ModelStatusPayload } from '../../lib/modelStatusTypes';

export function ModelStatusHero({ data }: { data: ModelStatusPayload }) {
  const required = data.required;
  const missing = required.filter((r) => !r.satisfied).map((r) => r.id);
  const reachable = data.ok === true;
  const modelsReady =
    typeof data.models_ready === 'boolean' ? data.models_ready : missing.length === 0;
  const modelsRunnable = data.models_runnable !== false;
  const ollama = data.backends.ollama;

  const tone = !reachable ? 'rose' : !modelsReady || !modelsRunnable ? 'amber' : 'emerald';
  const ring =
    tone === 'rose'
      ? 'border-rose-200 bg-rose-50 dark:border-rose-500/35 dark:bg-rose-500/10'
      : tone === 'amber'
        ? 'border-amber-200 bg-amber-50 dark:border-amber-500/35 dark:bg-amber-500/10'
        : 'border-emerald-200 bg-emerald-50 dark:border-emerald-500/35 dark:bg-emerald-500/10';
  const dot = tone === 'rose' ? 'bg-rose-500' : tone === 'amber' ? 'bg-amber-500' : 'bg-emerald-500';

  const headline = !reachable
    ? 'Model status endpoint error'
    : !modelsReady
      ? 'Router reachable — required models missing'
      : !modelsRunnable
        ? 'Models present — probe failed for one or more models'
        : 'Router OK — required models present and runnable';

  const sublines: string[] = [];
  if (!reachable && data.error) sublines.push(data.error);
  if (reachable && !modelsReady) sublines.push(`Missing: ${missing.join(', ') || 'unknown'}`);
  if (reachable && modelsReady && !modelsRunnable) {
    const failed = required.filter((r) => r.satisfied && !r.runnable);
    const names = failed.map((r) => r.id).join(', ');
    sublines.push(names ? `Not runnable: ${names}` : 'One or more models failed the live probe.');
  }

  return (
    <div className={`rounded-xl border p-4 shadow-xs backdrop-blur-sm ${ring}`}>
      <div className="min-w-0">
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1.5">
          <span className={`inline-block h-2.5 w-2.5 shrink-0 self-center rounded-full ${dot} motion-safe:animate-pulse`} />
          <h2
            className={`text-base font-semibold tracking-tight ${
              tone === 'rose'
                ? 'text-rose-800 dark:text-rose-100'
                : tone === 'amber'
                  ? 'text-amber-900 dark:text-amber-100'
                  : 'text-emerald-800 dark:text-emerald-100'
            }`}
          >
            {headline}
          </h2>
          {ollama ? (
            <>
              <span className="hidden tablet:inline text-app-muted/70" aria-hidden>
                ·
              </span>
              <span className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 text-[11px] text-app-muted">
                <span className="font-semibold uppercase tracking-wide text-app-text">Ollama</span>
                <span className="font-mono text-[10px] break-all text-app-muted">
                  {ollama.base_url ?? '(no base URL)'}
                </span>
                <span>
                  Reachable:{' '}
                  <span
                    className={
                      ollama.reachable ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
                    }
                  >
                    {ollama.reachable === true ? 'yes' : ollama.reachable === false ? 'no' : '—'}
                  </span>
                </span>
                <span>Installed: {ollama.installed?.length ?? 0}</span>
              </span>
            </>
          ) : null}
        </div>
        {ollama?.error ? (
          <p className="mt-1.5 pl-4 text-[12px] text-rose-600 dark:text-rose-400">{ollama.error}</p>
        ) : null}
        {sublines.map((s) => (
          <p key={s} className="mt-1.5 pl-4 text-[12px] leading-snug text-app-text">
            {s}
          </p>
        ))}
      </div>
    </div>
  );
}

import type { ModelOverviewPayload } from '../../lib/modelOverviewTypes';
import { ModelStatusHero } from './ModelStatusHero';

export function ModelOverviewHero({ data }: { data: ModelOverviewPayload }) {
  const rerankerFailed = data.reranker_health.filter((h) => !h.ok);
  const compositeOk =
    data.ollama.ok === true &&
    data.ollama.models_ready === true &&
    data.ollama.models_runnable === true &&
    rerankerFailed.length === 0;

  const tone = !data.ollama.ok ? 'rose' : !compositeOk ? 'amber' : 'emerald';
  const ring =
    tone === 'rose'
      ? 'border-rose-200 bg-rose-50 dark:border-rose-500/35 dark:bg-rose-500/10'
      : tone === 'amber'
        ? 'border-amber-200 bg-amber-50 dark:border-amber-500/35 dark:bg-amber-500/10'
        : 'border-emerald-200 bg-emerald-50 dark:border-emerald-500/35 dark:bg-emerald-500/10';
  const dot = tone === 'rose' ? 'bg-rose-500' : tone === 'amber' ? 'bg-amber-500' : 'bg-emerald-500';

  const headline = !data.ollama.ok
    ? 'AI stack partially unreachable'
    : !compositeOk
      ? 'Stack reachable — some components need attention'
      : 'AI stack healthy';

  const sublines: string[] = [];
  if (data.errors.length > 0) {
    sublines.push(data.errors.slice(0, 2).join('; '));
  }
  if (rerankerFailed.length > 0) {
    sublines.push(
      `Reranker probe failed: ${rerankerFailed.map((h) => h.reranker_id).join(', ')}`,
    );
  }

  return (
    <div className="space-y-3">
      <div className={`rounded-xl border p-4 shadow-xs backdrop-blur-sm ${ring}`}>
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1.5">
          <span className={`inline-block h-2.5 w-2.5 shrink-0 rounded-full ${dot} motion-safe:animate-pulse`} />
          <h2 className="text-base font-semibold tracking-tight text-app-text">{headline}</h2>
          <span className="text-[11px] text-app-muted">
            {data.catalog.embedders.length} embedders · {data.catalog.rerankers.length} rerankers ·{' '}
            {data.lanes.agents.length} agents
          </span>
        </div>
        {sublines.map((s) => (
          <p key={s} className="mt-1.5 pl-4 text-[12px] leading-snug text-app-text">
            {s}
          </p>
        ))}
      </div>
      <ModelStatusHero data={data.ollama} />
    </div>
  );
}

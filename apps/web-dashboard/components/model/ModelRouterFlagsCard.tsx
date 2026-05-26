import type { RouterFeatures } from '../../lib/modelOverviewTypes';

function Flag({ label, value }: { label: string; value: string | boolean | number | undefined }) {
  const display =
    typeof value === 'boolean' ? (value ? 'yes' : 'no') : value === undefined ? '—' : String(value);
  return (
    <div className="flex justify-between gap-4 border-b border-app-border/50 py-1.5 last:border-0">
      <dt className="text-app-muted">{label}</dt>
      <dd className="font-mono text-[11px] text-app-text">{display}</dd>
    </div>
  );
}

export function ModelRouterFlagsCard({ features }: { features: RouterFeatures }) {
  return (
    <section className="rounded-xl border border-app-border bg-app-surface/60 p-4">
      <h2 className="text-sm font-semibold text-app-text">Router diagnostics</h2>
      <p className="mt-1 text-[12px] text-app-muted">Read-only flags from model-router and compose env.</p>
      <dl className="mt-3 text-[12px]">
        <Flag label="Ollama probe chat" value={features.ollama_probe_chat} />
        <Flag label="Grammar failure fallback" value={features.ollama_grammar_failure_fallback} />
        <Flag label="PM schema fallback" value={features.pm_schema_fallback} />
        <Flag label="KITT grammar mode" value={features.kitt_router_grammar_mode} />
        <Flag label="Default embed model" value={features.default_embed_model} />
        <Flag label="Embedding dim override" value={features.embedding_dim} />
        <Flag label="Ollama pull enabled" value={features.ollama_pull_enabled} />
      </dl>
    </section>
  );
}

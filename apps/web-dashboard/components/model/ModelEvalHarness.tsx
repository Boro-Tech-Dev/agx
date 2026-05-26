'use client';

import { useCallback, useEffect, useState } from 'react';

export function ModelEvalHarness() {
  const [summary, setSummary] = useState<string | null>(null);
  const [path, setPath] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadLatest = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/retrieval/eval/latest');
      if (!res.ok) return;
      const j = (await res.json()) as { markdown?: string | null; path?: string | null };
      setSummary(j.markdown ?? null);
      setPath(j.path ?? null);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    void loadLatest();
  }, [loadLatest]);

  const runEval = async () => {
    setRunning(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/retrieval/eval/run', { method: 'POST' });
      const j = (await res.json()) as { markdown?: string; detail?: string; ok?: boolean };
      if (!res.ok) throw new Error(j.detail ?? 'Eval failed');
      setSummary(j.markdown ?? JSON.stringify(j, null, 2));
      await loadLatest();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setRunning(false);
    }
  };

  return (
    <section className="rounded-xl border border-app-border bg-app-surface/60 p-4">
      <h2 className="text-sm font-semibold text-app-text">Eval harness</h2>
      <p className="mt-1 text-[12px] text-app-muted">
        Retrieval quality matrix (embedder × reranker) via{' '}
        <span className="font-mono">scripts/retrieval_eval.py</span>.
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button
          type="button"
          className="rounded-lg border border-app-border bg-app-surface px-3 py-1.5 text-[12px] font-medium hover:bg-app-surface/80 disabled:opacity-50"
          disabled={running}
          onClick={() => void runEval()}
        >
          {running ? 'Running…' : 'Run eval (API)'}
        </button>
        {path ? <span className="font-mono text-[10px] text-app-muted">{path}</span> : null}
      </div>
      {error ? (
        <p className="mt-2 text-[12px] text-rose-600 dark:text-rose-400">{error}</p>
      ) : null}
      {summary ? (
        <pre className="mt-3 max-h-64 overflow-auto whitespace-pre-wrap rounded-lg border border-app-border bg-app-surface/80 p-3 text-[11px] leading-relaxed">
          {summary}
        </pre>
      ) : (
        <p className="mt-2 text-[12px] text-app-muted">No eval report yet.</p>
      )}
    </section>
  );
}

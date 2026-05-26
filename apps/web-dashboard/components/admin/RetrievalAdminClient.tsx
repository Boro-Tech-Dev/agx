'use client';

import { useCallback, useEffect, useState } from 'react';

type AgentRow = {
  agent: string;
  embedder_id: string;
  reranker_id: string;
  top_k_retrieve: number;
  top_k_rerank: number;
  embedder_display?: string;
  reranker_display?: string;
};

type CatalogResponse = {
  agents: AgentRow[];
  embedders: { embedder_id: string; display_name: string; dim: number }[];
  rerankers: { reranker_id: string; display_name: string }[];
  missing_embeddings: Record<string, number>;
};

export function RetrievalAdminClient() {
  const [data, setData] = useState<CatalogResponse | null>(null);
  const [draft, setDraft] = useState<Record<string, AgentRow>>({});
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState<string | null>(null);
  const [backfillEmbedder, setBackfillEmbedder] = useState<string | null>(null);
  const [backfillLog, setBackfillLog] = useState<string[]>([]);
  const [evalSummary, setEvalSummary] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/retrieval/agents');
      if (!res.ok) throw new Error(await res.text());
      const json = (await res.json()) as CatalogResponse;
      setData(json);
      const d: Record<string, AgentRow> = {};
      for (const a of json.agents || []) d[a.agent] = { ...a };
      setDraft(d);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, []);

  useEffect(() => {
    load();
    fetch('/api/admin/retrieval/eval/latest')
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => j?.markdown && setEvalSummary(j.markdown))
      .catch(() => {});
  }, [load]);

  const saveAgent = async (agent: string) => {
    const row = draft[agent];
    if (!row) return;
    setSaving(agent);
    try {
      const res = await fetch(`/api/admin/retrieval/agents/${agent}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          embedder_id: row.embedder_id,
          reranker_id: row.reranker_id,
          top_k_retrieve: row.top_k_retrieve,
          top_k_rerank: row.top_k_rerank,
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(null);
    }
  };

  const runBackfill = async (embedderId: string) => {
    setBackfillEmbedder(embedderId);
    setBackfillLog([]);
    try {
      const res = await fetch('/api/admin/retrieval/embed/backfill', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ embedder_id: embedderId, source_type: 'all', dry_run: false, batch_size: 15 }),
      });
      if (!res.ok || !res.body) throw new Error(await res.text());
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let buf = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        const lines = buf.split('\n');
        buf = lines.pop() || '';
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            setBackfillLog((prev) => [...prev.slice(-40), line.slice(6)]);
          }
        }
      }
      await load();
    } catch (e) {
      setBackfillLog((prev) => [...prev, `error: ${e}`]);
    } finally {
      setBackfillEmbedder(null);
    }
  };

  if (!data) {
    return <p className="text-sm text-muted-foreground">{error || 'Loading…'}</p>;
  }

  return (
    <div className="space-y-8">
      {error && (
        <p className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800 dark:border-rose-500/40 dark:bg-rose-500/10 dark:text-rose-200">
          {error}
        </p>
      )}

      <section className="rounded-xl border p-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Embedding backfill</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Missing rows in the unified embeddings table (run backfill after enabling a new embedder).
        </p>
        <ul className="mt-3 flex flex-wrap gap-2">
          {data.embedders.map((e) => (
            <li key={e.embedder_id} className="flex items-center gap-2 rounded-lg border px-3 py-2 text-sm">
              <span>
                {e.display_name} — missing {data.missing_embeddings[e.embedder_id] ?? 0}
              </span>
              <button
                type="button"
                disabled={backfillEmbedder === e.embedder_id}
                className="rounded bg-primary px-2 py-1 text-xs text-primary-foreground disabled:opacity-50"
                onClick={() => runBackfill(e.embedder_id)}
              >
                {backfillEmbedder === e.embedder_id ? 'Running…' : 'Backfill'}
              </button>
            </li>
          ))}
        </ul>
        {backfillLog.length > 0 && (
          <pre className="mt-3 max-h-40 overflow-auto rounded bg-muted/50 p-2 text-xs">{backfillLog.join('\n')}</pre>
        )}
      </section>

      <section className="overflow-x-auto rounded-xl border">
        <p className="border-b bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
          ColBERT catalog entries (<code className="font-mono">colbert_gte_modern</code>,{' '}
          <code className="font-mono">colbert_jina_v2</code>) share one sidecar at{' '}
          <code className="font-mono">reranker-colbert:8097</code>; flip the active model with{' '}
          <code className="font-mono">COLBERT_MODEL</code> on that service.
        </p>
        <table className="w-full text-left text-sm">
          <thead className="border-b bg-muted/30 text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-3 py-2">Agent</th>
              <th className="px-3 py-2">Embedder</th>
              <th className="px-3 py-2">Reranker</th>
              <th className="px-3 py-2">Retrieve K</th>
              <th className="px-3 py-2">Rerank K</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {Object.keys(draft)
              .sort()
              .map((agent) => {
                const row = draft[agent];
                return (
                  <tr key={agent} className="border-b last:border-0">
                    <td className="px-3 py-2 font-medium">{agent}</td>
                    <td className="px-3 py-2">
                      <select
                        className="w-full max-w-[200px] rounded border bg-background px-2 py-1"
                        value={row.embedder_id}
                        onChange={(ev) =>
                          setDraft((d) => ({
                            ...d,
                            [agent]: { ...row, embedder_id: ev.target.value },
                          }))
                        }
                      >
                        {data.embedders.map((e) => (
                          <option key={e.embedder_id} value={e.embedder_id}>
                            {e.display_name} ({e.dim}d)
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-3 py-2">
                      <select
                        className="w-full max-w-[200px] rounded border bg-background px-2 py-1"
                        value={row.reranker_id}
                        onChange={(ev) =>
                          setDraft((d) => ({
                            ...d,
                            [agent]: { ...row, reranker_id: ev.target.value },
                          }))
                        }
                      >
                        {data.rerankers.map((r) => (
                          <option key={r.reranker_id} value={r.reranker_id}>
                            {r.display_name}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="number"
                        min={5}
                        max={200}
                        className="w-16 rounded border px-2 py-1"
                        value={row.top_k_retrieve}
                        onChange={(ev) =>
                          setDraft((d) => ({
                            ...d,
                            [agent]: { ...row, top_k_retrieve: Number(ev.target.value) },
                          }))
                        }
                      />
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="number"
                        min={1}
                        max={50}
                        className="w-16 rounded border px-2 py-1"
                        value={row.top_k_rerank}
                        onChange={(ev) =>
                          setDraft((d) => ({
                            ...d,
                            [agent]: { ...row, top_k_rerank: Number(ev.target.value) },
                          }))
                        }
                      />
                    </td>
                    <td className="px-3 py-2">
                      <button
                        type="button"
                        className="rounded border px-2 py-1 text-xs hover:bg-muted"
                        disabled={saving === agent}
                        onClick={() => saveAgent(agent)}
                      >
                        {saving === agent ? 'Saving…' : 'Save'}
                      </button>
                    </td>
                  </tr>
                );
              })}
          </tbody>
        </table>
      </section>

      <section className="rounded-xl border p-4">
        <h2 className="text-sm font-semibold">Eval harness</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Run <code className="rounded bg-muted px-1">python scripts/retrieval_eval.py</code> locally, or trigger via API.
        </p>
        <button
          type="button"
          className="mt-2 rounded border px-3 py-1 text-sm hover:bg-muted"
          onClick={async () => {
            const res = await fetch('/api/admin/retrieval/eval/run', { method: 'POST' });
            const j = await res.json();
            setEvalSummary(j.markdown || JSON.stringify(j, null, 2));
          }}
        >
          Run eval (API)
        </button>
        {evalSummary && (
          <pre className="mt-3 max-h-64 overflow-auto whitespace-pre-wrap rounded bg-muted/50 p-3 text-xs">{evalSummary}</pre>
        )}
      </section>
    </div>
  );
}

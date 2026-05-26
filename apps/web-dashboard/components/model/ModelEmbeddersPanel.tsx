import Link from 'next/link';

import type { ModelOverviewPayload } from '../../lib/modelOverviewTypes';
import { EmbedderTilesGrid } from './EmbedderTile';

export function ModelEmbeddersPanel({
  data,
  onRefresh,
}: {
  data: ModelOverviewPayload;
  onRefresh: () => Promise<void>;
}) {
  return (
    <section className="rounded-xl border border-app-border bg-app-surface/60 p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-sm font-semibold text-app-text">Embeddings</h2>
        <Link
          href="/admin/retrieval"
          className="text-[12px] font-medium text-primary underline-offset-2 hover:underline"
        >
          Edit on retrieval playground
        </Link>
      </div>
      <p className="mt-1 text-[12px] text-app-muted">
        Vector search uses per-agent embedder config. Optional embedders need Ollama pull plus backfill.
      </p>
      <div className="mt-3">
        <EmbedderTilesGrid overview={data} onRefresh={onRefresh} />
      </div>
      {Object.values(data.retrieval.missing_embeddings).some((n) => n > 0) ? (
        <p className="mt-3 text-[12px] text-amber-700 dark:text-amber-300">
          Missing embeddings detected —{' '}
          <Link href="/admin/retrieval" className="underline">
            run backfill
          </Link>{' '}
          on the retrieval playground.
        </p>
      ) : null}
    </section>
  );
}

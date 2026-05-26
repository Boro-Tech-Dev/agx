import Link from 'next/link';

import type { ModelOverviewPayload } from '../../lib/modelOverviewTypes';
import { RerankerTilesGrid } from './RerankerTile';

export function ModelRerankersPanel({ data }: { data: ModelOverviewPayload }) {
  return (
    <section className="rounded-xl border border-app-border bg-app-surface/60 p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-sm font-semibold text-app-text">Rerankers</h2>
        <Link
          href="/admin/retrieval"
          className="text-[12px] font-medium text-primary underline-offset-2 hover:underline"
        >
          Edit on retrieval playground
        </Link>
      </div>
      <p className="mt-1 text-[12px] text-app-muted">
        Cross-encoder TEI, ColBERT, and Ollama LLM-as-reranker backends. Web deep-fetch uses{' '}
        <span className="font-mono">{data.runtime.web_deepfetch_reranker_id ?? 'tei_bge'}</span>.
      </p>
      <div className="mt-3">
        <RerankerTilesGrid overview={data} />
      </div>
    </section>
  );
}

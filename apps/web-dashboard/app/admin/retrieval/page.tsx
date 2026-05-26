import { RetrievalAdminClient } from '@/components/admin/RetrievalAdminClient';

export default function RetrievalAdminPage() {
  return (
    <main className="mx-auto max-w-6xl space-y-6 p-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Retrieval playground</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Per-agent embedder and reranker selection. Backfill embeddings before switching embedders in
          production paths.
        </p>
      </header>
      <RetrievalAdminClient />
    </main>
  );
}

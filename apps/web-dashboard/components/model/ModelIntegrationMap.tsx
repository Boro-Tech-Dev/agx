export function ModelIntegrationMap() {
  return (
    <section className="rounded-xl border border-app-border bg-app-surface/60 p-4">
      <details className="group">
        <summary className="cursor-pointer select-none text-sm font-semibold text-app-text">
          Who calls the router
        </summary>
        <div className="mt-3 space-y-3 text-[12px] leading-relaxed text-app-muted">
          <div>
            <p className="font-medium text-app-text">agent-worker</p>
            <ul className="mt-1 list-inside list-disc">
              <li>
                <span className="font-mono">POST /v1/route</span> — all agent workflow LLM turns
              </li>
              <li>
                <span className="font-mono">POST /v1/route_with_tools</span> — tool-capable agents
                (pm, builder, forge, canon)
              </li>
              <li>
                <span className="font-mono">POST /v1/embed</span> — hybrid memory query vectors
              </li>
              <li>
                <span className="font-mono">POST /v1/rerank</span> — web deep-fetch chunks, local
                rerank fallback
              </li>
            </ul>
          </div>
          <div>
            <p className="font-medium text-app-text">agent-api</p>
            <ul className="mt-1 list-inside list-disc">
              <li>
                <span className="font-mono">/v1/route</span> — brief autofill, ask clarifier, reply
                coach, learning
              </li>
              <li>
                <span className="font-mono">/v1/embed</span> +{' '}
                <span className="font-mono">/v1/rerank</span> — retrieval_v2 memory search
              </li>
              <li>
                <span className="font-mono">/v1/retrieval/catalog</span> — admin retrieval proxy
              </li>
            </ul>
          </div>
          <div>
            <p className="font-medium text-app-text">ingestion-worker</p>
            <ul className="mt-1 list-inside list-disc">
              <li>
                <span className="font-mono">POST /v1/embed</span> — document chunk embeddings
              </li>
              <li>
                <span className="font-mono">POST /v1/route</span> — timeline map LLM pass
              </li>
            </ul>
          </div>
          <div>
            <p className="font-medium text-app-text">Sidecars (via router)</p>
            <ul className="mt-1 list-inside list-disc">
              <li>Ollama — chat + embed + Ollama LLM rerankers</li>
              <li>reranker-bge, reranker-jina, reranker-colbert — TEI-shaped /rerank</li>
              <li>search-runner, browser-runner, tool-runner — tool HTTP (not LLM)</li>
              <li>mcp-searxng — optional MCP bridge for web search</li>
            </ul>
          </div>
        </div>
      </details>
    </section>
  );
}

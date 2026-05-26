import type { ModelOverviewPayload } from '../../lib/modelOverviewTypes';

export function ModelMcpToolsCard({ data }: { data: ModelOverviewPayload }) {
  const features = data.router.features;
  const toolAgents = data.lanes.agents.filter((a) => (a.tool_allowlist?.length ?? 0) > 0);

  return (
    <section className="rounded-xl border border-app-border bg-app-surface/60 p-4">
      <h2 className="text-sm font-semibold text-app-text">MCP and tools</h2>
      <p className="mt-1 text-[12px] text-app-muted">
        Tool-capable agents use <span className="font-mono">POST /v1/route_with_tools</span>. Others
        pre-fetch context in the worker.
      </p>
      <dl className="mt-3 grid gap-2 text-[12px] tablet:grid-cols-2">
        <div className="rounded-lg border border-app-border/60 p-3">
          <dt className="font-medium text-app-text">MCP bridge</dt>
          <dd className="mt-1 text-app-muted">
            {features.mcp_bridge_enabled ? 'enabled' : 'disabled'}
            {features.mcp_targets && features.mcp_targets.length > 0 ? (
              <span className="mt-1 block font-mono text-[11px]">
                targets: {features.mcp_targets.join(', ')}
              </span>
            ) : null}
          </dd>
          <dd className="mt-1 text-[11px] text-app-muted">
            SearXNG falls back to HTTP search-runner when MCP call fails.
          </dd>
        </div>
        <div className="rounded-lg border border-app-border/60 p-3">
          <dt className="font-medium text-app-text">HTTP tool runners</dt>
          <dd className="mt-1 font-mono text-[11px] text-app-muted">
            search-runner · browser-runner · tool-runner
          </dd>
        </div>
      </dl>
      {toolAgents.length > 0 ? (
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[480px] text-left text-[12px]">
            <thead>
              <tr className="border-b border-app-border text-app-muted">
                <th className="px-2 py-1.5 font-medium">Agent</th>
                <th className="px-2 py-1.5 font-medium">Tool allowlist</th>
              </tr>
            </thead>
            <tbody>
              {toolAgents.map((a) => (
                <tr key={a.agent_key} className="border-b border-app-border/60">
                  <td className="px-2 py-1.5 font-mono">{a.agent_key}</td>
                  <td className="px-2 py-1.5 font-mono text-[11px]">
                    {(a.tool_allowlist ?? []).join(', ') || '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </section>
  );
}

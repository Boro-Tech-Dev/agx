import type { ModelOverviewPayload } from '../../lib/modelOverviewTypes';

export function ModelLanesCard({ data }: { data: ModelOverviewPayload }) {
  const laneEntries = Object.entries(data.lanes.lanes);

  return (
    <section className="rounded-xl border border-app-border bg-app-surface/60 p-4">
      <h2 className="text-sm font-semibold text-app-text">Agent lanes</h2>
      <p className="mt-1 text-[12px] text-app-muted">
        Lanes control whether the model invokes tools itself or receives pre-fetched context.
      </p>
      <div className="mt-3 grid gap-3 tablet:grid-cols-3">
        {laneEntries.map(([key, meta]) => (
          <div key={key} className="rounded-lg border border-app-border/60 p-3">
            <p className="text-[12px] font-medium text-app-text">{meta.label ?? key}</p>
            <p className="mt-1 text-[11px] leading-snug text-app-muted">{meta.description ?? ''}</p>
            <p className="mt-2 font-mono text-[10px] text-app-muted">{key}</p>
          </div>
        ))}
      </div>
      <div className="mt-3 overflow-x-auto">
        <table className="w-full min-w-[560px] text-left text-[12px]">
          <thead>
            <tr className="border-b border-app-border text-app-muted">
              <th className="px-2 py-1.5 font-medium">Agent</th>
              <th className="px-2 py-1.5 font-medium">Lane</th>
              <th className="px-2 py-1.5 font-medium">Default model</th>
              <th className="px-2 py-1.5 font-medium">Tool model</th>
              <th className="px-2 py-1.5 font-medium">Web search default</th>
            </tr>
          </thead>
          <tbody>
            {data.lanes.agents.map((a) => (
              <tr key={a.agent_key} className="border-b border-app-border/60">
                <td className="px-2 py-1.5 font-mono">{a.agent_key}</td>
                <td className="px-2 py-1.5">{a.lane_label ?? a.lane ?? '—'}</td>
                <td className="px-2 py-1.5 font-mono">{a.default_model ?? '—'}</td>
                <td className="px-2 py-1.5 font-mono">{a.tool_model ?? '—'}</td>
                <td className="px-2 py-1.5">{a.default_web_search ? 'yes' : 'no'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

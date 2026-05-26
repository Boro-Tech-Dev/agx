'use client';

import { useEffect, useState } from 'react';

import type { AgentLaneRow, ModelOverviewPayload } from '../../lib/modelOverviewTypes';

type CatalogAgent = { key: string; default_model: string; name?: string };

function routeModel(data: ModelOverviewPayload, agentKey: string): string {
  return data.ollama.routes[agentKey] ?? '—';
}

function laneFor(data: ModelOverviewPayload, agentKey: string): AgentLaneRow | undefined {
  return data.lanes.agents.find((a) => a.agent_key === agentKey);
}

function tempFor(data: ModelOverviewPayload, agentKey: string): string {
  const temps = data.router.health?.temps;
  if (temps && typeof temps === 'object' && agentKey in (temps as Record<string, unknown>)) {
    const t = (temps as Record<string, number>)[agentKey];
    if (typeof t === 'number') return String(t);
  }
  return '—';
}

export function ModelAgentRoutesTable({ data }: { data: ModelOverviewPayload }) {
  const [catalogAgents, setCatalogAgents] = useState<CatalogAgent[]>([]);

  useEffect(() => {
    fetch('/api/agents')
      .then((r) => (r.ok ? r.json() : []))
      .then((rows) => setCatalogAgents(Array.isArray(rows) ? rows : []))
      .catch(() => setCatalogAgents([]));
  }, []);

  const agentKeys = Array.from(
    new Set([
      ...Object.keys(data.ollama.routes),
      ...data.lanes.agents.map((a) => a.agent_key),
    ]),
  ).sort();

  const driftRows = agentKeys.filter((key) => {
    const lane = laneFor(data, key);
    const cat = catalogAgents.find((c) => c.key === key);
    if (!lane?.default_model || !cat?.default_model) return false;
    return lane.default_model !== cat.default_model;
  });

  return (
    <section className="rounded-xl border border-app-border bg-app-surface/60 p-4">
      <h2 className="text-sm font-semibold text-app-text">Agent routing</h2>
      <p className="mt-1 text-[12px] text-app-muted">
        Live routes from model-router. Lane labels from agent-lanes config.
      </p>
      {driftRows.length > 0 ? (
        <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[12px] text-amber-900 dark:border-amber-500/35 dark:bg-amber-500/10 dark:text-amber-100">
          <p className="font-medium">Postgres catalog vs router drift</p>
          <ul className="mt-1 list-inside list-disc">
            {driftRows.map((key) => {
              const lane = laneFor(data, key);
              const cat = catalogAgents.find((c) => c.key === key);
              return (
                <li key={key}>
                  <span className="font-mono">{key}</span>: DB{' '}
                  <span className="font-mono">{cat?.default_model}</span> · lanes{' '}
                  <span className="font-mono">{lane?.default_model}</span> · router{' '}
                  <span className="font-mono">{routeModel(data, key)}</span>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}
      <div className="mt-3 overflow-x-auto">
        <table className="w-full min-w-[640px] text-left text-[12px]">
          <thead>
            <tr className="border-b border-app-border text-app-muted">
              <th className="px-2 py-1.5 font-medium">Agent</th>
              <th className="px-2 py-1.5 font-medium">Route model</th>
              <th className="px-2 py-1.5 font-medium">Temp</th>
              <th className="px-2 py-1.5 font-medium">Lane</th>
              <th className="px-2 py-1.5 font-medium">Tool model</th>
              <th className="px-2 py-1.5 font-medium">DB default</th>
            </tr>
          </thead>
          <tbody>
            {agentKeys.map((key) => {
              const lane = laneFor(data, key);
              const cat = catalogAgents.find((c) => c.key === key);
              return (
                <tr key={key} className="border-b border-app-border/60">
                  <td className="px-2 py-1.5 font-mono">{key}</td>
                  <td className="px-2 py-1.5 font-mono">{routeModel(data, key)}</td>
                  <td className="px-2 py-1.5 tabular-nums">{tempFor(data, key)}</td>
                  <td className="px-2 py-1.5">{lane?.lane_label ?? lane?.lane ?? '—'}</td>
                  <td className="px-2 py-1.5 font-mono">{lane?.tool_model ?? '—'}</td>
                  <td className="px-2 py-1.5 font-mono text-app-muted">{cat?.default_model ?? '—'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

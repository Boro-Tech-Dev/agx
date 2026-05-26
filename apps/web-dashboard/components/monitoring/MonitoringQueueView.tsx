'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Activity,
  Clock,
  Database,
  FileText,
  Globe,
  Layers,
  ShieldCheck,
  Zap,
} from 'lucide-react';

import { getQueueMonitoring, listAgents } from '../../lib/api';
import { agentMeta, enabledAgentNavKeysFromCatalog } from '../../lib/agents';
import { agentLaneRow } from '../../lib/agentLanes';
import type { AgentCatalogRow } from '../../lib/api';
import type { QueueMonitoringResponse, WorkerProbe } from '../../lib/monitoringTypes';
import { HazardStripe } from '../ui/ragtag/HazardStripe';
import { ToolCard } from '../ui/ragtag/ToolCard';
import { statusToVariant } from '../../lib/ragtag/statusVariants';

function workerStatus(probe: WorkerProbe | undefined): { status: string; variant: ReturnType<typeof statusToVariant> } {
  if (!probe) return { status: 'OFFLINE', variant: 'neutral' };
  if (!probe.ok) return { status: 'ERROR', variant: 'error' };
  const h = probe.health;
  const consumer = h && typeof h === 'object' && 'consumer' in h ? (h as { consumer?: boolean }).consumer : undefined;
  if (consumer === false) return { status: 'IDLE', variant: 'warning' };
  return { status: 'READY', variant: 'success' };
}

type WorkerDef = {
  name: string;
  purpose: string;
  icon: typeof Zap;
  probe?: WorkerProbe;
  metadata: string;
  cta: string;
};

export function MonitoringQueueView() {
  const [data, setData] = useState<QueueMonitoringResponse | null>(null);
  const [agents, setAgents] = useState<AgentCatalogRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setError(null);
      const [d, a] = await Promise.all([getQueueMonitoring(), listAgents()]);
      setData(d);
      setAgents(a);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, []);

  useEffect(() => {
    void load();
    const id = setInterval(() => void load(), 3000);
    return () => clearInterval(id);
  }, [load]);

  const agentKeys = useMemo(() => enabledAgentNavKeysFromCatalog(agents), [agents]);

  const activeByAgent = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of data?.active_runs ?? []) {
      m.set(r.agent_key, (m.get(r.agent_key) ?? 0) + 1);
    }
    return m;
  }, [data?.active_runs]);

  const agentCards = agentKeys.map((key) => {
    const meta = agentMeta[key];
    const lane = agentLaneRow(key);
    const active = activeByAgent.get(key) ?? 0;
    const st = active > 0 ? 'PROCESSING' : 'READY';
    return {
      key,
      name: meta.name,
      purpose: `${meta.workflow} · ${lane?.lane_label ?? 'agent'} — ${active} active run${active === 1 ? '' : 's'}`,
      status: st,
      variant: statusToVariant(st),
      href: `/agents/${key}`,
      metadata: key.toUpperCase(),
    };
  });

  const workerDefs: WorkerDef[] = [
    {
      name: 'Agent Worker',
      purpose: 'Executes queued agent runs against model-router and Postgres.',
      icon: Zap,
      probe: data?.workers?.[0],
      metadata: 'RUN QUEUE',
      cta: 'Monitor',
    },
    {
      name: 'Ingestion Worker',
      purpose: 'Chunks and embeds uploaded project documents.',
      icon: FileText,
      probe: data?.ingestion_workers?.[0],
      metadata: 'INGEST',
      cta: 'Monitor',
    },
    {
      name: 'Scenario Worker',
      purpose: 'Computes delivery scenarios and timeline schedules.',
      icon: Clock,
      probe: data?.scenario_workers?.[0],
      metadata: 'PLANNER',
      cta: 'Monitor',
    },
    {
      name: 'Browser Runner',
      purpose: 'Playwright capture, extract, and crawl for Web Capture.',
      icon: Globe,
      probe: data?.browser_workers?.[0],
      metadata: 'WEB',
      cta: 'Monitor',
    },
    {
      name: 'Search Runner',
      purpose: 'SearXNG JSON search proxy for Web Search and tool loop.',
      icon: Globe,
      probe: undefined,
      metadata: 'SEARCH',
      cta: 'Health',
    },
    {
      name: 'Veeva Suite Worker',
      purpose: 'RTE/CLM ZIP preview, token scan, and submission PDFs.',
      icon: ShieldCheck,
      probe: data?.veeva_suite_workers?.[0],
      metadata: 'VEEVA',
      cta: 'Inspect',
    },
    {
      name: 'Model Router',
      purpose: 'Routes chat/embed requests to local Ollama models.',
      icon: Layers,
      probe: data?.model_router_workers?.[0],
      metadata: 'OLLAMA',
      cta: 'Status',
    },
    {
      name: 'Tool Runner',
      purpose: 'Repo summarize and search tools for Builder.',
      icon: Database,
      probe: undefined,
      metadata: 'REPO',
      cta: 'Logs',
    },
  ];

  const q = data?.queues;
  const queueMeta = q
    ? `P:${q.pending_length} X:${q.processing_length} DLQ:${q.dead_letter_length}`
    : '—';

  return (
    <div className="flex flex-col bg-rt-black">
      <HazardStripe />
      <div className="custom-scrollbar flex-1 overflow-y-auto p-6">
        <div className="mb-6 flex flex-wrap items-center gap-3 border-b border-rt-panel pb-4">
          <Clock className="h-5 w-5 text-rt-yellow" />
          <h1 className="font-display text-xl font-bold uppercase tracking-widest text-rt-white">
            Queue & Compute
          </h1>
          <span className="ml-2 rounded-sm bg-rt-panel px-2 py-0.5 font-mono text-xs uppercase tracking-widest text-rt-ice/80">
            {agentCards.length + workerDefs.length} entities · {queueMeta}
          </span>
          <button
            type="button"
            onClick={() => void load()}
            className="ml-auto bg-rt-cyan px-3 py-1.5 text-xs font-semibold uppercase tracking-wider text-rt-black hover:bg-[#00A0B5]"
          >
            Refresh
          </button>
        </div>

        {error ? <p className="mb-4 text-sm text-rt-orange">{error}</p> : null}

        <section className="mb-8">
          <h2 className="mb-4 font-mono text-sm uppercase tracking-widest text-rt-cyan">Active Agents</h2>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {agentCards.map((a) => (
              <ToolCard
                key={a.key}
                name={a.name}
                purpose={a.purpose}
                status={a.status}
                variant={a.variant}
                cta="Open"
                metadata={a.metadata}
                icon={Activity}
                href={a.href}
              />
            ))}
          </div>
        </section>

        <section>
          <h2 className="mb-4 font-mono text-sm uppercase tracking-widest text-rt-yellow">
            Background Workers
          </h2>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {workerDefs.map((w) => {
              const st = workerStatus(w.probe);
              return (
                <ToolCard
                  key={w.name}
                  name={w.name}
                  purpose={w.purpose}
                  status={st.status}
                  variant={st.variant}
                  cta={w.cta}
                  metadata={w.metadata}
                  icon={w.icon}
                />
              );
            })}
          </div>
        </section>
      </div>
    </div>
  );
}

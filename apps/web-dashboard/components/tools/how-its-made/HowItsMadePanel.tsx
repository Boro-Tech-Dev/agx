'use client';

import type {
  HowItsMadeDoc,
  HowItsMadeQueueRef,
  HowItsMadeRouteRef,
  HowItsMadeSection,
  HowItsMadeSourceRef,
} from '../../../lib/howItsMade/types';
import { getHowItsMadeDoc } from '../../../lib/howItsMade/registry';
import type { ToolCatalogId } from '../../../lib/toolCatalog';
import { MermaidDiagram } from '../../MermaidDiagram';

function SourceRefLine({ sourceRef: r }: { sourceRef: HowItsMadeSourceRef }) {
  return (
    <li className="font-mono text-[10px] leading-relaxed text-app-text">
      <span className="text-indigo-300">{r.path}</span>
      {r.symbol ? <span className="text-app-muted"> → {r.symbol}</span> : null}
      {r.note ? <span className="block text-app-muted">{r.note}</span> : null}
    </li>
  );
}

function RouteTable({ routes }: { routes: HowItsMadeRouteRef[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[28rem] border-collapse text-left text-[10px]">
        <thead>
          <tr className="border-b border-app-border text-app-muted">
            <th className="py-1 pr-2 font-semibold">Method</th>
            <th className="py-1 pr-2 font-semibold">Path</th>
            <th className="py-1 pr-2 font-semibold">Handler / proxy</th>
            <th className="py-1 font-semibold">Notes</th>
          </tr>
        </thead>
        <tbody>
          {routes.map((r, i) => (
            <tr key={`${r.method}-${r.path}-${i}`} className="border-b border-app-border/50 align-top">
              <td className="py-1 pr-2 font-mono text-indigo-800 dark:text-indigo-200">{r.method}</td>
              <td className="py-1 pr-2 font-mono">{r.path}</td>
              <td className="py-1 pr-2 font-mono text-app-muted">{r.handler || r.proxyTarget || '—'}</td>
              <td className="py-1 text-app-muted">
                {[r.timeout, r.note].filter(Boolean).join(' · ') || '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function QueueTable({ queues }: { queues: HowItsMadeQueueRef[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[28rem] border-collapse text-left text-[10px]">
        <thead>
          <tr className="border-b border-app-border text-app-muted">
            <th className="py-1 pr-2 font-semibold">Queue</th>
            <th className="py-1 pr-2 font-semibold">Producer</th>
            <th className="py-1 pr-2 font-semibold">Consumer</th>
            <th className="py-1 pr-2 font-semibold">This tool</th>
            <th className="py-1 font-semibold">Notes</th>
          </tr>
        </thead>
        <tbody>
          {queues.map((q) => (
            <tr key={q.name} className="border-b border-app-border/50 align-top">
              <td className="py-1 pr-2 font-mono text-indigo-800 dark:text-indigo-200">{q.name}</td>
              <td className="py-1 pr-2 text-app-muted">{q.producer || '—'}</td>
              <td className="py-1 pr-2 text-app-muted">{q.consumer || '—'}</td>
              <td className="py-1 pr-2">{q.usedByTool ? 'Yes' : 'No'}</td>
              <td className="py-1 text-app-muted">{q.note || '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function SectionBlock({ section }: { section: HowItsMadeSection }) {
  return (
    <details className="group rounded-lg border border-app-border bg-app-surface/40">
      <summary className="cursor-pointer select-none px-3 py-2 text-[12px] font-medium text-app-text hover:bg-app-fill/50">
        {section.title}
      </summary>
      <div className="space-y-2 border-t border-app-border px-3 py-2 text-[11px] leading-relaxed text-app-muted">
        {section.paragraphs?.map((p, i) => (
          <p key={i}>{p}</p>
        ))}
        {section.bullets?.length ? (
          <ul className="list-disc space-y-1 pl-4">
            {section.bullets.map((b, i) => (
              <li key={i}>{b}</li>
            ))}
          </ul>
        ) : null}
        {section.formulas?.length ? (
          <div className="space-y-2">
            {section.formulas.map((f, i) => (
              <pre
                key={i}
                className="overflow-x-auto rounded border border-app-border bg-app-fill/80 p-2 font-mono text-[10px] text-app-text"
              >
                {f}
              </pre>
            ))}
          </div>
        ) : null}
        {section.mermaid ? <MermaidDiagram chart={section.mermaid} /> : null}
        {section.routes?.length ? <RouteTable routes={section.routes} /> : null}
        {section.queues?.length ? <QueueTable queues={section.queues} /> : null}
        {section.sourceRefs?.length ? (
          <ul className="mt-2 space-y-1">
            {section.sourceRefs.map((r, i) => (
              <SourceRefLine key={`${r.path}-${i}`} sourceRef={r} />
            ))}
          </ul>
        ) : null}
      </div>
    </details>
  );
}

function AiUsageBanner({ ai }: { ai: HowItsMadeDoc['ai'] }) {
  const yes = ai.usesLlm;
  return (
    <div
      className={`rounded-lg border px-3 py-2 ${
        yes ? 'border-violet-500/40 bg-violet-500/10' : 'border-emerald-500/35 bg-emerald-500/10'
      }`}
    >
      <p className="text-[11px] font-semibold text-app-text">{yes ? 'Uses AI (LLM)' : 'Does not use AI'}</p>
      <p className="mt-1 text-[11px] leading-relaxed text-app-muted">{ai.summary}</p>
      {ai.details?.length ? (
        <ul className="mt-2 list-disc space-y-0.5 pl-4 text-[10px] text-app-muted">
          {ai.details.map((d, i) => (
            <li key={i}>{d}</li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function DocBody({ doc }: { doc: HowItsMadeDoc }) {
  return (
    <div className="max-h-[min(70vh,640px)] space-y-3 overflow-y-auto pr-1">
      <AiUsageBanner ai={doc.ai} />
      <p className="text-[11px] leading-relaxed text-app-muted">{doc.architectureSummary}</p>
      {doc.architectureMermaid ? (
        <details className="rounded-lg border border-app-border bg-app-surface/40">
          <summary className="cursor-pointer select-none px-3 py-2 text-[12px] font-medium text-app-text">
            Architecture diagram (Mermaid)
          </summary>
          <div className="border-t border-app-border p-3">
            <MermaidDiagram chart={doc.architectureMermaid} />
          </div>
        </details>
      ) : null}
      <div className="flex flex-col gap-2">
        {doc.sections.map((s) => (
          <SectionBlock key={s.id} section={s} />
        ))}
      </div>
      <p className="text-[10px] text-app-muted">
        Code verified: {doc.lastVerifiedFromCode}. Update lib/howItsMade when behavior changes.
      </p>
    </div>
  );
}

export function HowItsMadePanel({ toolId }: { toolId: ToolCatalogId }) {
  const doc = getHowItsMadeDoc(toolId);
  return (
    <div className="space-y-2">
      <h3 className="text-[12px] font-semibold text-app-text">{doc.title} — How it&apos;s made</h3>
      <DocBody doc={doc} />
    </div>
  );
}

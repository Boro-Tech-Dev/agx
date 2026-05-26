'use client';

import Link from 'next/link';
import { getGovernanceDoc } from '../../lib/governance/content';
import type {
  GovernanceSection,
  GovernanceSourceRef,
  GovernanceTable,
} from '../../lib/governance/types';

function SourceRefLine({ sourceRef: r }: { sourceRef: GovernanceSourceRef }) {
  return (
    <li className="font-mono text-[10px] leading-relaxed text-app-text">
      <span className="text-indigo-300">{r.path}</span>
      {r.symbol ? <span className="text-app-muted"> → {r.symbol}</span> : null}
      {r.note ? <span className="block text-app-muted">{r.note}</span> : null}
    </li>
  );
}

function GovernanceDataTable({ table }: { table: GovernanceTable }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[28rem] border-collapse text-left text-[10px]">
        <thead>
          <tr className="border-b border-app-border text-app-muted">
            {table.columns.map((c) => (
              <th key={c.key} className="py-1 pr-2 font-semibold">
                {c.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {table.rows.map((row, i) => (
            <tr key={i} className="border-b border-app-border/50 align-top">
              {table.columns.map((c) => (
                <td key={c.key} className="py-1 pr-2 text-app-muted">
                  {row[c.key] ?? '—'}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function SectionBlock({ section }: { section: GovernanceSection }) {
  return (
    <details
      id={section.id}
      className="group scroll-mt-4 rounded-lg border border-app-border bg-app-surface/40"
    >
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
        {section.tables?.map((t, i) => (
          <GovernanceDataTable key={i} table={t} />
        ))}
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

export function GovernancePage() {
  const doc = getGovernanceDoc();

  return (
    <div className="max-w-3xl space-y-4">
      <div className="rounded-lg border border-app-border bg-app-surface/60 px-3 py-2">
        {doc.heroSummary.map((p, i) => (
          <p key={i} className={i > 0 ? 'mt-2 text-[11px] leading-relaxed text-app-muted' : 'text-[11px] leading-relaxed text-app-muted'}>
            {p}
          </p>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2 text-[10px] text-app-muted">
        <span className="rounded border border-app-border bg-app-fill px-1.5 py-0.5">
          Code verified: {doc.lastVerifiedFromCode}
        </span>
        <span className="text-app-border">·</span>
        {doc.quickLinks.map((l, i) => (
          <span key={l.href}>
            {i > 0 ? <span className="mr-2 text-app-border">·</span> : null}
            <Link href={l.href} className="font-medium text-violet-700 hover:text-violet-800 dark:text-violet-300 dark:hover:text-violet-200">
              {l.label}
            </Link>
          </span>
        ))}
      </div>

      <nav aria-label="Governance sections" className="rounded-lg border border-app-border bg-app-fill/40 px-3 py-2">
        <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-app-muted">On this page</p>
        <ul className="flex flex-col gap-0.5">
          {doc.sections.map((s) => (
            <li key={s.id}>
              <a href={`#${s.id}`} className="text-[11px] text-violet-700 hover:underline dark:text-violet-300">
                {s.title}
              </a>
            </li>
          ))}
          <li>
            <a href="#known-issues" className="text-[11px] text-violet-700 hover:underline dark:text-violet-300">
              Known issues being addressed now
            </a>
          </li>
        </ul>
      </nav>

      <div className="flex flex-col gap-2">
        {doc.sections.map((s) => (
          <SectionBlock key={s.id} section={s} />
        ))}
      </div>

      <section
        id="known-issues"
        className="scroll-mt-4 rounded-lg border border-amber-500/35 bg-amber-500/5 px-3 py-3"
      >
        <h2 className="text-[12px] font-semibold text-app-text">Known issues being addressed now</h2>
        <p className="mt-1 text-[11px] leading-relaxed text-app-muted">
          Transparent gaps in the current build. Not every item is the same priority for an internal operator tool.
        </p>
        <KnownIssuesTable issues={doc.knownIssues} />
      </section>

      <p className="text-[10px] text-app-muted">
        Update <span className="font-mono">lib/governance/content.ts</span> when auth, retention, or LLM behavior changes.
      </p>
    </div>
  );
}

function KnownIssuesTable({
  issues,
}: {
  issues: ReturnType<typeof getGovernanceDoc>['knownIssues'];
}) {
  return (
    <div className="mt-3 overflow-x-auto">
      <table className="w-full min-w-[28rem] border-collapse text-left text-[10px]">
        <thead>
          <tr className="border-b border-amber-500/25 text-app-muted">
            <th className="py-1 pr-2 font-semibold">Issue</th>
            <th className="py-1 pr-2 font-semibold">Why it matters</th>
            <th className="py-1 font-semibold">Mitigation today</th>
          </tr>
        </thead>
        <tbody>
          {issues.map((row) => (
            <tr key={row.issue} className="border-b border-amber-500/15 align-top">
              <td className="py-1.5 pr-2 font-medium text-app-text">{row.issue}</td>
              <td className="py-1.5 pr-2 text-app-muted">{row.whyItMatters}</td>
              <td className="py-1.5 text-app-muted">{row.mitigationToday}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

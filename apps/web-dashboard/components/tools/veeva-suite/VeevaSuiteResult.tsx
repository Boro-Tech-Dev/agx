'use client';

import { useMemo, useState } from 'react';

import { ExternalUrlActions } from '../../ui/ExternalUrlActions';
import { apiUrlForFetch, type RteEmailPreviewStyle, type VeevaSuiteResponse } from '../../../lib/api';
import { analyzeVeevaSuite, exportVeevaSuiteMarkdown, type Severity } from '../../../lib/veevaSuite/analysis';
import { ScreenshotComparator } from './ScreenshotComparator';

type TabKey = 'preview' | 'fragments' | 'navigation' | 'screenshots' | 'vendor' | 'findings' | 'exports';

function toneForSeverity(severity: Severity): string {
  if (severity === 'blocker') return 'border-rose-300 bg-rose-50 text-rose-900 dark:border-rose-500/35 dark:bg-rose-500/10 dark:text-rose-100';
  if (severity === 'warning') return 'border-amber-300 bg-amber-50 text-amber-950 dark:border-amber-500/35 dark:bg-amber-500/10 dark:text-amber-100';
  if (severity === 'note') return 'border-sky-300 bg-sky-50 text-sky-950 dark:border-sky-500/35 dark:bg-sky-500/10 dark:text-sky-100';
  return 'border-emerald-300 bg-emerald-50 text-emerald-950 dark:border-emerald-500/35 dark:bg-emerald-500/10 dark:text-emerald-100';
}

function statusTone(status: string): string {
  if (status === 'missing') return 'text-rose-700 dark:text-rose-300';
  if (status === 'check') return 'text-amber-700 dark:text-amber-300';
  if (status === 'ready') return 'text-emerald-700 dark:text-emerald-300';
  return 'text-app-muted';
}

function downloadText(name: string, content: string, type = 'text/plain') {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function copyText(value: string) {
  if (navigator?.clipboard?.writeText) return navigator.clipboard.writeText(value);
  const textarea = document.createElement('textarea');
  textarea.value = value;
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand('copy');
  textarea.remove();
  return Promise.resolve();
}

function outputUrl(result: VeevaSuiteResponse, relPath?: string): string {
  if (!relPath) return '#';
  if (/^https?:\/\//i.test(relPath) || relPath.startsWith('/')) return relPath;
  const root = result.previewUrl.replace(/\/[^/]*$/, '');
  return `${root}/${relPath.replace(/^\/+/, '')}`;
}

function isCrossOriginHttpUrl(path: string): boolean {
  if (!/^https?:\/\//i.test(path)) return false;
  if (typeof window === 'undefined') return false;
  try {
    return new URL(path).origin !== window.location.origin;
  } catch {
    return true;
  }
}

function fetchableUrl(path: string): string {
  if (!path || path === '#') return '#';
  if (/^https?:\/\//i.test(path)) {
    if (typeof window !== 'undefined') {
      try {
        const u = new URL(path);
        if (u.origin === window.location.origin) {
          return apiUrlForFetch(`${u.pathname}${u.search}`);
        }
      } catch {
        return '#';
      }
    }
    return path;
  }
  const normalized = path.startsWith('/') ? path : `/${path}`;
  return apiUrlForFetch(normalized);
}

/** Same-origin only — for img src under tightened CSP img-src. */
function imageSrcUrl(path: string): string | null {
  if (isCrossOriginHttpUrl(path)) return null;
  const u = fetchableUrl(path);
  return u === '#' ? null : u;
}

type EvidenceLink = { label: string; href: string };

function screenshotEvidenceLinks(result: VeevaSuiteResponse): EvidenceLink[] {
  const screenshots = result.screenshots ?? { fragments: [], slides: [] };
  const links: EvidenceLink[] = [];
  if (screenshots.fullPage) links.push({ label: 'Full-page screenshot', href: outputUrl(result, screenshots.fullPage) });
  if (screenshots.viewport600) links.push({ label: '600px desktop capture', href: outputUrl(result, screenshots.viewport600) });
  if (screenshots.viewport400) links.push({ label: '400px mobile capture', href: outputUrl(result, screenshots.viewport400) });
  (screenshots.fragments ?? []).forEach((path, index) => {
    links.push({ label: `Fragment screenshot ${index + 1}`, href: outputUrl(result, path) });
  });
  (screenshots.slides ?? []).forEach((path, index) => {
    links.push({ label: `Slide screenshot ${index + 1}`, href: outputUrl(result, path) });
  });
  return links;
}

function exportStem(sourceName: string, runId: string): string {
  const stem = sourceName
    .replace(/\.zip$/i, '')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 72);
  return stem ? `${stem}-${runId}` : runId;
}

type UnitMapRow = ReturnType<typeof analyzeVeevaSuite>['fragmentMap'][number];

function UnitMap({
  title,
  emptyLabel,
  rows,
  result,
}: {
  title: string;
  emptyLabel: string;
  rows: UnitMapRow[];
  result: VeevaSuiteResponse;
}) {
  return (
    <div className="rounded-lg border border-app-border bg-app-fill/60 p-3">
      <h3 className="text-sm font-semibold text-app-text">{title}</h3>
      {rows.length ? (
        <div className="mt-2 overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-[11px]">
            <thead className="text-[10px] uppercase tracking-wide text-app-muted">
              <tr className="border-b border-app-border">
                <th className="py-1.5 pr-3">Unit</th>
                <th className="py-1.5 pr-3">Links</th>
                <th className="py-1.5 pr-3">Images</th>
                <th className="py-1.5 pr-3">Tokens</th>
                <th className="py-1.5 pr-3">Scripts</th>
                <th className="py-1.5 pr-3">Veeva API</th>
                <th className="py-1.5 pr-3">Issues</th>
                <th className="py-1.5 pr-3">Preview</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.unit.id} className="border-b border-app-border/60 align-top last:border-0">
                  <td className="py-2 pr-3 font-medium text-app-text">
                    <div>{row.unit.name}</div>
                    <div className="mt-0.5 text-[10px] font-normal text-app-muted">{row.unit.sourcePath}</div>
                  </td>
                  <td className="py-2 pr-3 text-app-text">{row.links.length}</td>
                  <td className="py-2 pr-3 text-app-text">{row.images.length}</td>
                  <td className="py-2 pr-3 text-app-text">{row.tokens.length}</td>
                  <td className="py-2 pr-3 text-app-text">{row.scripts.length}</td>
                  <td className="py-2 pr-3 text-app-text">{row.veevaApi.length}</td>
                  <td className="py-2 pr-3 text-app-text">{row.warnings.length}</td>
                  <td className="py-2 pr-3">
                    <a
                      className="text-indigo-600 hover:underline dark:text-indigo-300"
                      href={fetchableUrl(outputUrl(result, row.unit.previewPath))}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Open
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="mt-2 text-[11px] text-app-muted">{emptyLabel}</p>
      )}
    </div>
  );
}

const TAB_DEFS: { key: TabKey; label: string }[] = [
  { key: 'preview', label: 'Preview' },
  { key: 'fragments', label: 'Fragments' },
  { key: 'navigation', label: 'Navigation' },
  { key: 'screenshots', label: 'Screenshots' },
  { key: 'vendor', label: 'Vendor' },
  { key: 'findings', label: 'Findings' },
  { key: 'exports', label: 'Exports' },
];

function rteAssembledPreviewHref(result: VeevaSuiteResponse, style: RteEmailPreviewStyle): string | undefined {
  if (result.packageType !== 'rte') return undefined;
  const pick = (href?: string) => (href ? fetchableUrl(outputUrl(result, href)) : undefined);
  if (style === 'processed') return pick(result.assembledHtmlProcessedUrl) ?? pick(result.assembledHtmlUrl);
  if (style === 'tokens') return pick(result.assembledHtmlTokensUrl);
  return pick(result.assembledHtmlUrl);
}

export function VeevaSuiteResult({
  result,
  rteEmailPreviewStyle = 'qa',
  onRteEmailPreviewStyleChange,
}: {
  result: VeevaSuiteResponse;
  rteEmailPreviewStyle?: RteEmailPreviewStyle;
  onRteEmailPreviewStyleChange?: (style: RteEmailPreviewStyle) => void;
}) {
  const [tab, setTab] = useState<TabKey>('preview');
  const [copyHint, setCopyHint] = useState<string | null>(null);
  const analysis = useMemo(() => analyzeVeevaSuite(result), [result]);
  const stem = exportStem(result.sourceName, result.id);
  const evidence = useMemo(() => screenshotEvidenceLinks(result), [result]);
  const previewFrameSrc = useMemo(() => {
    const assembled = rteAssembledPreviewHref(result, rteEmailPreviewStyle);
    if (assembled) return assembled;
    const u = result.previewUrl;
    if (/^https?:\/\//i.test(u)) return u;
    return fetchableUrl(u);
  }, [result, rteEmailPreviewStyle]);

  const findingRank = (s: Severity) => (s === 'blocker' ? 0 : s === 'warning' ? 1 : s === 'note' ? 2 : 3);
  const sortedFindings = useMemo(
    () => [...analysis.findings].sort((a, b) => findingRank(a.severity) - findingRank(b.severity)),
    [analysis.findings],
  );

  const markCopied = (label: string) => {
    setCopyHint(label);
    window.setTimeout(() => setCopyHint(null), 1600);
  };

  return (
    <div className="mt-3 space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-2 rounded-lg border border-app-border bg-app-fill/50 p-3">
        <div>
          <div className="text-[10px] uppercase tracking-wide text-app-muted">Veeva Suite run</div>
          <div className="text-sm font-semibold text-app-text">{result.sourceName}</div>
          <div className="mt-1 text-[11px] text-app-muted">
            {analysis.packageLabel} · {analysis.totalUnits} units · Suite {analysis.healthScore}/100 · Vendor {analysis.vendorPackageScore}/100
          </div>
        </div>
        <div className="flex flex-wrap gap-2 text-[11px] text-app-muted">
          <span className="rounded border border-app-border bg-app-surface px-2 py-1">
            {analysis.blockerCount} blockers
          </span>
          <span className="rounded border border-app-border bg-app-surface px-2 py-1">
            {analysis.warningCount} warnings
          </span>
          <span className="rounded border border-app-border bg-app-surface px-2 py-1">{analysis.noteCount} notes</span>
        </div>
      </div>

      <div className="flex flex-wrap gap-1 border-b border-app-border pb-1">
        {TAB_DEFS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={`rounded-md px-2.5 py-1 text-[11px] font-medium ${
              tab === t.key
                ? 'bg-indigo-600 text-white'
                : 'border border-transparent text-app-muted hover:border-app-border hover:bg-app-fill/80 hover:text-app-text'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'preview' ? (
        <div className="space-y-3">
          {result.packageType === 'rte' && onRteEmailPreviewStyleChange ? (
            <div className="rounded-lg border border-app-border bg-app-fill/40 p-3">
              <span className="mb-1 block text-[11px] font-medium text-app-text">Preview style</span>
              <div className="flex flex-wrap gap-2">
                {(
                  [
                    ['qa', 'QA (unmapped tokens)'],
                    ['processed', 'Processed copy'],
                    ['tokens', 'Veeva tokens (magenta)'],
                  ] as const
                ).map(([key, label]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => onRteEmailPreviewStyleChange(key)}
                    className={`rounded-md border px-2.5 py-1 text-[11px] font-medium ${
                      rteEmailPreviewStyle === key
                        ? 'border-indigo-500/50 bg-indigo-600/90 text-white'
                        : 'border-app-border bg-app-surface text-app-text hover:bg-app-fill-hover'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <p className="mt-2 text-[10px] text-app-muted">
                QA shows merge fields and ##tokens## with yellow highlight (no mock substitution). Processed applies your
                token map. Tokens view adds magenta fields, [placeholder] copy, and per-fragment L-brackets. Re-build the
                RTE ZIP after worker updates to refresh variant HTML.
              </p>
            </div>
          ) : null}
          <div className="overflow-hidden rounded-lg border border-app-border bg-app-surface">
            <iframe title="Veeva Suite preview" className="h-[min(70vh,560px)] w-full border-0" src={previewFrameSrc} />
          </div>
          <div className="flex flex-wrap gap-2 text-[11px]">
            {result.assembledHtmlUrl ? (
              <a
                className="rounded-md border border-app-border bg-app-fill px-2 py-1 font-medium text-app-text hover:bg-app-fill-hover"
                href={fetchableUrl(outputUrl(result, result.assembledHtmlUrl))}
                target="_blank"
                rel="noreferrer"
              >
                Assembled HTML
              </a>
            ) : null}
            <a
              className="rounded-md border border-app-border bg-app-fill px-2 py-1 font-medium text-app-text hover:bg-app-fill-hover"
              href={fetchableUrl(outputUrl(result, result.reportHtmlUrl))}
              target="_blank"
              rel="noreferrer"
            >
              Worker report (HTML)
            </a>
            {result.reportPdfUrl ? (
              <a
                className="rounded-md border border-app-border bg-app-fill px-2 py-1 font-medium text-app-text hover:bg-app-fill-hover"
                href={fetchableUrl(outputUrl(result, result.reportPdfUrl))}
                target="_blank"
                rel="noreferrer"
              >
                Worker report (PDF)
              </a>
            ) : null}
            {result.submissionPdfUrl ? (
              <a
                className="rounded-md border border-indigo-500/40 bg-indigo-600/90 px-2 py-1 font-medium text-white hover:bg-indigo-600"
                href={fetchableUrl(result.submissionPdfUrl)}
                target="_blank"
                rel="noreferrer"
              >
                Submission PDF
              </a>
            ) : null}
            <a
              className="rounded-md border border-app-border bg-app-fill px-2 py-1 font-medium text-app-text hover:bg-app-fill-hover"
              href={fetchableUrl(outputUrl(result, result.manifestUrl))}
              target="_blank"
              rel="noreferrer"
            >
              Manifest
            </a>
            {result.downloadUrl ? (
              <a
                className="rounded-md border border-indigo-500/40 bg-indigo-600/90 px-2 py-1 font-medium text-white hover:bg-indigo-600"
                href={fetchableUrl(result.downloadUrl)}
                target="_blank"
                rel="noreferrer"
              >
                Download preview ZIP
              </a>
            ) : null}
          </div>
          {result.warnings.length ? (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-[11px] text-amber-950 dark:border-amber-500/35 dark:bg-amber-500/10 dark:text-amber-100">
              <div className="font-semibold">Worker warnings</div>
              <ul className="mt-2 list-disc space-y-1 pl-4">
                {result.warnings.map((w, i) => (
                  <li key={`${w.code}-${i}`}>
                    <span className="font-medium">{w.severity}</span> · {w.message}
                    {w.source ? <span className="text-app-muted"> ({w.source})</span> : null}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      ) : null}

      {tab === 'fragments' ? (
        <div className="grid gap-3 desktop:grid-cols-1">
          <UnitMap title="Fragment map" emptyLabel="No fragments were returned for this package." rows={analysis.fragmentMap} result={result} />
          <UnitMap title="Slide map" emptyLabel="No slides were returned for this package." rows={analysis.slideMap} result={result} />
        </div>
      ) : null}

      {tab === 'navigation' ? (
        <div className="space-y-3">
          <div className="rounded-lg border border-app-border bg-app-fill/60 p-3">
            <h3 className="text-sm font-semibold text-app-text">Navigation graph</h3>
            {analysis.navigationNodes.length ? (
              <ul className="mt-2 space-y-2 text-[11px] text-app-text">
                {analysis.navigationNodes.map((node) => (
                  <li key={node.name} className="rounded border border-app-border/70 bg-app-surface p-2">
                    <div className="font-semibold">{node.name}</div>
                    <div className="mt-1 text-app-muted">
                      <span className="text-app-text">Outgoing:</span> {node.outgoing.length ? node.outgoing.join(', ') : '—'}
                    </div>
                    <div className="mt-0.5 text-app-muted">
                      <span className="text-app-text">Incoming:</span> {node.incoming.length ? node.incoming.join(', ') : '—'}
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-[11px] text-app-muted">No navigation nodes were inferred.</p>
            )}
          </div>

          <div className="rounded-lg border border-app-border bg-app-fill/60 p-3">
            <h3 className="text-sm font-semibold text-app-text">Declared edges</h3>
            {result.navigation.length ? (
              <div className="mt-2 overflow-x-auto">
                <table className="w-full min-w-[640px] text-left text-[11px]">
                  <thead className="text-[10px] uppercase tracking-wide text-app-muted">
                    <tr className="border-b border-app-border">
                      <th className="py-1.5 pr-3">From</th>
                      <th className="py-1.5 pr-3">To</th>
                      <th className="py-1.5 pr-3">Reason</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.navigation.map((edge, i) => (
                      <tr key={`${edge.from}-${edge.to}-${i}`} className="border-b border-app-border/60 align-top last:border-0">
                        <td className="py-2 pr-3 font-medium text-app-text">{edge.from}</td>
                        <td className="py-2 pr-3 text-app-text">{edge.to}</td>
                        <td className="py-2 pr-3 text-app-muted">{edge.reason}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="mt-2 text-[11px] text-app-muted">No navigation edges were returned.</p>
            )}
          </div>

          {(analysis.orphanSlides.length || analysis.deadEndSlides.length) ? (
            <div className="grid gap-2 tablet:grid-cols-2">
              {analysis.orphanSlides.length ? (
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-[11px] text-amber-950 dark:border-amber-500/35 dark:bg-amber-500/10 dark:text-amber-100">
                  <div className="font-semibold">Orphan slides</div>
                  <p className="mt-1 text-app-muted dark:text-amber-200/90">Slides with no detected incoming navigation.</p>
                  <ul className="mt-2 list-disc pl-4">
                    {analysis.orphanSlides.map((s) => (
                      <li key={s}>{s}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
              {analysis.deadEndSlides.length ? (
                <div className="rounded-lg border border-sky-200 bg-sky-50 p-3 text-[11px] text-sky-950 dark:border-sky-500/35 dark:bg-sky-500/10 dark:text-sky-100">
                  <div className="font-semibold">Dead-end slides</div>
                  <p className="mt-1 text-app-muted dark:text-sky-200/90">Slides with no detected outgoing navigation.</p>
                  <ul className="mt-2 list-disc pl-4">
                    {analysis.deadEndSlides.map((s) => (
                      <li key={s}>{s}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}

      {tab === 'screenshots' ? (
        <div className="space-y-3">
          {evidence.length ? (
            <div className="rounded-lg border border-app-border bg-app-fill/60 p-3">
              <h3 className="text-sm font-semibold text-app-text">Captured evidence</h3>
              <div className="mt-3 grid gap-3 tablet:grid-cols-2">
                {evidence.map((item) => {
                  const imgSrc = imageSrcUrl(item.href);
                  const external = isCrossOriginHttpUrl(item.href);
                  return (
                    <div key={item.label} className="rounded border border-app-border bg-app-surface p-2">
                      <div className="text-[11px] font-medium text-indigo-600 dark:text-indigo-300">{item.label}</div>
                      {external ? (
                        <ExternalUrlActions url={item.href} className="mt-1" />
                      ) : (
                        <a
                          className="mt-1 inline-block text-[11px] font-medium text-indigo-600 hover:underline dark:text-indigo-300"
                          href={fetchableUrl(item.href)}
                          target="_blank"
                          rel="noreferrer"
                        >
                          Open artifact
                        </a>
                      )}
                      {imgSrc ? (
                        <div className="mt-2 overflow-hidden rounded border border-app-border bg-black/5 dark:bg-white/5">
                          <img
                            className="max-h-64 w-full object-contain"
                            src={imgSrc}
                            alt={item.label}
                            loading="lazy"
                          />
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <p className="rounded-lg border border-app-border bg-app-fill/60 p-3 text-[11px] text-app-muted">No screenshot paths were included in this run.</p>
          )}
          <ScreenshotComparator />
        </div>
      ) : null}

      {tab === 'vendor' ? (
        <div className="space-y-3">
          <div className="rounded-lg border border-app-border bg-app-fill/60 p-3">
            <h3 className="text-sm font-semibold text-app-text">Vendor package QA</h3>
            <p className="mt-1 max-w-3xl text-[11px] text-app-muted">Readiness checks for attaching the preview bundle, screenshots, and inventory to a vendor or MLR workflow.</p>
            <ul className="mt-3 space-y-2">
              {analysis.vendorReadiness.map((item) => (
                <li key={item.id} className="rounded border border-app-border bg-app-surface p-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="text-[12px] font-semibold text-app-text">{item.label}</div>
                    <span className={`text-[10px] font-bold uppercase tracking-wide ${statusTone(item.status)}`}>{item.status.replace(/_/g, ' ')}</span>
                  </div>
                  <p className="mt-1 text-[11px] text-app-muted">{item.detail}</p>
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-lg border border-app-border bg-app-fill/60 p-3">
            <h3 className="text-sm font-semibold text-app-text">Vendor handoff draft</h3>
            <pre className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap rounded border border-app-border bg-app-surface p-2 text-[11px] text-app-text">{analysis.vendorHandoffDraft}</pre>
            <button
              type="button"
              className="mt-2 rounded-md border border-app-border bg-app-fill px-2 py-1 text-[11px] font-medium text-app-text hover:bg-app-fill-hover"
              onClick={() => void copyText(analysis.vendorHandoffDraft).then(() => markCopied('handoff'))}
            >
              Copy handoff draft
            </button>
            {copyHint === 'handoff' ? <span className="ml-2 text-[10px] text-emerald-600 dark:text-emerald-400">Copied</span> : null}
          </div>
        </div>
      ) : null}

      {tab === 'findings' ? (
        <div className="space-y-2">
          {sortedFindings.length ? (
            sortedFindings.map((f) => (
              <div key={f.id} className={`rounded-lg border p-3 text-[11px] ${toneForSeverity(f.severity)}`}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="text-[12px] font-semibold">{f.title}</div>
                  <span className="rounded-full border border-app-border/40 bg-app-surface/60 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide">{f.severity}</span>
                </div>
                <div className="mt-1 text-[10px] uppercase tracking-wide opacity-80">{f.area}{f.unitName ? ` · ${f.unitName}` : ''}</div>
                <p className="mt-2 leading-snug">{f.detail}</p>
                {f.nextAction ? <p className="mt-2 font-medium">Next: {f.nextAction}</p> : null}
              </div>
            ))
          ) : (
            <p className="text-[11px] text-app-muted">No findings were generated.</p>
          )}
        </div>
      ) : null}

      {tab === 'exports' ? (
        <div className="space-y-3 rounded-lg border border-app-border bg-app-fill/60 p-3">
          <div>
            <h3 className="text-sm font-semibold text-app-text">Downloads</h3>
            <p className="mt-1 text-[11px] text-app-muted">Export the raw suite JSON or a markdown QA memo derived from the analysis.</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {result.submissionPdfUrl ? (
                <a
                  className="rounded-md border border-indigo-500/40 bg-indigo-600/90 px-2 py-1 text-[11px] font-medium text-white hover:bg-indigo-600"
                  href={fetchableUrl(result.submissionPdfUrl)}
                  target="_blank"
                  rel="noreferrer"
                >
                  Submission PDF
                </a>
              ) : null}
              <button
                type="button"
                className="rounded-md border border-app-border bg-app-surface px-2 py-1 text-[11px] font-medium text-app-text hover:bg-app-fill-hover"
                onClick={() => downloadText(`${stem}_veeva-suite.md`, exportVeevaSuiteMarkdown(result, analysis), 'text/markdown')}
              >
                Download markdown report
              </button>
              <button
                type="button"
                className="rounded-md border border-app-border bg-app-surface px-2 py-1 text-[11px] font-medium text-app-text hover:bg-app-fill-hover"
                onClick={() => downloadText(`${stem}_veeva-suite.json`, JSON.stringify(result, null, 2), 'application/json')}
              >
                Download suite JSON
              </button>
            </div>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-app-text">Copy summaries</h3>
            <div className="mt-2 flex flex-wrap gap-2">
              <button
                type="button"
                className="rounded-md border border-app-border bg-app-surface px-2 py-1 text-[11px] font-medium text-app-text hover:bg-app-fill-hover"
                onClick={() => void copyText(analysis.internalSummary).then(() => markCopied('internal'))}
              >
                Copy internal summary
              </button>
              <button
                type="button"
                className="rounded-md border border-app-border bg-app-surface px-2 py-1 text-[11px] font-medium text-app-text hover:bg-app-fill-hover"
                onClick={() => void copyText(analysis.clientSafeSummary).then(() => markCopied('client'))}
              >
                Copy client-safe summary
              </button>
              <button
                type="button"
                className="rounded-md border border-app-border bg-app-surface px-2 py-1 text-[11px] font-medium text-app-text hover:bg-app-fill-hover"
                onClick={() => void copyText(analysis.vendorHandoffDraft).then(() => markCopied('exports-handoff'))}
              >
                Copy vendor handoff
              </button>
            </div>
            {copyHint ? <p className="mt-2 text-[10px] text-emerald-600 dark:text-emerald-400">Copied to clipboard.</p> : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}

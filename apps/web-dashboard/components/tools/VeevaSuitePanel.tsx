'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import {
  apiUrlForFetch,
  getVeevaSuiteHealth,
  postVeevaSuite,
  postVeevaSuiteTokens,
  uploadProjectDocument,
  type RteEmailPreviewStyle,
  type VeevaSuiteResponse,
} from '../../lib/api';
import { SubmissionGeneratorSection } from './veeva-suite/SubmissionGeneratorSection';
import { VeevaSuiteResult } from './veeva-suite/VeevaSuiteResult';

function veevaSuiteZipFileName(sourceName: string, runId: string): string {
  const stem = sourceName
    .replace(/\.zip$/i, '')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 72);
  const part = stem ? `${stem}-${runId}` : runId;
  return `veeva-suite-${part}.zip`;
}

function countInv(result: VeevaSuiteResponse | null, type: string) {
  return result?.inventory.filter((i) => i.type === type).length ?? 0;
}

function totalUnits(result: VeevaSuiteResponse | null) {
  return (result?.fragmentCount ?? 0) + (result?.slideCount ?? 0);
}

export function VeevaSuitePanel({ projectKey }: { projectKey: string }) {
  const zipInputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<VeevaSuiteResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [workerOk, setWorkerOk] = useState<boolean | null>(null);
  const [healthSupports, setHealthSupports] = useState<string[]>([]);
  const [firstName, setFirstName] = useState('Sample');
  const [lastName, setLastName] = useState('Recipient');
  const [screenshots, setScreenshots] = useState(true);
  const [scannedTokens, setScannedTokens] = useState<string[]>([]);
  const [tokenValues, setTokenValues] = useState<Record<string, string>>({});
  const [tokenScanMessage, setTokenScanMessage] = useState<string | null>(null);
  const [tokenScanning, setTokenScanning] = useState(false);
  const [attachSaving, setAttachSaving] = useState(false);
  const [attachMsg, setAttachMsg] = useState<string | null>(null);
  const [attachErr, setAttachErr] = useState<string | null>(null);
  const [rteEmailPreviewStyle, setRteEmailPreviewStyle] = useState<RteEmailPreviewStyle>('qa');

  useEffect(() => {
    void getVeevaSuiteHealth().then((h) => {
      setWorkerOk(!!h?.ok);
      setHealthSupports(Array.isArray(h?.supports) ? h.supports : []);
    });
  }, []);

  const resetForFile = useCallback((nextFile: File | null) => {
    setFile(nextFile);
    setResult(null);
    setError(null);
    setAttachMsg(null);
    setAttachErr(null);
    setRteEmailPreviewStyle('qa');
    setScannedTokens([]);
    setTokenValues({});
    setTokenScanning(false);
    setTokenScanMessage(
      nextFile
        ? 'Optional: scan tokens before building. RTE merge fields can be mocked; CLM decks usually skip token replacement.'
        : null,
    );
  }, []);

  const rescanTokens = useCallback(() => {
    if (!file) return;
    setTokenScanning(true);
    setTokenScanMessage(null);
    void postVeevaSuiteTokens(file)
      .then((r) => {
        setScannedTokens(r.tokens);
        setTokenValues((prev) => {
          const next: Record<string, string> = {};
          for (const tok of r.tokens) next[tok] = prev[tok] ?? '';
          return next;
        });
        if (r.packageType !== 'rte') {
          setTokenScanMessage('Token scan completed. This package looks like CLM/non-RTE, so token fields may not be relevant.');
        } else if (!r.tokens.length) {
          setTokenScanMessage('No merge tokens were found in the RTE shell/fragments.');
        } else {
          setTokenScanMessage(null);
        }
      })
      .catch((e) => {
        setTokenScanMessage(e instanceof Error ? e.message : String(e));
      })
      .finally(() => setTokenScanning(false));
  }, [file]);

  const canSubmit = useMemo(() => !!file && !loading, [file, loading]);

  const submit = useCallback(async () => {
    if (!file) return;
    setLoading(true);
    setError(null);
    setResult(null);
    setRteEmailPreviewStyle('qa');
    setAttachMsg(null);
    setAttachErr(null);
    try {
      const tokenMap: Record<string, string> = {
        ...Object.fromEntries(scannedTokens.map((tok) => [tok, tokenValues[tok] ?? ''])),
        '##accFname##': firstName,
        '##accLname##': lastName,
      };
      setResult(await postVeevaSuite(file, tokenMap, screenshots));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [file, firstName, lastName, screenshots, scannedTokens, tokenValues]);

  const canAttach = useMemo(
    () => !!result?.downloadUrl && projectKey.trim().length > 0 && !attachSaving,
    [result?.downloadUrl, projectKey, attachSaving],
  );

  const attachToProject = useCallback(async () => {
    if (!result?.downloadUrl || !projectKey.trim()) return;
    setAttachSaving(true);
    setAttachMsg(null);
    setAttachErr(null);
    try {
      const url = apiUrlForFetch(result.downloadUrl);
      const res = await fetch(url, { credentials: 'include', cache: 'no-store' });
      if (!res.ok) throw new Error((await res.text()) || `Download failed (${res.status})`);
      const blob = await res.blob();
      const name = veevaSuiteZipFileName(result.sourceName, result.id);
      const file = new File([blob], name, { type: 'application/zip' });
      await uploadProjectDocument(projectKey.trim(), file, 'veeva_suite');
      setAttachMsg(`Saved “${name}” to project files as kind veeva_suite. Open Workspaces → Project files to download.`);
    } catch (e: unknown) {
      setAttachErr(e instanceof Error ? e.message : String(e));
    } finally {
      setAttachSaving(false);
    }
  }, [result, projectKey]);

  const modeLabel =
    result?.packageType === 'clm' ? 'CLM deck' : result?.packageType === 'rte' ? 'RTE email' : 'Veeva package';

  return (
    <div className="rounded border border-app-border bg-app-fill/70 p-3">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-app-text">Veeva Suite</h2>
          <p className="mt-1 max-w-4xl text-[11px] text-app-muted">
            RTE preview, CLM preview, fragment logic mapping, CLM navigation mapping, screenshot QA, and vendor package QA from a single ZIP intake.
          </p>
        </div>
        <div className="rounded-full border border-app-border bg-app-surface px-2.5 py-1 text-[10px] font-medium text-app-muted">
          Worker: {workerOk === null ? 'checking' : workerOk ? 'ready' : 'unreachable'}
        </div>
      </div>

      {workerOk === false ? (
        <p className="mb-2 rounded-md border border-amber-200 bg-amber-50 p-2 text-[11px] text-amber-900 dark:border-amber-500/35 dark:bg-amber-500/10 dark:text-amber-100">
          Veeva Suite service is not reachable (agent-api → veeva-suite-worker). Check compose and VEEVA_SUITE_WORKER_URL.
        </p>
      ) : null}

      <div className="grid gap-2 desktop:grid-cols-[1.3fr_.6fr_.6fr_1fr_auto]">
        <div className="min-w-[220px] text-[11px] text-app-muted">
          <span className="mb-0.5 block font-medium text-app-text">Veeva ZIP</span>
          <div className="mt-1 flex w-full min-w-0 items-stretch overflow-hidden rounded-md border border-app-border bg-app-fill">
            <button
              type="button"
              onClick={() => zipInputRef.current?.click()}
              className="shrink-0 border-r border-app-border bg-app-surface px-2.5 py-1.5 text-[11px] font-medium text-app-text hover:bg-app-fill-hover"
            >
              Choose file
            </button>
            <span
              className={`min-w-0 flex-1 truncate px-2 py-1.5 text-xs ${file ? 'text-app-text' : 'text-app-muted'}`}
              aria-live="polite"
              title={file?.name}
            >
              {file?.name ?? 'No file selected'}
            </span>
            <input
              ref={zipInputRef}
              id="veeva-suite-zip"
              type="file"
              accept=".zip,application/zip"
              className="sr-only"
              onClick={(e) => {
                e.currentTarget.value = '';
              }}
              onChange={(e) => {
                const f = e.target.files?.[0] ?? null;
                resetForFile(f);
              }}
            />
          </div>
        </div>
        <label className="text-[11px] text-app-muted">
          <span className="mb-0.5 block font-medium text-app-text">Mock first</span>
          <input
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            className="mt-1 w-full rounded-md border border-app-border bg-app-fill p-1.5 text-xs text-app-text outline-none"
          />
        </label>
        <label className="text-[11px] text-app-muted">
          <span className="mb-0.5 block font-medium text-app-text">Mock last</span>
          <input
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            className="mt-1 w-full rounded-md border border-app-border bg-app-fill p-1.5 text-xs text-app-text outline-none"
          />
        </label>
        <label className="flex items-end gap-2 pb-1.5 text-[11px] text-app-muted">
          <input type="checkbox" checked={screenshots} onChange={(e) => setScreenshots(e.target.checked)} />
          <span>Generate screenshot/PDF evidence</span>
        </label>
        <button
          type="button"
          disabled={!canSubmit}
          onClick={() => void submit()}
          className="self-end rounded-md border border-indigo-500/40 bg-indigo-600/90 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-600 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading ? 'Building suite…' : 'Build Veeva Suite'}
        </button>
      </div>

      {healthSupports.length ? (
        <div className="mt-2 flex flex-wrap gap-1 text-[10px] text-app-muted">
          {healthSupports.map((item) => (
            <span key={item} className="rounded-full border border-app-border bg-app-surface px-2 py-0.5">{item}</span>
          ))}
        </div>
      ) : null}

      {file ? (
        <details className="mt-3 rounded border border-app-border bg-app-fill/60 p-2 text-[11px]" open>
          <summary className="cursor-pointer font-medium text-app-text">
            RTE merge token mocks{scannedTokens.length ? ` (${scannedTokens.length})` : ''}
          </summary>
          <p className="mt-1 text-app-muted">
            Token mocks apply to RTE preview assembly. Values are escaped as text. First/last name fields still map to <code className="text-[10px]">##accFname##</code> /{' '}
            <code className="text-[10px]">##accLname##</code> and override those keys if present.
          </p>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            {tokenScanning ? <span className="text-app-muted">Scanning ZIP…</span> : null}
            <button
              type="button"
              disabled={!file || tokenScanning}
              onClick={() => rescanTokens()}
              className="rounded border border-app-border bg-app-fill px-2 py-0.5 text-[10px] font-medium hover:bg-app-fill-hover disabled:opacity-50"
            >
              Scan tokens
            </button>
          </div>
          {tokenScanMessage ? (
            <p className="mt-1 text-[10px] text-amber-700 dark:text-amber-300" role="status">
              {tokenScanMessage}
            </p>
          ) : null}
          {scannedTokens.length > 0 ? (
            <div className="mt-2 grid max-h-52 gap-2 overflow-y-auto pr-1 tablet:grid-cols-2 desktop:grid-cols-3">
              {scannedTokens.map((tok) => (
                <label key={tok} className="block">
                  <span className="mb-0.5 block break-all font-mono text-[10px] text-app-muted">{tok}</span>
                  <input
                    value={tokenValues[tok] ?? ''}
                    onChange={(e) => setTokenValues((prev) => ({ ...prev, [tok]: e.target.value }))}
                    className="w-full rounded-md border border-app-border bg-app-fill px-2 py-1 text-xs text-app-text outline-none"
                    autoComplete="off"
                  />
                </label>
              ))}
            </div>
          ) : null}
        </details>
      ) : null}

      {error ? (
        <p className="mt-2 rounded-md border border-rose-200 bg-rose-50 p-2 text-[11px] text-rose-700 dark:border-rose-500/35 dark:bg-rose-500/10 dark:text-rose-100" role="alert">
          {error}
        </p>
      ) : null}

      {result ? (
        <div className="mt-3 space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-app-border bg-app-surface p-2 text-[11px] text-app-text">
            <div>
              <span className="font-medium">{result.sourceName}</span>
              <span className="ml-2 text-app-muted">
                {modeLabel} · {totalUnits(result)} units · {countInv(result, 'link')} links · {countInv(result, 'image')} images · {countInv(result, 'veeva-api')} Veeva API · {result.warnings.length} worker warnings
              </span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              <button
                type="button"
                disabled={!canAttach}
                title={!projectKey.trim() ? 'Select a project in the header' : undefined}
                onClick={() => void attachToProject()}
                className="rounded border border-indigo-500/50 bg-app-fill px-2 py-1 text-[10px] font-medium text-app-text hover:bg-app-fill-hover disabled:cursor-not-allowed disabled:opacity-50"
              >
                {attachSaving ? 'Attaching…' : 'Attach suite ZIP to project'}
              </button>
              <a className="rounded border border-emerald-600/40 bg-emerald-700/80 px-2 py-1 text-[10px] font-medium text-white hover:bg-emerald-700" href={result.downloadUrl}>
                Download suite ZIP
              </a>
            </div>
          </div>
          {attachMsg ? (
            <div className="rounded-md border border-emerald-200 bg-emerald-50/90 p-2 text-[10px] text-emerald-950 dark:border-emerald-500/35 dark:bg-emerald-500/10 dark:text-emerald-100">
              {attachMsg}
            </div>
          ) : null}
          {attachErr ? (
            <div className="rounded-md border border-rose-200 bg-rose-50 p-2 text-[10px] text-rose-800 dark:border-rose-500/35 dark:bg-rose-500/10 dark:text-rose-100">
              Could not attach suite to project: {attachErr}
            </div>
          ) : null}
          {result.packageType === 'rte' ? (
            <SubmissionGeneratorSection
              result={result}
              projectKey={projectKey}
              onResult={(next) => setResult(next)}
              previewMode={rteEmailPreviewStyle === 'tokens' ? 'tokens' : 'processed'}
              onPreviewModeChange={(mode) => setRteEmailPreviewStyle(mode)}
            />
          ) : null}
          <VeevaSuiteResult
            result={result}
            rteEmailPreviewStyle={rteEmailPreviewStyle}
            onRteEmailPreviewStyleChange={setRteEmailPreviewStyle}
          />
        </div>
      ) : null}
    </div>
  );
}

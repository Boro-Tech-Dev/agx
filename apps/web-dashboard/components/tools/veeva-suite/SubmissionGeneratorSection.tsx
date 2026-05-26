'use client';

import { useCallback, useMemo, useState } from 'react';

import {
  apiUrlForFetch,
  postVeevaSuiteSubmission,
  uploadProjectDocument,
  type VeevaSuiteResponse,
} from '../../../lib/api';

function submissionPdfFileName(emailTitle: string, runId: string, mode: string): string {
  const stem = emailTitle
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 72);
  const part = stem ? `${stem}-${runId}` : runId;
  return `submission-${mode}-${part}.pdf`;
}

export function SubmissionGeneratorSection({
  result,
  projectKey,
  onResult,
  previewMode,
  onPreviewModeChange,
}: {
  result: VeevaSuiteResponse;
  projectKey: string;
  onResult: (next: VeevaSuiteResponse) => void;
  previewMode: 'processed' | 'tokens';
  onPreviewModeChange: (mode: 'processed' | 'tokens') => void;
}) {
  const [emailTitle, setEmailTitle] = useState(result.submissionMeta?.emailTitle ?? '');
  const [toAddress, setToAddress] = useState(result.submissionMeta?.toAddress ?? '[Recipient]');
  const [fromAddress, setFromAddress] = useState(
    result.submissionMeta?.fromAddress ?? '[Name] <noreply@example.com>',
  );
  const [subjectRows, setSubjectRows] = useState<string[]>(
    result.submissionMeta?.subjectLines?.length ? result.submissionMeta.subjectLines : [''],
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [attachSaving, setAttachSaving] = useState(false);
  const [attachMsg, setAttachMsg] = useState<string | null>(null);
  const [attachErr, setAttachErr] = useState<string | null>(null);

  const trimmedSubjects = useMemo(
    () => subjectRows.map((s) => s.trim()).filter(Boolean),
    [subjectRows],
  );

  const canGenerate = useMemo(
    () =>
      emailTitle.trim().length > 0 &&
      toAddress.trim().length > 0 &&
      fromAddress.trim().length > 0 &&
      trimmedSubjects.length > 0 &&
      !loading,
    [emailTitle, toAddress, fromAddress, trimmedSubjects.length, loading],
  );

  const generate = useCallback(async () => {
    setLoading(true);
    setError(null);
    setAttachMsg(null);
    setAttachErr(null);
    try {
      const next = await postVeevaSuiteSubmission(result.id, {
        emailTitle: emailTitle.trim(),
        subjectLines: trimmedSubjects,
        toAddress: toAddress.trim(),
        fromAddress: fromAddress.trim(),
        previewMode,
      });
      onResult(next);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [result.id, emailTitle, trimmedSubjects, toAddress, fromAddress, previewMode, onResult]);

  const canAttach = useMemo(
    () => !!result.submissionPdfUrl && projectKey.trim().length > 0 && !attachSaving,
    [result.submissionPdfUrl, projectKey, attachSaving],
  );

  const attachToProject = useCallback(async () => {
    if (!result.submissionPdfUrl || !projectKey.trim()) return;
    setAttachSaving(true);
    setAttachMsg(null);
    setAttachErr(null);
    try {
      const url = apiUrlForFetch(result.submissionPdfUrl);
      const res = await fetch(url, { credentials: 'include', cache: 'no-store' });
      if (!res.ok) throw new Error((await res.text()) || `Download failed (${res.status})`);
      const blob = await res.blob();
      const mode = result.submissionMeta?.previewMode ?? previewMode;
      const name = submissionPdfFileName(emailTitle.trim() || 'submission', result.id, mode);
      const file = new File([blob], name, { type: 'application/pdf' });
      await uploadProjectDocument(projectKey.trim(), file, 'general');
      setAttachMsg(`Saved “${name}” to project files.`);
    } catch (e: unknown) {
      setAttachErr(e instanceof Error ? e.message : String(e));
    } finally {
      setAttachSaving(false);
    }
  }, [result.submissionPdfUrl, result.id, result.submissionMeta?.previewMode, projectKey, emailTitle, previewMode]);

  return (
    <details className="rounded-lg border border-app-border bg-app-fill/60 p-3" open>
      <summary className="cursor-pointer text-sm font-semibold text-app-text">Submission Generator</summary>
      <p className="mt-1 max-w-3xl text-[11px] text-app-muted">
        After an RTE build, enter campaign details and subject lines, then generate a 3-page submission PDF (overview
        with desktop 600px and mobile 400px previews, then full desktop, then full mobile). The first subject line
        appears in the email chrome. Regenerate to switch processed copy vs magenta Veeva tokens.
      </p>

      <div className="mt-3 grid gap-3 desktop:grid-cols-2">
        <label className="block text-[11px] text-app-muted desktop:col-span-2">
          <span className="mb-0.5 block font-medium text-app-text">Email / campaign name</span>
          <input
            value={emailTitle}
            onChange={(e) => setEmailTitle(e.target.value)}
            placeholder="DSE RESOURCES VAE"
            className="mt-1 w-full max-w-xl rounded-md border border-app-border bg-app-fill p-1.5 text-xs text-app-text outline-none"
            autoComplete="off"
          />
        </label>

        <label className="block text-[11px] text-app-muted">
          <span className="mb-0.5 block font-medium text-app-text">To</span>
          <input
            value={toAddress}
            onChange={(e) => setToAddress(e.target.value)}
            placeholder="[Recipient]"
            className="mt-1 w-full rounded-md border border-app-border bg-app-fill p-1.5 text-xs text-app-text outline-none"
            autoComplete="off"
          />
        </label>

        <label className="block text-[11px] text-app-muted">
          <span className="mb-0.5 block font-medium text-app-text">From</span>
          <input
            value={fromAddress}
            onChange={(e) => setFromAddress(e.target.value)}
            placeholder="[Name] &lt;noreply@example.com&gt;"
            className="mt-1 w-full rounded-md border border-app-border bg-app-fill p-1.5 text-xs text-app-text outline-none"
            autoComplete="off"
          />
        </label>

        <div className="desktop:col-span-2">
          <span className="mb-1 block text-[11px] font-medium text-app-text">Preview style</span>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => onPreviewModeChange('processed')}
              className={`rounded-md border px-2.5 py-1 text-[11px] font-medium ${
                previewMode === 'processed'
                  ? 'border-indigo-500/50 bg-indigo-600/90 text-white'
                  : 'border-app-border bg-app-surface text-app-text hover:bg-app-fill-hover'
              }`}
            >
              Processed copy
            </button>
            <button
              type="button"
              onClick={() => onPreviewModeChange('tokens')}
              className={`rounded-md border px-2.5 py-1 text-[11px] font-medium ${
                previewMode === 'tokens'
                  ? 'border-indigo-500/50 bg-indigo-600/90 text-white'
                  : 'border-app-border bg-app-surface text-app-text hover:bg-app-fill-hover'
              }`}
            >
              Veeva tokens (magenta)
            </button>
          </div>
        </div>

        <div className="desktop:col-span-2">
          <span className="mb-1 block text-[11px] font-medium text-app-text">Subject line options</span>
          <ul className="space-y-1.5">
            {subjectRows.map((line, index) => (
              <li key={index} className="flex flex-wrap items-center gap-2">
                <input
                  value={line}
                  onChange={(e) =>
                    setSubjectRows((prev) => prev.map((row, i) => (i === index ? e.target.value : row)))
                  }
                  placeholder={index === 0 ? 'First subject (used in preview chrome)' : 'Subject line'}
                  className="min-w-[220px] flex-1 rounded-md border border-app-border bg-app-fill p-1.5 text-xs text-app-text outline-none"
                  autoComplete="off"
                />
                <button
                  type="button"
                  disabled={subjectRows.length <= 1}
                  onClick={() => setSubjectRows((prev) => prev.filter((_, i) => i !== index))}
                  className="rounded border border-app-border bg-app-surface px-2 py-1 text-[10px] text-app-muted hover:bg-app-fill-hover disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
          <button
            type="button"
            onClick={() => setSubjectRows((prev) => [...prev, ''])}
            disabled={subjectRows.length >= 12}
            className="mt-2 rounded border border-app-border bg-app-surface px-2 py-1 text-[10px] font-medium text-app-text hover:bg-app-fill-hover disabled:opacity-50"
          >
            Add subject line
          </button>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={!canGenerate}
          onClick={() => void generate()}
          className="rounded-md border border-indigo-500/40 bg-indigo-600/90 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-600 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading ? 'Generating PDF…' : 'Generate submission PDF'}
        </button>
        {result.submissionPdfUrl ? (
          <a
            className="rounded border border-emerald-600/40 bg-emerald-700/80 px-2 py-1.5 text-[11px] font-medium text-white hover:bg-emerald-700"
            href={apiUrlForFetch(result.submissionPdfUrl)}
            target="_blank"
            rel="noreferrer"
          >
            Open submission PDF
          </a>
        ) : null}
        <button
          type="button"
          disabled={!canAttach}
          title={!projectKey.trim() ? 'Select a project in the header' : undefined}
          onClick={() => void attachToProject()}
          className="rounded border border-app-border bg-app-surface px-2 py-1.5 text-[11px] font-medium text-app-text hover:bg-app-fill-hover disabled:cursor-not-allowed disabled:opacity-50"
        >
          {attachSaving ? 'Attaching…' : 'Attach PDF to project'}
        </button>
      </div>

      {result.submissionMeta?.generatedAt ? (
        <p className="mt-2 text-[10px] text-app-muted">
          Last generated {new Date(result.submissionMeta.generatedAt).toLocaleString()}
          {result.submissionMeta.previewMode ? ` (${result.submissionMeta.previewMode})` : ''}.
        </p>
      ) : null}

      {error ? (
        <p className="mt-2 rounded-md border border-rose-200 bg-rose-50 p-2 text-[11px] text-rose-700 dark:border-rose-500/35 dark:bg-rose-500/10 dark:text-rose-100" role="alert">
          {error}
        </p>
      ) : null}
      {attachMsg ? (
        <p className="mt-2 rounded-md border border-emerald-200 bg-emerald-50/90 p-2 text-[10px] text-emerald-950 dark:border-emerald-500/35 dark:bg-emerald-500/10 dark:text-emerald-100">
          {attachMsg}
        </p>
      ) : null}
      {attachErr ? (
        <p className="mt-2 rounded-md border border-rose-200 bg-rose-50 p-2 text-[10px] text-rose-800 dark:border-rose-500/35 dark:bg-rose-500/10 dark:text-rose-100">
          {attachErr}
        </p>
      ) : null}
    </details>
  );
}

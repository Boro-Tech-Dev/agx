'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

import {
  downloadProjectDocumentText,
  listProjectDocuments,
  listTacticsLibrary,
  postBriefAutofill,
  postBriefAutofillFromDocument,
  uploadProjectDocument,
} from '../../../lib/api';
import type { BriefTemplateBundle } from '../../../lib/briefGenerator/briefMergeCore';
import {
  buildBriefDocPayload,
  emptyValues,
  enrichFieldMeta,
  listPresetsForTactic,
  mergeDefaultValues,
  parseBriefDoc,
  visibleSectionsForTactic,
} from '../../../lib/briefGenerator/mergeBriefTemplate';
import { renderBriefMarkdown } from '../../../lib/briefGenerator/renderMarkdown';
import type { BriefSectionDef } from '../../../lib/briefGenerator/types';
import { filterLibraryRowsForAttach, filterTacticsByQuery } from '../../../lib/tacticLibraryFilter';

function tacticLabel(row: Record<string, unknown>): string {
  const name = typeof row.name === 'string' ? row.name : '';
  const key = typeof row.key === 'string' ? row.key : '';
  return key ? `${name} (${key})` : name || key || String(row.id ?? '');
}

export type BriefFactoryInnerProps = {
  projectKey: string;
  bundle: BriefTemplateBundle;
  /** When prop is passed (including null), show autofill-from-document strip; omit on /tools Brief Generator. */
  documentAutofillId?: string | null;
  onDocumentAutofillIdChange?: (id: string | null) => void;
};

export function BriefFactoryInner({
  projectKey,
  bundle,
  documentAutofillId,
  onDocumentAutofillIdChange,
}: BriefFactoryInnerProps) {
  const [libAll, setLibAll] = useState<Record<string, unknown>[]>([]);
  const [libQuery, setLibQuery] = useState('');
  const [libLoading, setLibLoading] = useState(false);
  const [tacticKey, setTacticKey] = useState('');
  const [presetId, setPresetId] = useState('');
  const [values, setValues] = useState<Record<string, string>>(() => emptyValues(bundle));
  const [proseDraft, setProseDraft] = useState('');
  const [savedDocs, setSavedDocs] = useState<Record<string, unknown>[]>([]);
  const [selectedDocId, setSelectedDocId] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    setValues((prev) => {
      const base = emptyValues(bundle);
      for (const k of Object.keys(base)) {
        if (prev[k] != null && prev[k] !== '') base[k] = prev[k];
      }
      return base;
    });
  }, [bundle]);

  const tacticRows = useMemo(() => {
    const base = [...filterLibraryRowsForAttach(libAll)].sort((a, b) =>
      tacticLabel(a).localeCompare(tacticLabel(b)),
    );
    const filtered = filterTacticsByQuery(base, libQuery);
    if (!tacticKey) return filtered;
    const has = filtered.some((r) => String(r.key) === tacticKey);
    if (has) return filtered;
    const selected = base.find((r) => String(r.key) === tacticKey);
    return selected ? [selected, ...filtered] : filtered;
  }, [libAll, libQuery, tacticKey]);

  const presets = useMemo(() => listPresetsForTactic(bundle, tacticKey), [bundle, tacticKey]);

  const sections: BriefSectionDef[] = useMemo(() => {
    const vis = visibleSectionsForTactic(bundle, tacticKey);
    return vis.map((sec) => ({
      ...sec,
      fields: sec.fields.map((f) => enrichFieldMeta(bundle, tacticKey, f)),
    }));
  }, [bundle, tacticKey]);

  const markdown = useMemo(
    () => renderBriefMarkdown(sections, values, 'Creative brief'),
    [sections, values],
  );

  const reloadSavedDocs = useCallback(async () => {
    if (!projectKey.trim()) {
      setSavedDocs([]);
      return;
    }
    try {
      const rows = await listProjectDocuments(projectKey.trim(), { kinds: ['brief'] });
      setSavedDocs(Array.isArray(rows) ? rows : []);
    } catch {
      setSavedDocs([]);
    }
  }, [projectKey]);

  useEffect(() => {
    void reloadSavedDocs();
  }, [reloadSavedDocs]);

  const loadLibrary = useCallback(async () => {
    setLibLoading(true);
    setErr(null);
    try {
      const rows = await listTacticsLibrary();
      const list = filterLibraryRowsForAttach(Array.isArray(rows) ? rows : []);
      setLibAll(list);
      setTacticKey((prev) => {
        if (prev && list.some((r) => String(r.key) === prev)) return prev;
        const firstKey = list.find((r) => typeof r.key === 'string')?.key;
        return typeof firstKey === 'string' ? firstKey : '';
      });
    } catch (e: unknown) {
      setLibAll([]);
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setLibLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadLibrary();
  }, [loadLibrary]);

  useEffect(() => {
    if (!presetId || !presets.some((p) => p.id === presetId)) {
      setPresetId('');
    }
  }, [presetId, presets]);

  const applyPresetDefaults = useCallback(() => {
    setErr(null);
    setMsg(null);
    setValues(mergeDefaultValues(bundle, tacticKey, presetId || null));
    setMsg(presetId ? 'Loaded preset defaults into fields.' : 'Reset fields to empty template.');
  }, [bundle, tacticKey, presetId]);

  const clearFields = useCallback(() => {
    setErr(null);
    setMsg(null);
    setValues(emptyValues(bundle));
    setMsg('Cleared all fields.');
  }, [bundle]);

  const fieldIdsAndLabels = useCallback(() => {
    const field_ids: string[] = [];
    const field_labels: Record<string, string> = {};
    for (const sec of sections) {
      for (const f of sec.fields) {
        field_ids.push(f.id);
        field_labels[f.id] = f.label;
      }
    }
    return { field_ids, field_labels };
  }, [sections]);

  const mergeExtracted = useCallback((field_ids: string[], res: { extracted: Record<string, string> }) => {
    setValues((prev) => {
      const next = { ...prev };
      for (const id of field_ids) {
        const v = res.extracted[id];
        if (typeof v === 'string' && v.trim()) next[id] = v.trim();
      }
      return next;
    });
  }, []);

  const runAutofill = useCallback(async () => {
    setErr(null);
    setMsg(null);
    const prose = proseDraft.trim();
    if (!prose) {
      setErr('Paste prose before running auto-fill.');
      return;
    }
    const { field_ids, field_labels } = fieldIdsAndLabels();
    setBusy(true);
    try {
      const res = await postBriefAutofill({ prose, field_ids, field_labels });
      if (res.error) {
        setErr(typeof res.error === 'string' ? res.error : 'Model returned an error.');
      }
      mergeExtracted(field_ids, res);
      const hint = res.parse_failed ? ' (parser fallback — verify fields).' : '';
      setMsg(
        `Merged non-empty model output into fields${hint}${res.model_used ? ` · ${res.model_used}` : ''}`,
      );
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }, [fieldIdsAndLabels, mergeExtracted, proseDraft]);

  const runAutofillFromUploadedDoc = useCallback(async () => {
    if (!projectKey.trim() || !documentAutofillId) {
      setErr('Select a processed document first.');
      return;
    }
    setErr(null);
    setMsg(null);
    const { field_ids, field_labels } = fieldIdsAndLabels();
    setBusy(true);
    try {
      const res = await postBriefAutofillFromDocument({
        project_key: projectKey.trim(),
        source_document_id: documentAutofillId,
        field_ids,
        field_labels,
      });
      if (res.error) {
        setErr(typeof res.error === 'string' ? res.error : 'Model returned an error.');
      }
      mergeExtracted(field_ids, res);
      const hint = res.parse_failed ? ' (parser fallback — verify fields).' : '';
      setMsg(
        `Autofill from document merged${hint}${res.model_used ? ` · ${res.model_used}` : ''}${typeof res.prose_chars_used === 'number' ? ` · ${res.prose_chars_used} chars` : ''}`,
      );
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }, [documentAutofillId, fieldIdsAndLabels, mergeExtracted, projectKey]);

  const copyMarkdown = useCallback(async () => {
    setErr(null);
    try {
      await navigator.clipboard.writeText(markdown);
      setMsg('Markdown copied to clipboard.');
    } catch {
      setErr('Could not copy to clipboard.');
    }
  }, [markdown]);

  const saveDoc = useCallback(async () => {
    if (!projectKey.trim()) return;
    setErr(null);
    setMsg(null);
    const payload = buildBriefDocPayload({
      tacticKey: tacticKey || null,
      presetId: presetId || null,
      values,
      markdown,
    });
    setBusy(true);
    try {
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
      const slug = new Date().toISOString().slice(0, 10);
      const file = new File([blob], `brief-generator-${slug}-${Date.now()}.json`, { type: 'application/json' });
      await uploadProjectDocument(projectKey.trim(), file, 'brief');
      setMsg('Brief saved to project files (kind brief).');
      await reloadSavedDocs();
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }, [markdown, presetId, projectKey, reloadSavedDocs, tacticKey, values]);

  const loadSelectedDoc = useCallback(async () => {
    if (!projectKey.trim() || !selectedDocId) return;
    setErr(null);
    setMsg(null);
    setBusy(true);
    try {
      const text = await downloadProjectDocumentText(projectKey.trim(), selectedDocId);
      const raw = JSON.parse(text) as unknown;
      const parsed = parseBriefDoc(bundle, raw);
      if (parsed.ok === false) {
        setErr(parsed.error);
        return;
      }
      const doc = parsed.doc;
      setTacticKey(doc.tactic_key || '');
      setPresetId(doc.preset_id || '');
      setValues(doc.values);
      setMsg('Loaded brief from project file.');
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }, [bundle, projectKey, selectedDocId]);

  const inputCls =
    'mt-1 w-full rounded-md border border-app-border bg-app-fill p-1.5 text-xs text-app-text outline-none focus:border-indigo-400 focus:bg-app-surface dark:focus:border-indigo-500';

  const canSave = Boolean(projectKey.trim());

  return (
    <div className="space-y-3 text-xs text-app-text">
      {documentAutofillId !== undefined ? (
        <div className="rounded-lg border border-app-border bg-app-surface/60 p-2">
          <div className="text-[10px] font-semibold uppercase tracking-wide text-app-muted">Autofill from ingested document</div>
          <p className="mt-0.5 text-[10px] text-app-muted">
            Document must show status <code className="rounded bg-app-fill px-0.5">ready</code> in Uploads tab.
          </p>
          <button
            type="button"
            disabled={busy || !documentAutofillId || !projectKey.trim()}
            onClick={() => void runAutofillFromUploadedDoc()}
            className="mt-1 rounded-md border border-emerald-500/35 bg-emerald-500/10 px-2 py-1 text-[11px] font-semibold text-emerald-100 hover:bg-emerald-500/20 disabled:opacity-50"
          >
            Send selected upload to autofill
          </button>
          {onDocumentAutofillIdChange ? (
            <button
              type="button"
              className="ml-2 mt-1 rounded-md border border-app-border bg-app-fill px-2 py-1 text-[11px] text-app-muted"
              onClick={() => onDocumentAutofillIdChange(null)}
            >
              Clear selection
            </button>
          ) : null}
        </div>
      ) : null}

      <div className="flex flex-wrap items-end gap-2">
        <div className="min-w-[200px] flex-1">
          <label className="block text-[10px] font-semibold uppercase tracking-wide text-app-muted">Tactic type</label>
          <select
            value={tacticKey}
            onChange={(e) => setTacticKey(e.target.value)}
            disabled={libLoading || !libAll.length}
            className={inputCls}
          >
            {!libAll.length ? <option value="">Loading library…</option> : null}
            {tacticRows.map((row) => (
              <option key={String(row.id)} value={String(row.key ?? '')}>
                {tacticLabel(row)}
              </option>
            ))}
          </select>
        </div>
        <div className="min-w-[180px] flex-1">
          <label className="block text-[10px] font-semibold uppercase tracking-wide text-app-muted">Preset</label>
          <select
            value={presetId}
            onChange={(e) => setPresetId(e.target.value)}
            className={inputCls}
            disabled={!presets.length}
          >
            <option value="">None</option>
            {presets.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </select>
        </div>
        <div className="min-w-[140px] flex-1">
          <label className="block text-[10px] font-semibold uppercase tracking-wide text-app-muted">Filter library</label>
          <input
            type="search"
            value={libQuery}
            onChange={(e) => setLibQuery(e.target.value)}
            placeholder="Search tactics…"
            className={inputCls}
          />
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={() => applyPresetDefaults()}
          className="rounded-md border border-app-border bg-app-fill px-2 py-1 text-[11px] font-medium hover:bg-app-fill-hover disabled:opacity-50"
        >
          Apply preset / reset template
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => clearFields()}
          className="rounded-md border border-app-border bg-app-fill px-2 py-1 text-[11px] font-medium hover:bg-app-fill-hover disabled:opacity-50"
        >
          Clear fields
        </button>
        <button
          type="button"
          disabled={busy || !canSave}
          onClick={() => void saveDoc()}
          className="rounded-md border border-indigo-500/40 bg-indigo-500/15 px-2 py-1 text-[11px] font-semibold text-indigo-100 hover:bg-indigo-500/25 disabled:opacity-50"
        >
          Save to project
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => void copyMarkdown()}
          className="rounded-md border border-app-border bg-app-fill px-2 py-1 text-[11px] font-medium hover:bg-app-fill-hover disabled:opacity-50"
        >
          Copy Markdown
        </button>
      </div>

      <div className="rounded-lg border border-app-border bg-app-surface/60 p-2">
        <label className="block text-[10px] font-semibold uppercase tracking-wide text-app-muted">
          LLM auto-fill (paste rough notes or an email thread)
        </label>
        <textarea
          value={proseDraft}
          onChange={(e) => setProseDraft(e.target.value)}
          rows={4}
          placeholder="Paste unstructured prose. Non-empty extracted fields are merged into the form (requires model-router / Ollama)."
          className={`${inputCls} font-mono`}
        />
        <button
          type="button"
          disabled={busy}
          onClick={() => void runAutofill()}
          className="mt-1 rounded-md border border-emerald-500/35 bg-emerald-500/10 px-2 py-1 text-[11px] font-semibold text-emerald-100 hover:bg-emerald-500/20 disabled:opacity-50"
        >
          Auto-fill from prose
        </button>
      </div>

      <div className="flex flex-wrap items-end gap-2 border-t border-app-border pt-2">
        <div className="min-w-[220px] flex-1">
          <label className="block text-[10px] font-semibold uppercase tracking-wide text-app-muted">Saved briefs</label>
          <select
            value={selectedDocId}
            onChange={(e) => setSelectedDocId(e.target.value)}
            className={inputCls}
          >
            <option value="">Select JSON…</option>
            {savedDocs.map((d) => (
              <option key={String(d.id)} value={String(d.id)}>
                {String(d.original_filename ?? d.id)}
              </option>
            ))}
          </select>
        </div>
        <button
          type="button"
          disabled={busy || !selectedDocId || !canSave}
          onClick={() => void loadSelectedDoc()}
          className="rounded-md border border-app-border bg-app-fill px-2 py-1 text-[11px] font-medium hover:bg-app-fill-hover disabled:opacity-50"
        >
          Load selected
        </button>
      </div>

      <div className="space-y-2">
        {sections.map((sec) => (
          <details
            key={sec.id}
            open
            className="rounded-lg border border-app-border bg-app-fill/40 px-2 py-1"
          >
            <summary className="cursor-pointer select-none text-[11px] font-semibold text-app-text">{sec.title}</summary>
            <div className="mt-2 space-y-2 pb-2">
              {sec.fields.map((f) => (
                <div key={f.id}>
                  <label className="block text-[10px] font-medium text-app-muted">{f.label}</label>
                  {f.helper ? <p className="mt-0.5 text-[10px] leading-snug text-app-muted/90">{f.helper}</p> : null}
                  <textarea
                    value={values[f.id] ?? ''}
                    onChange={(e) =>
                      setValues((prev) => ({
                        ...prev,
                        [f.id]: e.target.value,
                      }))
                    }
                    rows={Math.min(Math.max(f.rows ?? 3, 2), 12)}
                    placeholder={f.placeholder || ''}
                    className={`${inputCls} font-mono`}
                  />
                </div>
              ))}
            </div>
          </details>
        ))}
      </div>

      <div>
        <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-app-muted">Markdown preview</div>
        <pre className="max-h-[28rem] overflow-auto whitespace-pre-wrap rounded-lg border border-app-border bg-app-fill/30 p-2 font-mono text-[11px] leading-relaxed text-app-muted">
          {markdown}
        </pre>
      </div>

      {msg ? (
        <p className="rounded border border-emerald-500/30 bg-emerald-500/10 p-2 text-[11px] text-emerald-100">{msg}</p>
      ) : null}
      {err ? (
        <p className="rounded border border-rose-500/35 bg-rose-500/10 p-2 text-[11px] text-rose-100">{err}</p>
      ) : null}
    </div>
  );
}

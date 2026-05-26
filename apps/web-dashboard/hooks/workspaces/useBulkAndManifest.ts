'use client';

import { useCallback, useMemo, useState } from 'react';
import { bulkImportHierarchy, type HierarchyImportResult, PROJECT_DOCUMENT_KIND_VALUES, uploadProjectDocument } from '../../lib/api';
import { parseManifestRows, findManifestFile } from '../../lib/workspaces/csvManifest';

export type BulkAndManifestDeps = {
  selectedKey: string;
  setMsg: (s: string) => void;
  setErr: (s: string) => void;
  loadTree: () => Promise<void>;
  loadProjects: () => Promise<void>;
  loadProjectDocuments: (key: string) => Promise<void>;
};

export function useBulkAndManifest(deps: BulkAndManifestDeps) {
  const { selectedKey, setMsg, setErr, loadTree, loadProjects, loadProjectDocuments } = deps;

  const [bulkCsvText, setBulkCsvText] = useState('');
  const [bulkSkipExisting, setBulkSkipExisting] = useState(false);
  const [bulkResult, setBulkResult] = useState<HierarchyImportResult | null>(null);
  const [bulkWorking, setBulkWorking] = useState(false);
  const [manifestCsv, setManifestCsv] = useState('');
  const [manifestFolderFiles, setManifestFolderFiles] = useState<File[] | null>(null);
  const [manifestLog, setManifestLog] = useState<{ ok: boolean; line: string }[] | null>(null);
  const [manifestWorking, setManifestWorking] = useState(false);

  const onBulkPreview = useCallback(async () => {
    setErr('');
    setMsg('');
    if (!bulkCsvText.trim()) {
      setErr('Paste or load a hierarchy CSV first.');
      return;
    }
    setBulkWorking(true);
    try {
      const r = await bulkImportHierarchy({ csv_text: bulkCsvText, dry_run: true, skip_existing: bulkSkipExisting });
      setBulkResult(r);
      if (r.ok) setMsg(r.message || 'Dry run OK — no errors.');
      else setErr(r.errors.map((e) => `Line ${e.line ?? '—'}: ${e.message || ''}`).join(' · ') || 'Import validation failed');
    } catch (e: unknown) {
      setBulkResult(null);
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBulkWorking(false);
    }
  }, [bulkCsvText, bulkSkipExisting, setMsg, setErr]);

  const onBulkApply = useCallback(async () => {
    setErr('');
    setMsg('');
    if (!bulkCsvText.trim()) {
      setErr('Paste or load a hierarchy CSV first.');
      return;
    }
    setBulkWorking(true);
    try {
      const r = await bulkImportHierarchy({ csv_text: bulkCsvText, dry_run: false, skip_existing: bulkSkipExisting });
      setBulkResult(r);
      if (r.ok) {
        setMsg('Hierarchy import completed.');
        await loadTree();
        await loadProjects();
        if (selectedKey) await loadProjectDocuments(selectedKey);
      } else {
        setErr(r.errors.map((e) => `Line ${e.line ?? '—'}: ${e.message || ''}`).join(' · ') || 'Import failed');
      }
    } catch (e: unknown) {
      setBulkResult(null);
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBulkWorking(false);
    }
  }, [bulkCsvText, bulkSkipExisting, selectedKey, loadTree, loadProjects, loadProjectDocuments, setMsg, setErr]);

  const onManifestUploadRun = useCallback(async () => {
    setErr('');
    setMsg('');
    setManifestLog(null);
    if (!manifestCsv.trim()) {
      setErr('Provide a manifest CSV (project_key, relative_path, document_kind).');
      return;
    }
    if (!manifestFolderFiles?.length) {
      setErr('Choose a folder that contains the files listed in the manifest (use “Select folder”).');
      return;
    }
    let rows: ReturnType<typeof parseManifestRows>;
    try {
      rows = parseManifestRows(manifestCsv);
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : String(e));
      return;
    }
    if (!rows.length) {
      setErr('Manifest has no data rows.');
      return;
    }
    const kinds = new Set(PROJECT_DOCUMENT_KIND_VALUES as readonly string[]);
    const log: { ok: boolean; line: string }[] = [];
    setManifestWorking(true);
    try {
      for (let i = 0; i < rows.length; i++) {
        const r = rows[i];
        const label = `${r.project_key} ← ${r.relative_path}`;
        if (!r.project_key || !r.relative_path || !r.document_kind) {
          log.push({ ok: false, line: `Row ${i + 2}: missing fields (${label})` });
          continue;
        }
        if (!kinds.has(r.document_kind)) {
          log.push({ ok: false, line: `Row ${i + 2}: invalid document_kind ${r.document_kind}` });
          continue;
        }
        const file = findManifestFile(manifestFolderFiles, r.relative_path);
        if (!file) {
          log.push({ ok: false, line: `Row ${i + 2}: file not found for path ${r.relative_path}` });
          continue;
        }
        try {
          await uploadProjectDocument(r.project_key, file, r.document_kind);
          log.push({ ok: true, line: `Uploaded ${label} (${r.document_kind})` });
        } catch (e: unknown) {
          log.push({ ok: false, line: `Row ${i + 2}: ${e instanceof Error ? e.message : String(e)}` });
        }
      }
      setManifestLog(log);
      const bad = log.filter((x) => !x.ok).length;
      if (bad === 0) setMsg(`Manifest: queued ${log.length} upload(s).`);
      else setErr(`Manifest finished with ${bad} error(s); see log below.`);
      const keys = Array.from(new Set(rows.map((r) => r.project_key).filter(Boolean))) as string[];
      if (selectedKey && keys.includes(selectedKey)) await loadProjectDocuments(selectedKey);
      else if (keys[0]) await loadProjectDocuments(keys[0]);
    } finally {
      setManifestWorking(false);
    }
  }, [manifestCsv, manifestFolderFiles, selectedKey, loadProjectDocuments, setMsg, setErr]);

  return useMemo(
    () => ({
      bulkCsvText,
      setBulkCsvText,
      bulkSkipExisting,
      setBulkSkipExisting,
      bulkResult,
      setBulkResult,
      bulkWorking,
      setBulkWorking,
      manifestCsv,
      setManifestCsv,
      manifestFolderFiles,
      setManifestFolderFiles,
      manifestLog,
      setManifestLog,
      manifestWorking,
      setManifestWorking,
      onBulkPreview,
      onBulkApply,
      onManifestUploadRun,
    }),
    [
      bulkCsvText,
      bulkSkipExisting,
      bulkResult,
      bulkWorking,
      manifestCsv,
      manifestFolderFiles,
      manifestLog,
      manifestWorking,
      onBulkPreview,
      onBulkApply,
      onManifestUploadRun,
    ],
  );
}

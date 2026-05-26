'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { deleteProjectDocument, listProjectDocuments, patchProjectDocument, uploadProjectDocument } from '../../lib/api';

export type ProjectDocumentsDeps = {
  selectedKey: string;
  setMsg: (s: string) => void;
  setErr: (s: string) => void;
  /** e.g. reload project items after document kind changes or uploads (timeline pipeline is async). */
  onAfterDocumentMutation?: () => void;
};

export function useProjectDocumentsData(deps: ProjectDocumentsDeps) {
  const { selectedKey, setMsg, setErr, onAfterDocumentMutation } = deps;
  const [projectDocs, setProjectDocs] = useState<any[]>([]);
  const [uploadKind, setUploadKind] = useState('general');
  const [docKindFilter, setDocKindFilter] = useState('');
  const prevDocSnapRef = useRef<Map<string, { status: string; kind: string }>>(new Map());

  const loadProjectDocuments = useCallback(
    async (key: string) => {
      if (!key) {
        setProjectDocs([]);
        return;
      }
      const kinds = docKindFilter ? [docKindFilter] : undefined;
      try {
        const rows = await listProjectDocuments(key, { kinds });
        setProjectDocs(rows);
      } catch (e: unknown) {
        setProjectDocs([]);
        setErr(e instanceof Error ? e.message : String(e));
      }
    },
    [docKindFilter, setErr],
  );

  useEffect(() => {
    if (!selectedKey) return undefined;
    const id = setInterval(() => {
      void loadProjectDocuments(selectedKey);
    }, 4000);
    return () => clearInterval(id);
  }, [selectedKey, loadProjectDocuments]);

  useEffect(() => {
    if (!selectedKey || !onAfterDocumentMutation) return;
    const prevMap = prevDocSnapRef.current;
    let shouldReloadItems = false;
    for (const doc of projectDocs) {
      const id = String(doc?.id ?? '');
      if (!id) continue;
      const st = String(doc?.processing_status ?? '').toLowerCase();
      const kind = String(doc?.document_kind ?? '').toLowerCase();
      const prev = prevMap.get(id);
      prevMap.set(id, { status: st, kind });
      if (!prev) continue;
      const becameReady = prev.status !== 'ready' && st === 'ready';
      const promotedToTimeline = prev.kind !== 'timeline' && kind === 'timeline' && st === 'ready';
      const timelineRelevant =
        kind === 'timeline' || prev.kind === 'timeline' || promotedToTimeline;
      if (timelineRelevant && (becameReady || promotedToTimeline)) {
        shouldReloadItems = true;
      }
    }
    if (shouldReloadItems) {
      onAfterDocumentMutation();
    }
  }, [projectDocs, selectedKey, onAfterDocumentMutation]);

  useEffect(() => {
    prevDocSnapRef.current = new Map();
  }, [selectedKey]);

  const onUploadProjectFiles = useCallback(
    async (files: FileList | null) => {
      if (!selectedKey || !files?.length) return;
      setErr('');
      setMsg('');
      try {
        for (let i = 0; i < files.length; i++) {
          const f = files.item(i);
          if (f) await uploadProjectDocument(selectedKey, f, uploadKind);
        }
        setMsg(files.length > 1 ? `Queued ${files.length} uploads.` : 'Upload queued.');
        await loadProjectDocuments(selectedKey);
        onAfterDocumentMutation?.();
      } catch (e: unknown) {
        setErr(e instanceof Error ? e.message : String(e));
      }
    },
    [selectedKey, uploadKind, loadProjectDocuments, setMsg, setErr, onAfterDocumentMutation],
  );

  const onDocKindRowChange = useCallback(
    async (docId: string, nextKind: string) => {
      if (!selectedKey) return;
      setErr('');
      try {
        await patchProjectDocument(selectedKey, docId, { document_kind: nextKind });
        await loadProjectDocuments(selectedKey);
        onAfterDocumentMutation?.();
      } catch (e: unknown) {
        setErr(e instanceof Error ? e.message : String(e));
      }
    },
    [selectedKey, loadProjectDocuments, setErr, onAfterDocumentMutation],
  );

  const onDocArchive = useCallback(
    async (docId: string) => {
      if (!selectedKey) return;
      setErr('');
      try {
        await patchProjectDocument(selectedKey, docId, { archived: true });
        setMsg('Document archived.');
        await loadProjectDocuments(selectedKey);
        onAfterDocumentMutation?.();
      } catch (e: unknown) {
        setErr(e instanceof Error ? e.message : String(e));
      }
    },
    [selectedKey, loadProjectDocuments, setMsg, setErr, onAfterDocumentMutation],
  );

  const onDocDelete = useCallback(
    async (docId: string) => {
      if (!selectedKey) return;
      if (!window.confirm('Delete this file and its extracted memory permanently?')) return;
      setErr('');
      try {
        await deleteProjectDocument(selectedKey, docId);
        setMsg('Document deleted.');
        await loadProjectDocuments(selectedKey);
        onAfterDocumentMutation?.();
      } catch (e: unknown) {
        setErr(e instanceof Error ? e.message : String(e));
      }
    },
    [selectedKey, loadProjectDocuments, setMsg, setErr, onAfterDocumentMutation],
  );

  return useMemo(
    () => ({
      projectDocs,
      setProjectDocs,
      uploadKind,
      setUploadKind,
      docKindFilter,
      setDocKindFilter,
      loadProjectDocuments,
      onUploadProjectFiles,
      onDocKindRowChange,
      onDocArchive,
      onDocDelete,
    }),
    [
      projectDocs,
      uploadKind,
      docKindFilter,
      loadProjectDocuments,
      onUploadProjectFiles,
      onDocKindRowChange,
      onDocArchive,
      onDocDelete,
    ],
  );
}

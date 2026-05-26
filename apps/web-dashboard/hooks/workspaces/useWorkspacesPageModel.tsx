'use client';

import { useCallback, useEffect, useMemo } from 'react';
import { useBulkAndManifest } from './useBulkAndManifest';
import { useHierarchyForms } from './useHierarchyForms';
import { useProjectDocumentsData } from './useProjectDocumentsData';
import { useProjectItemsData } from './useProjectItemsData';
import { useProjectTacticsData } from './useProjectTacticsData';
import { useWorkspacesSelection } from './useWorkspacesSelection';

/**
 * Composes domain hooks into the single `WorkspacesDataValue` consumed by `WorkspacesDataProvider`.
 * Cross-cutting selection persistence lives in `useWorkspacesSelection`.
 */
export function useWorkspacesPageModel() {
  const selection = useWorkspacesSelection();

  const hierarchy = useHierarchyForms({
    tree: selection.tree,
    setSelectedKey: selection.setSelectedKey,
    loadTree: selection.loadTree,
    loadProjects: selection.loadProjects,
    setMsg: selection.setMsg,
    setErr: selection.setErr,
    clientWsKey: selection.clientWsKey,
  });

  const workspaceKeyForProject = useMemo(() => {
    const p = selection.projects.find((x: any) => x.key === selection.selectedKey);
    return (p?.workspace_key as string) || '';
  }, [selection.projects, selection.selectedKey]);

  const items = useProjectItemsData({
    selectedKey: selection.selectedKey,
    workspaceKey: workspaceKeyForProject,
    setMsg: selection.setMsg,
    setErr: selection.setErr,
  });

  const reloadProjectItems = useCallback(() => {
    const key = selection.selectedKey;
    if (key) void items.loadItems(key);
  }, [items.loadItems, selection.selectedKey]);

  const docs = useProjectDocumentsData({
    selectedKey: selection.selectedKey,
    setMsg: selection.setMsg,
    setErr: selection.setErr,
    onAfterDocumentMutation: reloadProjectItems,
  });

  const tactics = useProjectTacticsData({
    selectedKey: selection.selectedKey,
    setMsg: selection.setMsg,
    setErr: selection.setErr,
  });

  const bulk = useBulkAndManifest({
    selectedKey: selection.selectedKey,
    setMsg: selection.setMsg,
    setErr: selection.setErr,
    loadTree: selection.loadTree,
    loadProjects: selection.loadProjects,
    loadProjectDocuments: docs.loadProjectDocuments,
  });

  useEffect(() => {
    void items.loadItems(selection.selectedKey);
    void tactics.loadTactics(selection.selectedKey);
    void docs.loadProjectDocuments(selection.selectedKey);
  }, [
    selection.selectedKey,
    selection.projects,
    items.loadItems,
    tactics.loadTactics,
    docs.loadProjectDocuments,
  ]);

  return useMemo(
    () => ({
      ...selection,
      ...hierarchy,
      ...items,
      ...docs,
      ...tactics,
      ...bulk,
    }),
    [selection, hierarchy, items, docs, tactics, bulk],
  );
}

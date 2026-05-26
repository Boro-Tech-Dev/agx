'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { createMemory, getProjectItems, patchProjectItem } from '../../lib/api';
import { dedupeProjectItemsKeepNewest } from '../../lib/workspaces/projectItems';

export type ProjectItemsDeps = {
  selectedKey: string;
  workspaceKey: string;
  setMsg: (s: string) => void;
  setErr: (s: string) => void;
};

export function useProjectItemsData(deps: ProjectItemsDeps) {
  const { selectedKey, workspaceKey, setMsg, setErr } = deps;
  const [items, setItems] = useState<any[]>([]);

  const loadItems = useCallback(async (key: string) => {
    if (!key) {
      setItems([]);
      return;
    }
    try {
      const rows = await getProjectItems(key);
      setItems(dedupeProjectItemsKeepNewest(rows));
    } catch (e: unknown) {
      setItems([]);
      setErr(e instanceof Error ? e.message : String(e));
    }
  }, [setErr]);

  useEffect(() => {
    if (!selectedKey) return undefined;
    const id = setInterval(() => {
      void loadItems(selectedKey);
    }, 4000);
    return () => clearInterval(id);
  }, [selectedKey, loadItems]);

  const onMarkItemResolved = useCallback(
    async (it: { id?: string }) => {
      if (!selectedKey || !it?.id) return;
      setErr('');
      try {
        await patchProjectItem(selectedKey, String(it.id), { status: 'resolved' });
        setMsg('Item marked resolved.');
        await loadItems(selectedKey);
      } catch (e: unknown) {
        setErr(e instanceof Error ? e.message : String(e));
      }
    },
    [selectedKey, loadItems, setMsg, setErr],
  );

  const onReopenItem = useCallback(
    async (it: { id?: string }) => {
      if (!selectedKey || !it?.id) return;
      setErr('');
      try {
        await patchProjectItem(selectedKey, String(it.id), { status: 'open' });
        setMsg('Item reopened.');
        await loadItems(selectedKey);
      } catch (e: unknown) {
        setErr(e instanceof Error ? e.message : String(e));
      }
    },
    [selectedKey, loadItems, setMsg, setErr],
  );

  const onFlagItemToggle = useCallback(
    async (it: { id?: string }, flagged: boolean) => {
      if (!selectedKey || !it?.id) return;
      setErr('');
      try {
        await patchProjectItem(selectedKey, String(it.id), { metadata: { flagged } });
        setMsg(flagged ? 'Item flagged.' : 'Flag removed.');
        await loadItems(selectedKey);
      } catch (e: unknown) {
        setErr(e instanceof Error ? e.message : String(e));
      }
    },
    [selectedKey, loadItems, setMsg, setErr],
  );

  const onUpdateItemTitle = useCallback(
    async (it: { id?: string }, title: string): Promise<boolean> => {
      if (!selectedKey || !it?.id) return false;
      const t = title.trim();
      if (!t) {
        setErr('Summary cannot be empty.');
        return false;
      }
      setErr('');
      try {
        await patchProjectItem(selectedKey, String(it.id), { title: t });
        setMsg('Summary updated.');
        await loadItems(selectedKey);
        return true;
      } catch (e: unknown) {
        setErr(e instanceof Error ? e.message : String(e));
        return false;
      }
    },
    [selectedKey, loadItems, setMsg, setErr],
  );

  const onSaveItemAsMemory = useCallback(
    async (it: any, summaryLine: string) => {
      if (!selectedKey || !it?.id) return;
      setErr('');
      const title = `Project item: ${summaryLine}`.slice(0, 500);
      const bodyRaw = it.body != null ? String(it.body) : '';
      const body = [summaryLine, bodyRaw].filter(Boolean).join('\n\n').slice(0, 12000);
      try {
        await createMemory({
          project_key: selectedKey,
          ...(workspaceKey ? { workspace_key: workspaceKey } : {}),
          title,
          body,
          memory_type: 'note',
          metadata: {
            source_project_item_id: String(it.id),
            ...(it.source_run_id ? { source_run_id: String(it.source_run_id) } : {}),
          },
        });
        setMsg('Saved as project memory.');
      } catch (e: unknown) {
        setErr(e instanceof Error ? e.message : String(e));
      }
    },
    [selectedKey, workspaceKey, setMsg, setErr],
  );

  return useMemo(
    () => ({
      items,
      setItems,
      loadItems,
      onMarkItemResolved,
      onReopenItem,
      onFlagItemToggle,
      onUpdateItemTitle,
      onSaveItemAsMemory,
    }),
    [
      items,
      loadItems,
      onMarkItemResolved,
      onReopenItem,
      onFlagItemToggle,
      onUpdateItemTitle,
      onSaveItemAsMemory,
    ],
  );
}

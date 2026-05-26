'use client';

import { useCallback, useState } from 'react';
import { btnPrimary, inputClass } from '../../../lib/workspaces/styles';

const SUMMARY_MAX = 500;

export type ProjectItemActionsProps = {
  item: any;
  selectedKey: string;
  workspaceKey: string;
  personalPm: boolean;
  summaryLine: string;
  onMarkResolved: (it: any) => void;
  onReopen: (it: any) => void;
  onFlagToggle: (it: any, flagged: boolean) => void;
  onUpdateItemTitle: (it: any, title: string) => boolean | Promise<boolean>;
  onSaveAsMemory: (it: any, summaryLine: string) => void | Promise<void>;
};

function agentPath(personalPm: boolean): string {
  return personalPm ? 'synergy' : 'pm';
}

export default function ProjectItemActions({
  item,
  selectedKey,
  workspaceKey: _workspaceKey,
  personalPm,
  summaryLine,
  onMarkResolved,
  onReopen,
  onFlagToggle,
  onUpdateItemTitle,
  onSaveAsMemory,
}: ProjectItemActionsProps) {
  const [open, setOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editDraft, setEditDraft] = useState('');
  const [memoryOpen, setMemoryOpen] = useState(false);
  const [memoryDraft, setMemoryDraft] = useState('');
  const [memorySyncTitle, setMemorySyncTitle] = useState(true);
  const [savingEdit, setSavingEdit] = useState(false);
  const [savingMemory, setSavingMemory] = useState(false);

  const agent = agentPath(personalPm);
  const pk = encodeURIComponent(selectedKey);
  const iid = encodeURIComponent(String(item.id));
  const runId = item.source_run_id ? String(item.source_run_id) : '';
  const statusOpen = String(item.status || '').toLowerCase() === 'open';
  const flagged = Boolean(item.metadata && typeof item.metadata === 'object' && (item.metadata as { flagged?: boolean }).flagged);

  const askHref =
    runId &&
    `/agents/${agent}?parent_run=${encodeURIComponent(runId)}&project_key=${pk}&project_item_id=${iid}`;
  const followSeed = `Follow up regarding: ${summaryLine}`.slice(0, 1200);
  const followHref =
    runId &&
    `/agents/${agent}?parent_run=${encodeURIComponent(runId)}&project_key=${pk}&continuation_seed=${encodeURIComponent(followSeed)}`;
  const discussHref = `/agents/${agent}?project_key=${pk}&project_item_id=${iid}`;

  const copySummary = useCallback(async () => {
    const lines = [
      summaryLine,
      `Item: ${item.id}`,
      `Project: ${selectedKey}`,
      runId ? `Run: ${runId}` : null,
    ].filter(Boolean) as string[];
    try {
      await navigator.clipboard.writeText(lines.join('\n'));
    } catch {
      /* ignore */
    }
    setOpen(false);
  }, [summaryLine, item.id, selectedKey, runId]);

  const copyDebug = useCallback(async () => {
    const blob = [
      `project_key=${selectedKey}`,
      `item_id=${item.id}`,
      `item_type=${item.item_type}`,
      runId ? `source_run_id=${runId}` : 'source_run_id=',
    ].join('\n');
    try {
      await navigator.clipboard.writeText(blob);
    } catch {
      /* ignore */
    }
    setOpen(false);
  }, [selectedKey, item.id, item.item_type, runId]);

  const editTrimmed = editDraft.trim();
  const editUnchanged = editTrimmed === summaryLine.trim();
  const memoryTrimmed = memoryDraft.trim();

  const saveEdit = useCallback(async () => {
    if (!editTrimmed || editUnchanged || savingEdit) return;
    setSavingEdit(true);
    try {
      const ok = await Promise.resolve(onUpdateItemTitle(item, editDraft));
      if (ok) setEditOpen(false);
    } finally {
      setSavingEdit(false);
    }
  }, [editDraft, editTrimmed, editUnchanged, item, onUpdateItemTitle, savingEdit]);

  const saveMemory = useCallback(async () => {
    if (!memoryTrimmed || savingMemory) return;
    setSavingMemory(true);
    try {
      if (memorySyncTitle) {
        const ok = await Promise.resolve(onUpdateItemTitle(item, memoryDraft));
        if (!ok) return;
      }
      await Promise.resolve(onSaveAsMemory(item, memoryTrimmed));
      setMemoryOpen(false);
    } finally {
      setSavingMemory(false);
    }
  }, [item, memoryDraft, memorySyncTitle, memoryTrimmed, onSaveAsMemory, onUpdateItemTitle, savingMemory]);

  return (
    <div className="relative inline-block text-left">
      <button
        type="button"
        className="rounded border border-app-border bg-app-fill px-1 py-0.5 text-[9px] font-semibold text-app-text hover:bg-app-surface"
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen((o) => !o)}
      >
        Actions
      </button>
      {open ? (
        <>
          <button
            type="button"
            className="fixed inset-0 z-[5] cursor-default bg-transparent"
            aria-label="Close menu"
            onClick={() => setOpen(false)}
          />
          <div
            className="absolute right-0 z-10 mt-0.5 min-w-[12.5rem] rounded border border-app-border bg-app-surface py-0.5 shadow-sm"
            role="menu"
          >
            {statusOpen ? (
              <button
                type="button"
                role="menuitem"
                className="block w-full px-2 py-1 text-left text-[9px] font-semibold text-app-text hover:bg-app-fill"
                onClick={() => {
                  onMarkResolved(item);
                  setOpen(false);
                }}
              >
                Resolve
              </button>
            ) : (
              <button
                type="button"
                role="menuitem"
                className="block w-full px-2 py-1 text-left text-[9px] font-semibold text-app-text hover:bg-app-fill"
                onClick={() => {
                  onReopen(item);
                  setOpen(false);
                }}
              >
                Reopen
              </button>
            )}
            {askHref ? (
              <a
                role="menuitem"
                href={askHref}
                className="block px-2 py-1 text-[9px] font-semibold text-amber-800 hover:bg-app-fill dark:text-amber-200"
                onClick={() => setOpen(false)}
              >
                {personalPm ? 'Ask a question (Synergy follow-up)' : 'Ask a question (PM follow-up)'}
              </a>
            ) : null}
            {followHref ? (
              <a
                role="menuitem"
                href={followHref}
                className="block px-2 py-1 text-[9px] font-semibold text-cyan-800 hover:bg-app-fill dark:text-cyan-200"
                onClick={() => setOpen(false)}
              >
                Follow-up
              </a>
            ) : null}
            <a
              role="menuitem"
              href={discussHref}
              className="block px-2 py-1 text-[9px] font-semibold text-app-text hover:bg-app-fill"
              onClick={() => setOpen(false)}
            >
              {personalPm ? 'Discuss in Synergy (new run)' : 'Discuss in PM (new run)'}
            </a>
            <button
              type="button"
              role="menuitem"
              className="block w-full px-2 py-1 text-left text-[9px] font-semibold text-app-text hover:bg-app-fill"
              onClick={() => {
                setEditDraft(summaryLine);
                setEditOpen(true);
                setOpen(false);
              }}
            >
              Edit summary
            </button>
            <button
              type="button"
              role="menuitem"
              className="block w-full px-2 py-1 text-left text-[9px] font-semibold text-app-text hover:bg-app-fill"
              onClick={() => {
                setMemoryDraft(summaryLine);
                setMemorySyncTitle(true);
                setMemoryOpen(true);
                setOpen(false);
              }}
            >
              Save as project memory
            </button>
            <button
              type="button"
              role="menuitem"
              className="block w-full px-2 py-1 text-left text-[9px] font-semibold text-app-text hover:bg-app-fill"
              onClick={() => {
                onFlagToggle(item, !flagged);
                setOpen(false);
              }}
            >
              {flagged ? 'Unflag' : 'Flag for later'}
            </button>
            <button
              type="button"
              role="menuitem"
              className="block w-full px-2 py-1 text-left text-[9px] font-semibold text-app-muted hover:bg-app-fill"
              onClick={() => void copySummary()}
            >
              Copy summary
            </button>
            <button
              type="button"
              role="menuitem"
              className="block w-full px-2 py-1 text-left text-[9px] font-semibold text-app-muted hover:bg-app-fill"
              onClick={() => void copyDebug()}
            >
              Copy debug IDs
            </button>
          </div>
        </>
      ) : null}

      {editOpen ? (
        <div
          className="fixed inset-0 z-[30] flex items-center justify-center bg-black/40 p-2"
          role="dialog"
          aria-modal="true"
          aria-labelledby="edit-summary-title"
        >
          <button
            type="button"
            className="absolute inset-0 cursor-default"
            aria-label="Close dialog"
            onClick={() => setEditOpen(false)}
          />
          <div
            className="relative z-[1] w-full max-w-md rounded-lg border border-app-border bg-app-surface p-3 shadow-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <h4 id="edit-summary-title" className="text-[11px] font-semibold text-app-text">
              Edit summary
            </h4>
            <p className="mt-1 text-[9px] text-app-muted">Shown in the table, follow-up links, and project registry (max {SUMMARY_MAX} characters).</p>
            <textarea
              className={`${inputClass} mt-2 min-h-[5rem] resize-y font-sans`}
              value={editDraft}
              maxLength={SUMMARY_MAX}
              onChange={(e) => setEditDraft(e.target.value)}
              rows={4}
            />
            <p className="mt-0.5 text-[9px] text-app-muted">
              {editDraft.length}/{SUMMARY_MAX}
            </p>
            <div className="mt-2 flex justify-end gap-2">
              <button
                type="button"
                className="rounded border border-app-border bg-app-fill px-2 py-1 text-[10px] font-semibold text-app-text hover:bg-app-surface"
                onClick={() => setEditOpen(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className={btnPrimary}
                disabled={!editTrimmed || editUnchanged || savingEdit}
                onClick={() => void saveEdit()}
              >
                Save
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {memoryOpen ? (
        <div
          className="fixed inset-0 z-[30] flex items-center justify-center bg-black/40 p-2"
          role="dialog"
          aria-modal="true"
          aria-labelledby="memory-summary-title"
        >
          <button
            type="button"
            className="absolute inset-0 cursor-default"
            aria-label="Close dialog"
            onClick={() => setMemoryOpen(false)}
          />
          <div
            className="relative z-[1] w-full max-w-md rounded-lg border border-app-border bg-app-surface p-3 shadow-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <h4 id="memory-summary-title" className="text-[11px] font-semibold text-app-text">
              Save as project memory
            </h4>
            <p className="mt-1 text-[9px] text-app-muted">Adjust wording before it is stored as a memory note.</p>
            <textarea
              className={`${inputClass} mt-2 min-h-[5rem] resize-y font-sans`}
              value={memoryDraft}
              maxLength={SUMMARY_MAX}
              onChange={(e) => setMemoryDraft(e.target.value)}
              rows={4}
            />
            <p className="mt-0.5 text-[9px] text-app-muted">
              {memoryDraft.length}/{SUMMARY_MAX}
            </p>
            <label className="mt-2 flex cursor-pointer items-center gap-2 text-[10px] text-app-text">
              <input
                type="checkbox"
                className="rounded border-app-border"
                checked={memorySyncTitle}
                onChange={(e) => setMemorySyncTitle(e.target.checked)}
              />
              Update project item headline to match
            </label>
            <div className="mt-2 flex justify-end gap-2">
              <button
                type="button"
                className="rounded border border-app-border bg-app-fill px-2 py-1 text-[10px] font-semibold text-app-text hover:bg-app-surface"
                onClick={() => setMemoryOpen(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className={btnPrimary}
                disabled={!memoryTrimmed || savingMemory}
                onClick={() => void saveMemory()}
              >
                Save to memory
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

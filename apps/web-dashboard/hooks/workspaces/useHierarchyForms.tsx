'use client';

import { useCallback, useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react';
import { createBrand, createClient, createProject, createWorkspace, listProjectTypes } from '../../lib/api';
import { syncBrandClientPicklistsFromTree } from '../../lib/workspaces/syncPicklistsFromTree';

export type HierarchyFormsDeps = {
  tree: { workspaces?: any[] } | null;
  setSelectedKey: (key: string) => void;
  loadTree: () => Promise<void>;
  loadProjects: () => Promise<void>;
  setMsg: (s: string) => void;
  setErr: (s: string) => void;
  clientWsKey: string;
};

export function useHierarchyForms(deps: HierarchyFormsDeps) {
  const { tree, setSelectedKey, loadTree, loadProjects, setMsg, setErr, clientWsKey } = deps;

  const [keyInput, setKeyInput] = useState('');
  const [nameInput, setNameInput] = useState('');
  const [descInput, setDescInput] = useState('');
  const [projectTypeSlug, setProjectTypeSlug] = useState('other');
  const [projectTypeRows, setProjectTypeRows] = useState<{ value: string; label: string; capture_mode: string }[]>([]);
  const [allowBreakdownOnCreate, setAllowBreakdownOnCreate] = useState(false);
  const [pmKindCreate, setPmKindCreate] = useState<'business' | 'personal'>('business');
  const [brandIdInput, setBrandIdInput] = useState('');
  const [wsKeyInput, setWsKeyInput] = useState('');
  const [wsNameInput, setWsNameInput] = useState('');
  const [clientKeyInput, setClientKeyInput] = useState('');
  const [clientNameInput, setClientNameInput] = useState('');
  const [brandClientId, setBrandClientId] = useState('');
  const [brandKeyInput, setBrandKeyInput] = useState('');
  const [brandNameInput, setBrandNameInput] = useState('');

  useEffect(() => {
    syncBrandClientPicklistsFromTree(tree, setBrandIdInput, setBrandClientId);
  }, [tree]);

  useEffect(() => {
    let cancelled = false;
    void listProjectTypes()
      .then((rows) => {
        if (cancelled || !rows.length) return;
        setProjectTypeRows(rows);
        setProjectTypeSlug((prev) => (rows.some((r) => r.value === prev) ? prev : 'other'));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const onCreateProject = useCallback(
    async (e: FormEvent) => {
      e.preventDefault();
      setMsg('');
      setErr('');
      const newKey = keyInput.trim().toLowerCase();
      try {
        if (!brandIdInput) {
          setErr('Select a brand (or create hierarchy first).');
          return;
        }
        await createProject({
          key: newKey,
          name: nameInput.trim(),
          description: descInput.trim() || undefined,
          project_type: projectTypeSlug,
          pm_kind: pmKindCreate,
          brand_id: brandIdInput,
          ...(allowBreakdownOnCreate ? { metadata: { allow_structured_breakdown: true } } : {}),
        });
        setMsg(`Created project “${newKey}”.`);
        setKeyInput('');
        setNameInput('');
        setDescInput('');
        setProjectTypeSlug('other');
        setAllowBreakdownOnCreate(false);
        setPmKindCreate('business');
        await loadTree();
        await loadProjects();
        setSelectedKey(newKey);
      } catch (e: unknown) {
        setErr(e instanceof Error ? e.message : String(e));
      }
    },
    [
      brandIdInput,
      keyInput,
      nameInput,
      descInput,
      projectTypeSlug,
      allowBreakdownOnCreate,
      pmKindCreate,
      loadTree,
      loadProjects,
      setSelectedKey,
      setMsg,
      setErr,
    ],
  );

  const onCreateWorkspace = useCallback(
    async (e: FormEvent) => {
      e.preventDefault();
      setMsg('');
      setErr('');
      try {
        await createWorkspace({
          key: wsKeyInput.trim().toLowerCase(),
          name: wsNameInput.trim(),
        });
        setMsg(`Created workspace “${wsKeyInput.trim().toLowerCase()}”.`);
        setWsKeyInput('');
        setWsNameInput('');
        await loadTree();
      } catch (e: unknown) {
        setErr(e instanceof Error ? e.message : String(e));
      }
    },
    [wsKeyInput, wsNameInput, loadTree, setMsg, setErr],
  );

  const onCreateClient = useCallback(
    async (e: FormEvent) => {
      e.preventDefault();
      setMsg('');
      setErr('');
      try {
        await createClient(clientWsKey, {
          key: clientKeyInput.trim().toLowerCase(),
          name: clientNameInput.trim(),
        });
        setMsg(`Created client “${clientKeyInput.trim().toLowerCase()}”.`);
        setClientKeyInput('');
        setClientNameInput('');
        await loadTree();
      } catch (e: unknown) {
        setErr(e instanceof Error ? e.message : String(e));
      }
    },
    [clientWsKey, clientKeyInput, clientNameInput, loadTree, setMsg, setErr],
  );

  const onCreateBrand = useCallback(
    async (e: FormEvent) => {
      e.preventDefault();
      setMsg('');
      setErr('');
      try {
        if (!brandClientId) {
          setErr('Pick a client for the new brand (step 2–3).');
          return;
        }
        await createBrand(brandClientId, {
          key: brandKeyInput.trim().toLowerCase(),
          name: brandNameInput.trim(),
        });
        setMsg(`Created brand “${brandKeyInput.trim().toLowerCase()}”.`);
        setBrandKeyInput('');
        setBrandNameInput('');
        await loadTree();
      } catch (e: unknown) {
        setErr(e instanceof Error ? e.message : String(e));
      }
    },
    [brandClientId, brandKeyInput, brandNameInput, loadTree, setMsg, setErr],
  );

  const stepShell = useCallback((n: number, accent: string, title: string, children: ReactNode) => {
    return (
      <div className={`rounded-md border border-app-border bg-app-surface p-2 shadow-xs ${accent}`}>
        <div className="mb-1.5 flex items-center gap-2">
          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-stone-800 text-[10px] font-bold text-white">
            {n}
          </span>
          <h2 className="text-xs font-semibold text-app-text">{title}</h2>
        </div>
        {children}
      </div>
    );
  }, []);

  return useMemo(
    () => ({
      keyInput,
      setKeyInput,
      nameInput,
      setNameInput,
      descInput,
      setDescInput,
      projectTypeRows,
      projectTypeSlug,
      setProjectTypeSlug,
      allowBreakdownOnCreate,
      setAllowBreakdownOnCreate,
      pmKindCreate,
      setPmKindCreate,
      brandIdInput,
      setBrandIdInput,
      wsKeyInput,
      setWsKeyInput,
      wsNameInput,
      setWsNameInput,
      clientKeyInput,
      setClientKeyInput,
      clientNameInput,
      setClientNameInput,
      brandClientId,
      setBrandClientId,
      brandKeyInput,
      setBrandKeyInput,
      brandNameInput,
      setBrandNameInput,
      stepShell,
      onCreateProject,
      onCreateWorkspace,
      onCreateClient,
      onCreateBrand,
    }),
    [
      keyInput,
      nameInput,
      descInput,
      projectTypeRows,
      projectTypeSlug,
      allowBreakdownOnCreate,
      pmKindCreate,
      brandIdInput,
      wsKeyInput,
      wsNameInput,
      clientKeyInput,
      clientNameInput,
      brandClientId,
      brandKeyInput,
      brandNameInput,
      stepShell,
      onCreateProject,
      onCreateWorkspace,
      onCreateClient,
      onCreateBrand,
    ],
  );
}

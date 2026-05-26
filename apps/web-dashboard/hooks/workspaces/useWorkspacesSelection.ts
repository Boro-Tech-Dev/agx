'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  deleteProject,
  deleteWorkspace,
  getHierarchyTree,
  listProjectTypes,
  listProjects,
  patchBrand,
  patchProject,
} from '../../lib/api';
import { isPersonalPm } from '../../lib/pmMode';
import {
  readInitialWorkspacesSelection,
  readPersistedWorkspacesSelection,
  workspacesSelectionPath,
  writePersistedWorkspacesSelection,
  type WorkspacesSelectionPartial,
} from '../../lib/workspaces/selectionPersistence';
import { flattenBrands, flattenClients } from '../../lib/workspaces/hierarchy';

function hierarchyFromProject(
  tree: { workspaces?: any[] } | null,
  p: { workspace_key?: string; client_key?: string; brand_key?: string } | undefined,
): Pick<WorkspacesSelectionPartial, 'workspaceKey' | 'clientId' | 'brandId'> {
  if (!p?.workspace_key || !tree?.workspaces) return {};
  const out: WorkspacesSelectionPartial = { workspaceKey: p.workspace_key };
  for (const wrap of tree.workspaces) {
    if (wrap.workspace?.key !== p.workspace_key) continue;
    for (const cwrap of wrap.clients || []) {
      if (cwrap.client?.key !== p.client_key) continue;
      out.clientId = String(cwrap.client?.id || '');
      for (const bwrap of cwrap.brands || []) {
        if (bwrap.brand?.key === p.brand_key) {
          out.brandId = String(bwrap.brand?.id || '');
        }
      }
    }
  }
  return out;
}

export function useWorkspacesSelection() {
  const initial = readInitialWorkspacesSelection();
  const [tree, setTree] = useState<{ workspaces?: any[] } | null>(null);
  const [projects, setProjects] = useState<any[]>([]);
  const [selectedKey, setSelectedKeyState] = useState(initial.selectedKey);
  const [clientWsKey, setClientWsKeyState] = useState(initial.clientWsKey);
  const [pickClientId, setPickClientIdState] = useState(initial.pickClientId);
  const [pickBrandId, setPickBrandIdState] = useState(initial.pickBrandId);

  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const [projectDeleteOpen, setProjectDeleteOpen] = useState(false);
  const [projectDeleteConfirm, setProjectDeleteConfirm] = useState('');
  const [wsDeleteTarget, setWsDeleteTarget] = useState<string | null>(null);
  const [wsDeleteConfirm, setWsDeleteConfirm] = useState('');
  const [projectTypeCatalog, setProjectTypeCatalog] = useState<{ value: string; label: string; capture_mode: string }[]>([]);

  const router = useRouter();
  const searchParams = useSearchParams();
  const skipUrlSyncRef = useRef(false);

  const persistSelection = useCallback((patch: WorkspacesSelectionPartial) => {
    writePersistedWorkspacesSelection(patch);
  }, []);

  const setSelectedKey = useCallback((key: string) => {
    setSelectedKeyState(key);
  }, []);

  const setClientWsKey = useCallback(
    (wk: string) => {
      setClientWsKeyState(wk);
      persistSelection({ workspaceKey: wk });
    },
    [persistSelection],
  );

  const setPickClientId = useCallback(
    (cid: string) => {
      setPickClientIdState(cid);
      setPickBrandIdState('');
      persistSelection({ clientId: cid, brandId: '' });
    },
    [persistSelection],
  );

  const setPickBrandId = useCallback(
    (bid: string) => {
      setPickBrandIdState(bid);
      persistSelection({ brandId: bid });
    },
    [persistSelection],
  );

  const loadTree = useCallback(async () => {
    try {
      const t = await getHierarchyTree();
      setTree(t);
      setClientWsKeyState((prev) => {
        if (prev && t.workspaces?.some((w: any) => w.workspace?.key === prev)) return prev;
        const stored = readPersistedWorkspacesSelection().workspaceKey;
        if (stored && t.workspaces?.some((w: any) => w.workspace?.key === stored)) return stored;
        return t.workspaces?.[0]?.workspace?.key || '';
      });
    } catch (e: unknown) {
      setTree({ workspaces: [] });
      setErr(e instanceof Error ? e.message : String(e));
    }
  }, []);

  const loadProjects = useCallback(async () => {
    try {
      const rows = await listProjects();
      setProjects(rows);
      const keys = (rows as any[]).map((p) => p.key);
      const stored = readPersistedWorkspacesSelection().projectKey;
      setSelectedKeyState((prev) => {
        if (prev && keys.includes(prev)) return prev;
        if (stored && keys.includes(stored)) return stored;
        return keys[0] || '';
      });
    } catch (e: unknown) {
      setProjects([]);
      setErr(e instanceof Error ? e.message : String(e));
    }
  }, []);

  useEffect(() => {
    const pk = searchParams.get('project');
    const wk = searchParams.get('workspace');
    const cid = searchParams.get('client');
    const bid = searchParams.get('brand');
    skipUrlSyncRef.current = true;
    if (wk && tree?.workspaces?.some((w: any) => w.workspace?.key === wk)) {
      setClientWsKeyState(wk);
    }
    if (cid) setPickClientIdState(cid);
    if (bid) setPickBrandIdState(bid);
    if (pk && projects.some((p: any) => p.key === pk)) {
      setSelectedKeyState(pk);
    }
    const t = window.setTimeout(() => {
      skipUrlSyncRef.current = false;
    }, 0);
    return () => window.clearTimeout(t);
  }, [searchParams, tree, projects]);

  useEffect(() => {
    if (!selectedKey || !tree || projects.length === 0) return;
    const p = projects.find((x: any) => x.key === selectedKey);
    if (!p) return;
    const h = hierarchyFromProject(tree, p);
    if (h.workspaceKey) setClientWsKeyState(h.workspaceKey);
    if (h.clientId) setPickClientIdState(h.clientId);
    if (h.brandId) setPickBrandIdState(h.brandId);
    persistSelection({
      projectKey: selectedKey,
      workspaceKey: h.workspaceKey || p.workspace_key,
      clientId: h.clientId,
      brandId: h.brandId,
    });
  }, [selectedKey, tree, projects, persistSelection]);

  useEffect(() => {
    if (!selectedKey || skipUrlSyncRef.current) return;
    const p = projects.find((x: any) => x.key === selectedKey);
    const next = workspacesSelectionPath({
      projectKey: selectedKey,
      workspaceKey: (p?.workspace_key as string) || clientWsKey,
      clientId: pickClientId,
      brandId: pickBrandId,
    });
    if (typeof window !== 'undefined' && window.location.pathname + window.location.search !== next) {
      router.replace(next, { scroll: false });
    }
  }, [selectedKey, projects, clientWsKey, pickClientId, pickBrandId, router]);

  useEffect(() => {
    loadTree();
    loadProjects();
  }, [loadTree, loadProjects]);

  useEffect(() => {
    void listProjectTypes()
      .then((rows) => {
        if (rows.length) setProjectTypeCatalog(rows);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === 'visible') {
        loadTree();
        loadProjects();
      }
    };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, [loadTree, loadProjects]);

  const onDeleteProject = useCallback(async () => {
    if (!selectedKey || projectDeleteConfirm !== selectedKey) return;
    setErr('');
    setMsg('');
    try {
      await deleteProject(selectedKey);
      setMsg(`Deleted project “${selectedKey}”.`);
      setProjectDeleteOpen(false);
      setProjectDeleteConfirm('');
      await loadTree();
      await loadProjects();
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : String(e));
    }
  }, [selectedKey, projectDeleteConfirm, loadTree, loadProjects]);

  const onDeleteWorkspace = useCallback(
    async (wsKey: string) => {
      if (wsDeleteConfirm !== wsKey) return;
      setErr('');
      setMsg('');
      try {
        await deleteWorkspace(wsKey);
        setMsg(`Deleted workspace “${wsKey}” (and its projects under that tree).`);
        setWsDeleteTarget(null);
        setWsDeleteConfirm('');
        await loadTree();
        await loadProjects();
      } catch (e: unknown) {
        setErr(e instanceof Error ? e.message : String(e));
      }
    },
    [wsDeleteConfirm, loadTree, loadProjects],
  );

  const selectedProject = useMemo(
    () => projects.find((p: any) => p.key === selectedKey),
    [projects, selectedKey],
  );
  const personalPm = isPersonalPm(selectedProject);

  const onChangeProjectPmKind = useCallback(
    async (next: 'business' | 'personal') => {
      if (!selectedKey) return;
      setErr('');
      setMsg('');
      try {
        await patchProject(selectedKey, { pm_kind: next });
        setMsg(`Work kind updated to ${next}.`);
        await loadProjects();
      } catch (e: unknown) {
        setErr(e instanceof Error ? e.message : String(e));
      }
    },
    [selectedKey, loadProjects],
  );

  const onChangeProjectTypeSlug = useCallback(
    async (slug: string) => {
      if (!selectedKey) return;
      setErr('');
      setMsg('');
      try {
        await patchProject(selectedKey, { project_type: slug });
        setMsg('Project type updated.');
        await loadProjects();
      } catch (e: unknown) {
        setErr(e instanceof Error ? e.message : String(e));
      }
    },
    [selectedKey, loadProjects],
  );

  const onSetAllowStructuredBreakdown = useCallback(
    async (checked: boolean) => {
      if (!selectedKey) return;
      setErr('');
      setMsg('');
      try {
        await patchProject(selectedKey, { metadata: { allow_structured_breakdown: checked } });
        setMsg(checked ? 'Structured breakdown enabled for this project.' : 'Structured breakdown disabled.');
        await loadProjects();
      } catch (e: unknown) {
        setErr(e instanceof Error ? e.message : String(e));
      }
    },
    [selectedKey, loadProjects],
  );

  const onChangeBrandTimingProfile = useCallback(
    async (brandId: string, profileId: string | null) => {
      setErr('');
      setMsg('');
      try {
        await patchBrand(brandId, { timing_profile_id: profileId });
        setMsg(profileId ? `Brand default cadence set to ${profileId}.` : 'Brand default cadence cleared.');
        await loadTree();
        await loadProjects();
      } catch (e: unknown) {
        setErr(e instanceof Error ? e.message : String(e));
      }
    },
    [loadTree, loadProjects],
  );

  const onChangeProjectTimingProfile = useCallback(
    async (profileId: string | null) => {
      if (!selectedKey) return;
      setErr('');
      setMsg('');
      try {
        await patchProject(selectedKey, { timing_profile_id: profileId });
        setMsg(
          profileId ? `Project cadence override set to ${profileId}.` : 'Project cadence inherits from brand.',
        );
        await loadProjects();
        await loadTree();
      } catch (e: unknown) {
        setErr(e instanceof Error ? e.message : String(e));
      }
    },
    [selectedKey, loadProjects, loadTree],
  );

  const brandsForCadenceAdmin = useMemo(() => {
    const out: { brandId: string; brandKey: string; brandName: string; clientKey: string; timing_profile_id?: string | null }[] =
      [];
    if (!tree?.workspaces) return out;
    for (const wrap of tree.workspaces) {
      for (const cwrap of wrap.clients || []) {
        if (pickClientId && String(cwrap.client?.id) !== pickClientId) continue;
        for (const bwrap of cwrap.brands || []) {
          const br = bwrap.brand;
          if (!br?.id) continue;
          out.push({
            brandId: String(br.id),
            brandKey: String(br.key),
            brandName: String(br.name),
            clientKey: String(cwrap.client?.key ?? ''),
            timing_profile_id: br.timing_profile_id ?? null,
          });
        }
      }
    }
    return out;
  }, [tree, pickClientId]);

  return useMemo(() => {
    const bo = flattenBrands(tree);
    const co = flattenClients(tree);
    return {
      tree,
      setTree,
      projects,
      setProjects,
      selectedKey,
      setSelectedKey,
      clientWsKey,
      setClientWsKey,
      pickClientId,
      setPickClientId,
      pickBrandId,
      setPickBrandId,
      msg,
      setMsg,
      err,
      setErr,
      projectDeleteOpen,
      setProjectDeleteOpen,
      projectDeleteConfirm,
      setProjectDeleteConfirm,
      wsDeleteTarget,
      setWsDeleteTarget,
      wsDeleteConfirm,
      setWsDeleteConfirm,
      loadTree,
      loadProjects,
      router,
      searchParams,
      selectedProject,
      personalPm,
      brandOptions: bo,
      clientOptions: co,
      onDeleteProject,
      onDeleteWorkspace,
      onChangeProjectPmKind,
      projectTypeCatalog,
      onChangeProjectTypeSlug,
      onSetAllowStructuredBreakdown,
      onChangeBrandTimingProfile,
      onChangeProjectTimingProfile,
      brandsForCadenceAdmin,
    };
  }, [
    tree,
    projects,
    selectedKey,
    setSelectedKey,
    clientWsKey,
    setClientWsKey,
    pickClientId,
    setPickClientId,
    pickBrandId,
    setPickBrandId,
    msg,
    err,
    projectDeleteOpen,
    projectDeleteConfirm,
    wsDeleteTarget,
    wsDeleteConfirm,
    loadTree,
    loadProjects,
    router,
    searchParams,
    selectedProject,
    personalPm,
    onDeleteProject,
    onDeleteWorkspace,
    onChangeProjectPmKind,
    projectTypeCatalog,
    onChangeProjectTypeSlug,
    onSetAllowStructuredBreakdown,
    onChangeBrandTimingProfile,
    onChangeProjectTimingProfile,
    brandsForCadenceAdmin,
  ]);
}

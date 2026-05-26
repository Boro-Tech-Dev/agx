'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import { getHierarchyTree } from '../api';
import type { ScenarioTactic } from '../scenarioPlanner/tactics';
import { isKnownTimingProfile, resolveTimingProfileId } from '../scenarioPlanner/timingProfiles';
import type { ProjectHierarchyKeys } from './inferTimingProfileFromProject';
import type {
  HierarchyTreeBrandNode,
  HierarchyTreeClientNode,
  HierarchyTreeResponse,
  HierarchyTreeWorkspaceNode,
} from './hierarchyTreeTypes';

const LS_WORKSPACE = 'dd.tools.workspace_key';
const LS_CLIENT = 'dd.tools.client_key';
const LS_BRAND = 'dd.tools.brand_key';
const LS_PROJECT = 'dd.tools.project_key';

export type CadenceSource = 'brand' | 'project' | 'session' | 'none';

export type ToolsProjectContextValue = {
  hierarchyLoading: boolean;
  hierarchyError: string | null;
  reloadHierarchy: () => Promise<void>;
  workspaceKey: string;
  setWorkspaceKey: (key: string) => void;
  clientKey: string;
  setClientKey: (key: string) => void;
  brandKey: string;
  setBrandKey: (key: string) => void;
  projectKey: string;
  setProjectKey: (key: string) => void;
  workspaceNodes: HierarchyTreeWorkspaceNode[];
  clientNodes: HierarchyTreeClientNode[];
  brandNodes: HierarchyTreeBrandNode[];
  projectOptions: { key: string; name: string }[];
  selectedWorkspace: HierarchyTreeWorkspaceNode['workspace'] | null;
  selectedClient: HierarchyTreeClientNode['client'] | null;
  selectedBrandNode: HierarchyTreeBrandNode | null;
  selectedProject: { key: string; name: string } | null;
  brandId: string | null;
  projectCadenceContext: ProjectHierarchyKeys | null;
  resolvedTimingProfile: ScenarioTactic | null;
  brandTimingProfileId: ScenarioTactic | null;
  projectTimingProfileId: ScenarioTactic | null;
  cadenceSource: CadenceSource;
  toolsScenarioTactic: ScenarioTactic | null;
  handleToolsTimingChange: (tactic: ScenarioTactic) => void;
  clearSessionTimingOverride: () => void;
};

const ToolsProjectContext = createContext<ToolsProjectContextValue | null>(null);

function normTimingId(raw: string | null | undefined): ScenarioTactic | null {
  if (raw == null || !String(raw).trim()) return null;
  const id = resolveTimingProfileId(String(raw).trim());
  return isKnownTimingProfile(id) ? (id as ScenarioTactic) : null;
}

function persistLs(key: string, value: string) {
  if (typeof window === 'undefined') return;
  try {
    if (value) localStorage.setItem(key, value);
    else localStorage.removeItem(key);
  } catch {
    /* ignore */
  }
}

function readLs(key: string): string {
  if (typeof window === 'undefined') return '';
  try {
    return localStorage.getItem(key) ?? '';
  } catch {
    return '';
  }
}

export function ToolsProjectProvider({ children }: { children: ReactNode }) {
  const [tree, setTree] = useState<HierarchyTreeResponse | null>(null);
  const [hierarchyLoading, setHierarchyLoading] = useState(true);
  const [hierarchyError, setHierarchyError] = useState<string | null>(null);
  const [workspaceKey, setWorkspaceKeyState] = useState('');
  const [clientKey, setClientKeyState] = useState('');
  const [brandKey, setBrandKeyState] = useState('');
  const [projectKey, setProjectKeyState] = useState('');
  const [sessionTimingOverride, setSessionTimingOverride] = useState<ScenarioTactic | null>(null);

  const loadHierarchy = useCallback(async () => {
    setHierarchyError(null);
    setHierarchyLoading(true);
    try {
      const raw = await getHierarchyTree();
      const data = raw as HierarchyTreeResponse;
      setTree(data);
    } catch (e: unknown) {
      setTree({ workspaces: [] });
      setHierarchyError(e instanceof Error ? e.message : String(e));
    } finally {
      setHierarchyLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadHierarchy();
  }, [loadHierarchy]);

  const workspaceNodes = useMemo(() => tree?.workspaces ?? [], [tree]);

  const clientNodes = useMemo(() => {
    const wn = workspaceNodes.find((n) => n.workspace.key === workspaceKey);
    return wn?.clients ?? [];
  }, [workspaceNodes, workspaceKey]);

  const brandNodes = useMemo(() => {
    const cn = clientNodes.find((n) => n.client.key === clientKey);
    return cn?.brands ?? [];
  }, [clientNodes, clientKey]);

  const selectedBrandNode = useMemo(
    () => brandNodes.find((n) => n.brand.key === brandKey) ?? null,
    [brandNodes, brandKey],
  );

  const projectOptions = useMemo(() => {
    if (!selectedBrandNode) return [];
    return selectedBrandNode.projects.map((p) => ({ key: p.key, name: p.name }));
  }, [selectedBrandNode]);

  const selectedProject = useMemo(() => {
    if (!projectKey.trim() || !selectedBrandNode) return null;
    const p = selectedBrandNode.projects.find((x) => x.key === projectKey);
    return p ? { key: p.key, name: p.name } : null;
  }, [projectKey, selectedBrandNode]);

  const brandTimingProfileId = useMemo(
    () => normTimingId(selectedBrandNode?.brand.timing_profile_id),
    [selectedBrandNode],
  );

  const projectTimingProfileId = useMemo(() => {
    if (!selectedBrandNode || !projectKey.trim()) return null;
    const p = selectedBrandNode.projects.find((x) => x.key === projectKey);
    return normTimingId(p?.timing_profile_id);
  }, [selectedBrandNode, projectKey]);

  const resolvedTimingProfile = useMemo((): ScenarioTactic | null => {
    if (!selectedBrandNode) return null;
    if (projectKey.trim()) {
      const p = selectedBrandNode.projects.find((x) => x.key === projectKey);
      const fromApi = normTimingId(p?.resolved_timing_profile);
      if (fromApi) return fromApi;
    }
    return brandTimingProfileId;
  }, [selectedBrandNode, projectKey, brandTimingProfileId]);

  const cadenceSource = useMemo((): CadenceSource => {
    if (sessionTimingOverride != null) return 'session';
    if (projectTimingProfileId != null) return 'project';
    if (brandTimingProfileId != null) return 'brand';
    return 'none';
  }, [sessionTimingOverride, projectTimingProfileId, brandTimingProfileId]);

  const toolsScenarioTactic = useMemo((): ScenarioTactic | null => {
    if (sessionTimingOverride != null) return sessionTimingOverride;
    return resolvedTimingProfile;
  }, [sessionTimingOverride, resolvedTimingProfile]);

  const projectCadenceContext = useMemo<ProjectHierarchyKeys | null>(() => {
    if (!workspaceKey || !clientKey || !brandKey) return null;
    return {
      workspace_key: workspaceKey,
      client_key: clientKey,
      brand_key: brandKey,
    };
  }, [workspaceKey, clientKey, brandKey]);

  /** Restore persisted keys once tree loads; coerce invalid combos. */
  useEffect(() => {
    if (hierarchyLoading || !workspaceNodes.length) return;

    const savedWs = readLs(LS_WORKSPACE);
    const savedCl = readLs(LS_CLIENT);
    const savedBr = readLs(LS_BRAND);
    const savedPr = readLs(LS_PROJECT);

    const ws =
      workspaceNodes.find((n) => n.workspace.key === savedWs)?.workspace.key ??
      workspaceNodes[0]?.workspace.key ??
      '';
    const wn = workspaceNodes.find((n) => n.workspace.key === ws);
    const clients = wn?.clients ?? [];
    const cl =
      clients.find((n) => n.client.key === savedCl)?.client.key ?? clients[0]?.client.key ?? '';
    const cn = clients.find((n) => n.client.key === cl);
    const brands = cn?.brands ?? [];
    const br = brands.find((n) => n.brand.key === savedBr)?.brand.key ?? brands[0]?.brand.key ?? '';
    const bn = brands.find((n) => n.brand.key === br);
    const projects = bn?.projects ?? [];
    const pr =
      savedPr && projects.some((p) => p.key === savedPr) ? savedPr : '';

    setWorkspaceKeyState(ws);
    setClientKeyState(cl);
    setBrandKeyState(br);
    setProjectKeyState(pr);
  }, [hierarchyLoading, workspaceNodes]);

  const setWorkspaceKey = useCallback(
    (key: string) => {
      setSessionTimingOverride(null);
      setWorkspaceKeyState(key);
      persistLs(LS_WORKSPACE, key);
      const wn = workspaceNodes.find((n) => n.workspace.key === key);
      const clients = wn?.clients ?? [];
      const cl = clients[0]?.client.key ?? '';
      setClientKeyState(cl);
      persistLs(LS_CLIENT, cl);
      const brands = clients.find((n) => n.client.key === cl)?.brands ?? [];
      const br = brands[0]?.brand.key ?? '';
      setBrandKeyState(br);
      persistLs(LS_BRAND, br);
      setProjectKeyState('');
      persistLs(LS_PROJECT, '');
    },
    [workspaceNodes],
  );

  const setClientKey = useCallback(
    (key: string) => {
      setSessionTimingOverride(null);
      setClientKeyState(key);
      persistLs(LS_CLIENT, key);
      const cn = clientNodes.find((n) => n.client.key === key);
      const br = cn?.brands[0]?.brand.key ?? '';
      setBrandKeyState(br);
      persistLs(LS_BRAND, br);
      setProjectKeyState('');
      persistLs(LS_PROJECT, '');
    },
    [clientNodes],
  );

  const setBrandKey = useCallback((key: string) => {
    setSessionTimingOverride(null);
    setBrandKeyState(key);
    persistLs(LS_BRAND, key);
    setProjectKeyState('');
    persistLs(LS_PROJECT, '');
  }, []);

  const setProjectKey = useCallback((key: string) => {
    setSessionTimingOverride(null);
    setProjectKeyState(key);
    persistLs(LS_PROJECT, key);
  }, []);

  const handleToolsTimingChange = useCallback((tactic: ScenarioTactic) => {
    setSessionTimingOverride(tactic);
  }, []);

  const clearSessionTimingOverride = useCallback(() => {
    setSessionTimingOverride(null);
  }, []);

  const selectedWorkspace = useMemo(
    () => workspaceNodes.find((n) => n.workspace.key === workspaceKey)?.workspace ?? null,
    [workspaceNodes, workspaceKey],
  );

  const selectedClient = useMemo(
    () => clientNodes.find((n) => n.client.key === clientKey)?.client ?? null,
    [clientNodes, clientKey],
  );

  const brandId = selectedBrandNode?.brand.id ?? null;

  const value = useMemo<ToolsProjectContextValue>(
    () => ({
      hierarchyLoading,
      hierarchyError,
      reloadHierarchy: loadHierarchy,
      workspaceKey,
      setWorkspaceKey,
      clientKey,
      setClientKey,
      brandKey,
      setBrandKey,
      projectKey,
      setProjectKey,
      workspaceNodes,
      clientNodes,
      brandNodes,
      projectOptions,
      selectedWorkspace,
      selectedClient,
      selectedBrandNode,
      selectedProject,
      brandId,
      projectCadenceContext,
      resolvedTimingProfile,
      brandTimingProfileId,
      projectTimingProfileId,
      cadenceSource,
      toolsScenarioTactic,
      handleToolsTimingChange,
      clearSessionTimingOverride,
    }),
    [
      hierarchyLoading,
      hierarchyError,
      loadHierarchy,
      workspaceKey,
      setWorkspaceKey,
      clientKey,
      setClientKey,
      brandKey,
      setBrandKey,
      projectKey,
      setProjectKey,
      workspaceNodes,
      clientNodes,
      brandNodes,
      projectOptions,
      selectedWorkspace,
      selectedClient,
      selectedBrandNode,
      selectedProject,
      brandId,
      projectCadenceContext,
      resolvedTimingProfile,
      brandTimingProfileId,
      projectTimingProfileId,
      cadenceSource,
      toolsScenarioTactic,
      handleToolsTimingChange,
      clearSessionTimingOverride,
    ],
  );

  return <ToolsProjectContext.Provider value={value}>{children}</ToolsProjectContext.Provider>;
}

export function useToolsProject(): ToolsProjectContextValue {
  const ctx = useContext(ToolsProjectContext);
  if (!ctx) {
    throw new Error('useToolsProject must be used within ToolsProjectProvider');
  }
  return ctx;
}

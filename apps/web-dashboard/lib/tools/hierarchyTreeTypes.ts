/** Shape of GET /api/hierarchy/tree (enriched with timing fields). */

export type HierarchyTreeProject = {
  key: string;
  name: string;
  timing_profile_id?: string | null;
  brand_timing_profile_id?: string | null;
  resolved_timing_profile?: string | null;
};

export type HierarchyTreeBrand = {
  id: string;
  key: string;
  name: string;
  timing_profile_id?: string | null;
};

export type HierarchyTreeClient = {
  id: string;
  key: string;
  name: string;
};

export type HierarchyTreeWorkspace = {
  key: string;
  name: string;
};

export type HierarchyTreeBrandNode = {
  brand: HierarchyTreeBrand;
  projects: HierarchyTreeProject[];
};

export type HierarchyTreeClientNode = {
  client: HierarchyTreeClient;
  brands: HierarchyTreeBrandNode[];
};

export type HierarchyTreeWorkspaceNode = {
  workspace: HierarchyTreeWorkspace;
  clients: HierarchyTreeClientNode[];
};

export type HierarchyTreeResponse = {
  workspaces?: HierarchyTreeWorkspaceNode[];
};

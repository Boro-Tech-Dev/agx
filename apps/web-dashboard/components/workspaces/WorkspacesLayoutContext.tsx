'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  DEFAULT_WORKSPACES_LAYOUT,
  readWorkspacesLayoutFromStorage,
  writeWorkspacesLayoutToStorage,
  type WorkspacesLayoutV1,
  type WorkspacesPanelId,
} from '../../lib/workspaces/layoutSchema';

type Ctx = {
  layout: WorkspacesLayoutV1;
  setLayout: (next: WorkspacesLayoutV1 | ((prev: WorkspacesLayoutV1) => WorkspacesLayoutV1)) => void;
  togglePanelHidden: (id: WorkspacesPanelId) => void;
  togglePanelCollapsed: (id: WorkspacesPanelId) => void;
  togglePanelLayoutToolbarExpanded: () => void;
  resetLayout: () => void;
  visibleOrderedPanels: WorkspacesPanelId[];
};

const WorkspacesLayoutContext = createContext<Ctx | null>(null);

export function WorkspacesLayoutProvider({ children }: { children: ReactNode }) {
  const [layout, setLayoutState] = useState<WorkspacesLayoutV1>(() => ({ ...DEFAULT_WORKSPACES_LAYOUT }));

  useEffect(() => {
    setLayoutState(readWorkspacesLayoutFromStorage());
  }, []);

  const setLayout = useCallback((next: WorkspacesLayoutV1 | ((prev: WorkspacesLayoutV1) => WorkspacesLayoutV1)) => {
    setLayoutState((prev) => {
      const resolved = typeof next === 'function' ? (next as (p: WorkspacesLayoutV1) => WorkspacesLayoutV1)(prev) : next;
      writeWorkspacesLayoutToStorage(resolved);
      return resolved;
    });
  }, []);

  const togglePanelHidden = useCallback((id: WorkspacesPanelId) => {
    setLayout((prev) => ({
      ...prev,
      hidden: { ...prev.hidden, [id]: !prev.hidden[id] },
    }));
  }, [setLayout]);

  const togglePanelCollapsed = useCallback((id: WorkspacesPanelId) => {
    setLayout((prev) => ({
      ...prev,
      collapsed: { ...prev.collapsed, [id]: !prev.collapsed[id] },
    }));
  }, [setLayout]);

  const togglePanelLayoutToolbarExpanded = useCallback(() => {
    setLayout((prev) => ({
      ...prev,
      panelLayoutToolbarExpanded: !prev.panelLayoutToolbarExpanded,
    }));
  }, [setLayout]);

  const resetLayout = useCallback(() => {
    setLayout({ ...DEFAULT_WORKSPACES_LAYOUT });
  }, [setLayout]);

  const visibleOrderedPanels = useMemo(
    () => layout.order.filter((id) => !layout.hidden[id]),
    [layout.order, layout.hidden],
  );

  const value = useMemo(
    () => ({
      layout,
      setLayout,
      togglePanelHidden,
      togglePanelCollapsed,
      togglePanelLayoutToolbarExpanded,
      resetLayout,
      visibleOrderedPanels,
    }),
    [
      layout,
      setLayout,
      togglePanelHidden,
      togglePanelCollapsed,
      togglePanelLayoutToolbarExpanded,
      resetLayout,
      visibleOrderedPanels,
    ],
  );

  return <WorkspacesLayoutContext.Provider value={value}>{children}</WorkspacesLayoutContext.Provider>;
}

export function useWorkspacesLayout() {
  const v = useContext(WorkspacesLayoutContext);
  if (!v) throw new Error('useWorkspacesLayout must be used under WorkspacesLayoutProvider');
  return v;
}

'use client';

import { createContext, useContext, useMemo, type ReactNode } from 'react';

type NavShellPrefs = {
  initialAgentsExpanded: boolean;
  initialOpsExpanded: boolean;
  initialToolsExpanded: boolean;
};

const NavShellPrefsContext = createContext<NavShellPrefs>({
  initialAgentsExpanded: true,
  initialOpsExpanded: true,
  initialToolsExpanded: true,
});

export function NavShellPrefsProvider({
  initialAgentsExpanded,
  initialOpsExpanded,
  initialToolsExpanded,
  children,
}: {
  initialAgentsExpanded: boolean;
  initialOpsExpanded: boolean;
  initialToolsExpanded: boolean;
  children: ReactNode;
}) {
  const value = useMemo(
    () => ({ initialAgentsExpanded, initialOpsExpanded, initialToolsExpanded }),
    [initialAgentsExpanded, initialOpsExpanded, initialToolsExpanded],
  );
  return <NavShellPrefsContext.Provider value={value}>{children}</NavShellPrefsContext.Provider>;
}

export function useNavShellPrefs(): NavShellPrefs {
  return useContext(NavShellPrefsContext);
}

'use client';

import { useEffect, useState } from 'react';

import { listAgents } from '../api';
import { enabledAgentNavKeysFromCatalog, type AgentNavKey } from '../agents';

const NAV_AGENT_KEYS_FALLBACK: AgentNavKey[] = [
  'pm',
  'synergy',
  'clinic',
  'builder',
  'canon',
  'forge',
  'kitt',
  'eddie',
  'bubs',
];

export function useDashboardNavAgents() {
  const [navAgentKeys, setNavAgentKeys] = useState<AgentNavKey[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    void listAgents()
      .then((rows) => {
        setNavAgentKeys(enabledAgentNavKeysFromCatalog(rows));
        setReady(true);
      })
      .catch(() => {
        setNavAgentKeys(NAV_AGENT_KEYS_FALLBACK);
        setReady(true);
      });
  }, []);

  return { navAgentKeys, ready };
}

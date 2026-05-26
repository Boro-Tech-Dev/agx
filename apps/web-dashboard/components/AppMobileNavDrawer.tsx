'use client';

import * as Dialog from '@radix-ui/react-dialog';
import Link from 'next/link';
import { useEffect, useState } from 'react';

import { listAgents } from '../lib/api';
import {
  agentMeta,
  enabledAgentNavKeysFromCatalog,
  type AgentNavKey,
} from '../lib/agents';
import { primaryToolSidebarGroupsVisible, SIDEBAR_TOOLS_GROUP_INDEX, TOOLS_HUB_NAV } from '../lib/navConfig';
import { AuthLogoutButton } from './AuthLogoutButton';

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

const drawerLinkClass =
  'block border border-rt-panel bg-rt-charcoal px-2 py-1.5 font-mono text-[11px] font-medium uppercase tracking-wide text-rt-ice hover:border-rt-cyan hover:text-rt-cyan';

export function AppMobileNavDrawer({
  agents: agentsProp,
}: {
  /** Optional: home passes SSR agent keys/names; shell omits and loads client-side. */
  agents?: { key: string; name: string }[];
}) {
  const [open, setOpen] = useState(false);
  const [agentKeys, setAgentKeys] = useState<AgentNavKey[]>(NAV_AGENT_KEYS_FALLBACK);

  useEffect(() => {
    if (agentsProp && agentsProp.length > 0) return;
    void listAgents()
      .then((rows) => setAgentKeys(enabledAgentNavKeysFromCatalog(rows)))
      .catch(() => setAgentKeys(NAV_AGENT_KEYS_FALLBACK));
  }, [agentsProp]);

  const agentRows =
    agentsProp && agentsProp.length > 0
      ? agentsProp.map((a) => ({ key: a.key, name: a.name }))
      : agentKeys.map((key) => ({ key, name: agentMeta[key].name }));

  const close = () => setOpen(false);

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>
        <button
          type="button"
          className="rounded-md border border-app-border bg-app-fill px-2 py-1 text-[11px] font-semibold text-app-text hover:bg-app-fill-hover"
        >
          Menu
        </button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[90] bg-black/50" />
        <Dialog.Content
          className="fixed left-2 right-2 top-2 z-[91] max-h-[min(92vh,32rem)] overflow-y-auto rounded-lg border border-app-border bg-app-elevated p-3 shadow-xl outline-none xs:left-auto xs:right-2 xs:w-[min(100vw-1rem,20rem)]"
          aria-describedby={undefined}
        >
          <Dialog.Title className="text-sm font-bold text-app-text">Navigate</Dialog.Title>
          <Dialog.Description className="sr-only">Jump to a tool, agent, or the dashboard.</Dialog.Description>
          <p className="mt-0.5 text-[10px] text-app-muted">Tools and agents</p>

          <div className="mt-2 space-y-0.5">
            <p className="text-[9px] font-semibold uppercase tracking-wide text-slate-600 dark:text-app-muted">Places</p>
            {primaryToolSidebarGroupsVisible().map((group, gi) => (
              <div key={gi}>
                {gi > 0 ? <div className="my-1.5 border-t border-app-border" /> : null}
                {gi === SIDEBAR_TOOLS_GROUP_INDEX ? (
                  <Dialog.Close asChild>
                    <Link href={TOOLS_HUB_NAV.href} className={drawerLinkClass} onClick={close}>
                      {TOOLS_HUB_NAV.label}
                    </Link>
                  </Dialog.Close>
                ) : null}
                {group.map((t) => (
                  <Dialog.Close key={t.id} asChild>
                    <Link href={t.href} className={drawerLinkClass} onClick={close}>
                      {t.label}
                    </Link>
                  </Dialog.Close>
                ))}
              </div>
            ))}
            <Dialog.Close asChild>
              <Link href="/model" className={drawerLinkClass} onClick={close}>
                Models
              </Link>
            </Dialog.Close>
            <div className="my-1.5 border-t border-app-border" />
            <AuthLogoutButton className={`${drawerLinkClass} w-full text-left`}>Logout</AuthLogoutButton>
            <Dialog.Close asChild>
              <Link href="/" className={drawerLinkClass} onClick={close}>
                Dashboard
              </Link>
            </Dialog.Close>
          </div>

          <div className="mt-2.5 space-y-0.5">
            <p className="text-[9px] font-semibold uppercase tracking-wide text-slate-600 dark:text-app-muted">Agents</p>
            {agentRows.map((a) => (
              <Dialog.Close key={a.key} asChild>
                <Link href={`/agents/${a.key}`} className={drawerLinkClass} onClick={close}>
                  {a.name}
                </Link>
              </Dialog.Close>
            ))}
          </div>

        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

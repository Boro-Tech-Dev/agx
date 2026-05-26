'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { Command } from 'cmdk';

import { catalogToolCommandNav, primaryToolNavVisible } from '../../lib/navConfig';

export type HomeCommandPaletteAgent = { key: string; name: string };

export function HomeCommandPalette({ agents }: { agents: HomeCommandPaletteAgent[] }) {
  const [open, setOpen] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  const go = useCallback(
    (path: string) => {
      setOpen(false);
      router.push(path);
    },
    [router],
  );

  const placesNav = primaryToolNavVisible().filter((t) => t.id !== 'tools');

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-md border border-app-border bg-app-fill/80 px-2 py-1 text-[10px] font-medium text-app-muted transition-colors hover:border-nav-active-border hover:text-app-text"
      >
        ⌘K
      </button>
      <Command.Dialog
        open={open}
        onOpenChange={setOpen}
        label="Command menu"
        className="fixed left-1/2 top-[12vh] z-[100] w-[min(100vw-1.5rem,26rem)] -translate-x-1/2 overflow-hidden rounded-lg border border-app-border bg-app-elevated text-app-text shadow-2xl [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-[10px] [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wide [&_[cmdk-group-heading]]:text-app-muted"
      >
        <div className="border-b border-app-border px-2 py-1.5">
          <Command.Input
            placeholder="Jump to page, agent, or open a run…"
            className="w-full rounded border border-app-border bg-app-canvas px-2 py-1.5 text-[12px] text-app-text outline-none ring-nav-tab-line focus:ring-1"
          />
        </div>
        <Command.List className="max-h-[min(60vh,22rem)] overflow-y-auto p-1">
          <Command.Empty className="px-2 py-3 text-center text-[11px] text-app-muted">No matches.</Command.Empty>

          <Command.Group heading="Places">
            {placesNav.map((t) => (
              <Command.Item
                key={t.id}
                value={`${t.label} ${t.href}`}
                onSelect={() => go(t.href)}
                className="cursor-pointer rounded px-2 py-1.5 text-[12px] text-app-text aria-selected:bg-nav-active-bg aria-selected:text-nav-active-fg"
              >
                {t.label}
              </Command.Item>
            ))}
            <Command.Item
              value="Home /"
              onSelect={() => go('/')}
              className="cursor-pointer rounded px-2 py-1.5 text-[12px] text-app-text aria-selected:bg-nav-active-bg aria-selected:text-nav-active-fg"
            >
              Home
            </Command.Item>
          </Command.Group>

          <Command.Group heading="Tools">
            {catalogToolCommandNav().map((t) => (
              <Command.Item
                key={t.id}
                value={`${t.label} ${t.href} tool`}
                onSelect={() => go(t.href)}
                className="cursor-pointer rounded px-2 py-1.5 text-[12px] text-app-text aria-selected:bg-nav-active-bg aria-selected:text-nav-active-fg"
              >
                {t.label}
              </Command.Item>
            ))}
          </Command.Group>

          <Command.Group heading="Agents">
            {agents.map((a) => (
              <Command.Item
                key={a.key}
                value={`${a.name} ${a.key} agent`}
                onSelect={() => go(`/agents/${a.key}`)}
                className="cursor-pointer rounded px-2 py-1.5 text-[12px] text-app-text aria-selected:bg-nav-active-bg aria-selected:text-nav-active-fg"
              >
                {a.name} <span className="text-app-muted">({a.key})</span>
              </Command.Item>
            ))}
          </Command.Group>

          <Command.Group heading="Run by id">
            <Command.Item
              value="open run id uuid"
              onSelect={() => {
                const q = window.prompt('Run id (UUID)');
                if (q && q.trim()) go(`/runs/${q.trim()}`);
                setOpen(false);
              }}
              className="cursor-pointer rounded px-2 py-1.5 text-[12px] text-app-text aria-selected:bg-nav-active-bg aria-selected:text-nav-active-fg"
            >
              Open run by ID…
            </Command.Item>
          </Command.Group>
        </Command.List>
      </Command.Dialog>
    </>
  );
}

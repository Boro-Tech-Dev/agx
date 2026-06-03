'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Activity, Bell, Search } from 'lucide-react';

import { useModelStatusContext } from '../model/ModelStatusProvider';
import { AppMobileNavDrawer } from '../AppMobileNavDrawer';
import { RtBadge } from '../ui/ragtag/RtBadge';
import { cn } from '../../lib/cn';

function SystemStatusPill() {
  const { tone, loading } = useModelStatusContext();
  const online = !loading && tone === 'green';
  return (
    <div className="hidden items-center gap-2 rounded border border-rt-panel bg-rt-charcoal px-2 py-1 md:flex">
      <Activity
        className={cn(
          'h-3 w-3',
          online ? 'text-rt-green motion-safe:animate-pulse' : 'text-rt-orange',
        )}
      />
      <span className="font-mono text-[10px] uppercase tracking-wider text-rt-ice">
        {loading ? 'Checking grid…' : online ? 'Grid Online / Local Model Ready / Queue Active' : 'Grid Degraded'}
      </span>
    </div>
  );
}

function navLinkClass(active: boolean) {
  return cn(
    'border-b-2 px-3 py-1 text-xs uppercase tracking-wider transition-colors',
    active
      ? 'border-rt-cyan text-rt-cyan'
      : 'border-transparent text-rt-ice hover:bg-rt-charcoal hover:text-rt-cyan',
  );
}

export function RagTagTopNav() {
  const pathname = usePathname() ?? '/';
  const onGrid = pathname === '/home';
  const onTools = pathname === '/tools' || pathname.startsWith('/tools/');
  const onQueue = pathname === '/monitoring';

  return (
    <header className="flex h-14 shrink-0 items-center justify-between border-b border-rt-panel bg-rt-black px-4 lg:px-6">
      <div className="flex items-center gap-6">
        <RtBadge href="/home" />
        <SystemStatusPill />
      </div>

      <div className="flex items-center gap-4">
        <nav className="hidden items-center gap-1 md:flex" aria-label="Primary">
          <Link href="/home" className={navLinkClass(onGrid)}>
            Grid
          </Link>
          <Link href="/tools" className={navLinkClass(onTools)}>
            Tools
          </Link>
          <Link href="/monitoring" className={navLinkClass(onQueue)}>
            Queue
          </Link>
        </nav>
        <div className="mx-2 hidden h-4 w-px bg-rt-panel md:block" />
        <button
          type="button"
          className="text-rt-ice transition-colors hover:text-rt-cyan"
          aria-label="Search"
        >
          <Search className="h-4 w-4" />
        </button>
        <button
          type="button"
          className="relative text-rt-ice transition-colors hover:text-rt-cyan"
          aria-label="Notifications"
        >
          <Bell className="h-4 w-4" />
          <span className="absolute -right-1 -top-1 h-2 w-2 rounded-full bg-rt-orange" />
        </button>
        <div className="md:hidden">
          <AppMobileNavDrawer />
        </div>
      </div>
    </header>
  );
}

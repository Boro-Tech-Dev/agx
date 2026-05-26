'use client';

import { useCallback, useState, type ReactNode } from 'react';

const DEFAULT_HEADER_CLASS =
  'rounded-md border border-app-border bg-app-fill px-2 py-1 text-[11px] font-medium text-app-muted hover:bg-app-fill-hover disabled:opacity-60';

export function AuthLogoutButton({
  className,
  children,
}: {
  /** When set, replaces the default header chip styles (e.g. sidebar row). */
  className?: string;
  children?: ReactNode;
}) {
  const [busy, setBusy] = useState(false);

  const logout = useCallback(async () => {
    setBusy(true);
    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
        headers: { Accept: 'text/html' },
        redirect: 'manual',
      });
    } finally {
      window.location.href = '/login';
    }
  }, []);

  return (
    <button
      type="button"
      onClick={logout}
      disabled={busy}
      className={className ?? DEFAULT_HEADER_CLASS}
    >
      {busy ? '…' : (children ?? 'Log out')}
    </button>
  );
}

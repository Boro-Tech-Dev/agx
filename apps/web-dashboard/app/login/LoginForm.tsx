'use client';

import { useSearchParams } from 'next/navigation';
import { useCallback, useMemo, useState } from 'react';

import { safeNextPath } from '../../lib/auth/safeNextPath';
import { RT_BTN_PRIMARY, RT_INPUT, RT_PANEL } from '../../lib/ragtag/panelClasses';

const field = RT_INPUT;

export function LoginForm() {
  const searchParams = useSearchParams();
  const next = useMemo(() => safeNextPath(searchParams.get('next')), [searchParams]);

  const authDisabled = useMemo(
    () => (process.env.NEXT_PUBLIC_AUTH_DISABLED || '').trim() === '1',
    [],
  );

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const onSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setErr(null);
      if (authDisabled) {
        setErr('Sign-in is disabled (NEXT_PUBLIC_AUTH_DISABLED).');
        return;
      }
      setBusy(true);
      try {
        // Default redirect: 'follow' — manual redirect + cross-host Location yields opaque responses (status 0).
        const res = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          credentials: 'include',
          redirect: 'manual',
          body: JSON.stringify({ username, password, next }),
        });
        if (res.ok || res.redirected) {
          window.location.assign(new URL(next, window.location.origin).href);
          return;
        }
        const text = await res.text();
        let msg = 'Sign-in failed.';
        try {
          const j = JSON.parse(text) as { error?: string };
          if (typeof j.error === 'string' && j.error.trim()) msg = j.error;
        } catch {
          if (res.status === 401) msg = 'Invalid username or password.';
        }
        setErr(msg);
      } catch {
        setErr('Network error. Try again.');
      } finally {
        setBusy(false);
      }
    },
    [username, password, next, authDisabled],
  );

  if (authDisabled) {
    return (
      <div className={`w-full max-w-sm ${RT_PANEL}`}>
        <p className="text-[13px] text-rt-ice/70">
          Authentication is disabled for this environment. Use the{' '}
          <a href="/" className="text-rt-cyan underline">
            dashboard
          </a>
          .
        </p>
      </div>
    );
  }

  return (
    <div className={`w-full max-w-sm ${RT_PANEL}`}>
      <h1 className="font-display text-lg font-bold uppercase tracking-widest text-rt-white">Sign in</h1>
      <p className="mt-1 font-mono text-[11px] text-rt-ice/60">PM Operator Grid — internal access</p>

      <form className="mt-4 space-y-3" onSubmit={onSubmit}>
        <div>
          <label htmlFor="username" className="mb-1 block text-[11px] font-medium text-app-muted">
            Username
          </label>
          <input
            id="username"
            name="username"
            autoComplete="username"
            className={field}
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
          />
        </div>
        <div>
          <label htmlFor="password" className="mb-1 block text-[11px] font-medium text-app-muted">
            Password
          </label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            className={field}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>
        {err && (
          <div className="rounded-md border border-rose-200 bg-rose-50 p-2 text-[11px] text-rose-900 dark:border-rose-500/35 dark:bg-rose-500/10 dark:text-rose-100">
            {err}
          </div>
        )}
        <button
          type="submit"
          disabled={busy}
          className={`w-full ${RT_BTN_PRIMARY}`}
        >
          {busy ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
    </div>
  );
}

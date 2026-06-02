import { HazardStripe } from '../../components/ui/ragtag/HazardStripe';
import { RtBadge } from '../../components/ui/ragtag/RtBadge';
import { isAuthDisabled } from '../../lib/auth/env';
import { capLoginErrorMessage } from '../../lib/auth/loginRedirect';
import { safeNextPath } from '../../lib/auth/safeNextPath';
import { RT_BTN_PRIMARY, RT_INPUT, RT_PANEL } from '../../lib/ragtag/panelClasses';

type LoginPageProps = {
  searchParams?: { next?: string; error?: string };
};

export default function LoginPage({ searchParams }: LoginPageProps) {
  const next = safeNextPath(searchParams?.next);
  const errorRaw = typeof searchParams?.error === 'string' ? searchParams.error : '';
  const error = errorRaw ? capLoginErrorMessage(errorRaw) : null;

  if (isAuthDisabled()) {
    return (
      <main className="flex min-h-screen flex-col bg-rt-black p-4 font-sans text-rt-ice">
        <HazardStripe />
        <div className="flex flex-col items-center justify-center gap-6 py-12">
          <RtBadge />
          <div className={`w-full max-w-sm ${RT_PANEL}`}>
            <p className="text-[13px] text-rt-ice/70">
              Authentication is disabled for this environment. Use the{' '}
              <a href="/" className="text-rt-cyan underline">
                dashboard
              </a>
              .
            </p>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen flex-col bg-rt-black p-4 font-sans text-rt-ice">
      <HazardStripe />
      <div className="flex flex-col items-center justify-center gap-6 py-12">
        <RtBadge />
        <div className={`w-full max-w-sm ${RT_PANEL}`}>
          <h1 className="font-display text-lg font-bold uppercase tracking-widest text-rt-white">Sign in</h1>
          <p className="mt-1 font-mono text-[11px] text-rt-ice/60">PM Operator Grid — internal access</p>

          <form className="mt-4 space-y-3" method="POST" action="/api/auth/login" acceptCharset="UTF-8">
            <input type="hidden" name="next" value={next} />
            <div>
              <label htmlFor="username" className="mb-1 block text-[11px] font-medium text-app-muted">
                Username
              </label>
              <input
                id="username"
                name="username"
                autoComplete="username"
                className={RT_INPUT}
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
                className={RT_INPUT}
                required
              />
            </div>
            {error ? (
              <div className="rounded-md border border-rose-200 bg-rose-50 p-2 text-[11px] text-rose-900 dark:border-rose-500/35 dark:bg-rose-500/10 dark:text-rose-100">
                {error}
              </div>
            ) : null}
            <button type="submit" className={`w-full ${RT_BTN_PRIMARY}`}>
              Sign in
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}

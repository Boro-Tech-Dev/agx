import { DashboardShell } from '../../../components/DashboardShell';
import { SubpageHeader } from '../../../components/SubpageHeader';
import { CONTRIBUTORS, contributorInitials } from '../../../lib/contributors';

export default function ContributorsPage() {
  return (
    <DashboardShell
      header={<SubpageHeader badge="Ops" badgeTone="muted" title="Contributors" />}
      activeTool="contributors"
    >
      <p className="mb-4 max-w-2xl text-xs leading-relaxed text-app-muted">
        Colleagues who helped ship this platform. Thank you.
      </p>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {CONTRIBUTORS.map((c) => (
          <div
            key={c.name}
            className="flex gap-3 rounded-lg border border-app-border bg-app-surface p-3 shadow-xs"
          >
            <div
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-app-border bg-app-fill text-[12px] font-bold text-app-text"
              aria-hidden
            >
              {contributorInitials(c.name)}
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-semibold text-app-text">{c.name}</div>
              {c.role ? (
                <p className="mt-0.5 text-[11px] leading-snug text-app-muted">{c.role}</p>
              ) : null}
              {c.href ? (
                <a
                  href={c.href}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-1.5 inline-block text-[11px] font-medium text-violet-700 hover:text-violet-800 dark:text-violet-300 dark:hover:text-violet-200"
                >
                  {c.linkLabel ?? 'Profile'}
                </a>
              ) : null}
            </div>
          </div>
        ))}
      </div>
    </DashboardShell>
  );
}

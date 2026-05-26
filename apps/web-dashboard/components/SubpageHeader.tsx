import type { ReactNode } from 'react';

import { SHELL_BADGE_ACCENT, SHELL_BADGE_MUTED } from '../lib/shellClasses';
import { LearnResumeChip } from './tools/learning/LearnResumeChip';
import { SubpageHeaderModelsLink } from './SubpageHeaderModelsLink';
export type SubpageBadgeTone = 'accent' | 'muted';

export function SubpageHeader({
  badge,
  badgeClassName,
  badgeTone = 'accent',
  title,
  trailing,
  dashboardHref = '/',
  actions,
}: {
  badge: string;
  /** @deprecated Prefer badgeTone for unified shell styling. */
  badgeClassName?: string;
  badgeTone?: SubpageBadgeTone;
  title: string;
  trailing?: ReactNode;
  dashboardHref?: string;
  actions?: ReactNode;
}) {
  const badgeCls =
    badgeClassName != null && badgeClassName !== ''
      ? `shrink-0 rounded px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white ${badgeClassName}`
      : badgeTone === 'muted'
        ? SHELL_BADGE_MUTED
        : SHELL_BADGE_ACCENT;

  return (
    <div className="mb-0 flex min-w-0 flex-col gap-2 tablet:flex-row tablet:items-center tablet:justify-between">
      <div className="flex min-w-0 flex-wrap items-center gap-2">
        <span className={badgeCls}>{badge}</span>
        <h1 className="text-base font-bold tracking-tight text-app-text">{title}</h1>
        {trailing}
      </div>
      <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
        {actions}
        <a
          href={dashboardHref}
          className="rounded-md border border-app-border bg-app-fill px-2 py-1 text-[11px] font-medium text-app-muted hover:bg-app-fill-hover"
        >
          ← Dashboard
        </a>
        <LearnResumeChip />
        <SubpageHeaderModelsLink />
      </div>
    </div>
  );
}

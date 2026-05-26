import type { DashboardToolKey } from '../navConfig';

export function operationsMonogram(label: string): string {
  const words = label.trim().split(/\s+/).filter(Boolean);
  if (words.length >= 2) {
    return (words[0].charAt(0) + words[1].charAt(0)).toUpperCase();
  }
  return label.slice(0, 2).toUpperCase();
}

/** Accent palette per operations destination (parallel to toolAccentClasses). */
export function operationsAccentClasses(
  id: DashboardToolKey,
): { ring: string; chip: string; glow: string; category: string } {
  switch (id) {
    case 'workspaces':
      return {
        ring: 'ring-indigo-500/25 hover:ring-indigo-500/40',
        chip: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-500/15 dark:text-indigo-200',
        glow: 'from-indigo-500/10',
        category: 'Command center',
      };
    case 'reports':
      return {
        ring: 'ring-sky-500/25 hover:ring-sky-500/40',
        chip: 'bg-sky-100 text-sky-800 dark:bg-sky-500/15 dark:text-sky-200',
        glow: 'from-sky-500/10',
        category: 'Portfolio',
      };
    case 'monitoring':
      return {
        ring: 'ring-amber-500/25 hover:ring-amber-500/40',
        chip: 'bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-200',
        glow: 'from-amber-500/10',
        category: 'Health',
      };
    case 'memory':
      return {
        ring: 'ring-violet-500/25 hover:ring-violet-500/40',
        chip: 'bg-violet-100 text-violet-800 dark:bg-violet-500/15 dark:text-violet-200',
        glow: 'from-violet-500/10',
        category: 'Knowledge',
      };
    case 'artifacts':
      return {
        ring: 'ring-cyan-500/25 hover:ring-cyan-500/40',
        chip: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-500/15 dark:text-cyan-200',
        glow: 'from-cyan-500/10',
        category: 'Outputs',
      };
    case 'approvals':
      return {
        ring: 'ring-rose-500/25 hover:ring-rose-500/40',
        chip: 'bg-rose-100 text-rose-800 dark:bg-rose-500/15 dark:text-rose-200',
        glow: 'from-rose-500/10',
        category: 'Governance',
      };
    case 'governance':
      return {
        ring: 'ring-slate-500/25 hover:ring-slate-500/40',
        chip: 'bg-slate-100 text-slate-800 dark:bg-slate-500/15 dark:text-slate-200',
        glow: 'from-slate-500/10',
        category: 'Policy',
      };
    case 'brief_ops':
      return {
        ring: 'ring-fuchsia-500/25 hover:ring-fuchsia-500/40',
        chip: 'bg-fuchsia-100 text-fuchsia-800 dark:bg-fuchsia-500/15 dark:text-fuchsia-200',
        glow: 'from-fuchsia-500/10',
        category: 'Admin',
      };
    case 'contributors':
      return {
        ring: 'ring-emerald-500/25 hover:ring-emerald-500/40',
        chip: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-200',
        glow: 'from-emerald-500/10',
        category: 'Community',
      };
    default:
      return {
        ring: 'ring-slate-500/25 hover:ring-slate-500/40',
        chip: 'bg-slate-100 text-slate-800 dark:bg-slate-500/15 dark:text-slate-200',
        glow: 'from-slate-500/10',
        category: 'Operations',
      };
  }
}

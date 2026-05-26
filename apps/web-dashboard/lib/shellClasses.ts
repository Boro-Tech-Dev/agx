/** RagTag operator grid shell surface classes (single fixed layout). */
const SHELL = {
  HERO_BAND: 'border-b border-rt-panel bg-rt-charcoal',
  HEADER_BAND: 'border-b border-rt-panel bg-rt-charcoal px-4 py-2 lg:px-6',
  OPS_BAND: 'border border-rt-panel border-l-2 border-l-rt-yellow bg-rt-charcoal px-2 py-1.5',
  AGENTS_SECTION: 'border border-rt-panel border-t-2 border-t-rt-cyan bg-rt-charcoal px-2 py-2',
  WORK_SURFACE: 'border border-rt-panel border-l-2 border-l-rt-cyan bg-rt-black p-2 min-w-0',
} as const;

export type ShellClassSet = typeof SHELL;

export function getShellClasses(): ShellClassSet {
  return SHELL;
}

export const SHELL_HERO_BAND = SHELL.HERO_BAND;
export const SHELL_HEADER_BAND = SHELL.HEADER_BAND;
export const SHELL_OPS_BAND = SHELL.OPS_BAND;
export const SHELL_AGENTS_SECTION = SHELL.AGENTS_SECTION;
export const SHELL_WORK_SURFACE = SHELL.WORK_SURFACE;

export const SHELL_BADGE_ACCENT =
  'shrink-0 rounded px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-rt-cyan text-rt-black';

export const SHELL_BADGE_MUTED =
  'shrink-0 rounded border border-rt-panel bg-rt-charcoal px-2 py-0.5 text-[10px] font-mono uppercase tracking-widest text-rt-ice/60';

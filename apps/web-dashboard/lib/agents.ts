export const accentClasses: Record<
  string,
  { activeBg: string; activeText: string; idleText: string; idleBg: string; border: string; chip: string }
> = {
  fuchsia: {
    activeBg: 'bg-rt-cyan',
    activeText: 'text-rt-black',
    idleText: 'text-rt-ice/80',
    idleBg: 'hover:bg-rt-panel',
    border: 'border-l-rt-cyan',
    chip: 'bg-rt-cyan/15 text-rt-cyan',
  },
  indigo: {
    activeBg: 'bg-rt-purple',
    activeText: 'text-rt-black',
    idleText: 'text-rt-ice/80',
    idleBg: 'hover:bg-rt-panel',
    border: 'border-l-rt-purple',
    chip: 'bg-rt-purple/15 text-rt-purple',
  },
  emerald: {
    activeBg: 'bg-rt-green',
    activeText: 'text-rt-black',
    idleText: 'text-rt-ice/80',
    idleBg: 'hover:bg-rt-panel',
    border: 'border-l-rt-green',
    chip: 'bg-rt-green/15 text-rt-green',
  },
  amber: {
    activeBg: 'bg-rt-yellow',
    activeText: 'text-rt-black',
    idleText: 'text-rt-ice/80',
    idleBg: 'hover:bg-rt-panel',
    border: 'border-l-rt-yellow',
    chip: 'bg-rt-yellow/15 text-rt-yellow',
  },
  rose: {
    activeBg: 'bg-rt-orange',
    activeText: 'text-rt-black',
    idleText: 'text-rt-ice/80',
    idleBg: 'hover:bg-rt-panel',
    border: 'border-l-rt-orange',
    chip: 'bg-rt-orange/15 text-rt-orange',
  },
  teal: {
    activeBg: 'bg-rt-cyan',
    activeText: 'text-rt-black',
    idleText: 'text-rt-ice/80',
    idleBg: 'hover:bg-rt-panel',
    border: 'border-l-rt-cyan',
    chip: 'bg-rt-cyan/15 text-rt-cyan',
  },
  cyan: {
    activeBg: 'bg-rt-cyan',
    activeText: 'text-rt-black',
    idleText: 'text-rt-ice/80',
    idleBg: 'hover:bg-rt-panel',
    border: 'border-l-rt-cyan',
    chip: 'bg-rt-cyan/15 text-rt-cyan',
  },
  violet: {
    activeBg: 'bg-rt-purple',
    activeText: 'text-rt-black',
    idleText: 'text-rt-ice/80',
    idleBg: 'hover:bg-rt-panel',
    border: 'border-l-rt-purple',
    chip: 'bg-rt-purple/15 text-rt-purple',
  },
  lime: {
    activeBg: 'bg-rt-green',
    activeText: 'text-rt-black',
    idleText: 'text-rt-ice/80',
    idleBg: 'hover:bg-rt-panel',
    border: 'border-l-rt-green',
    chip: 'bg-rt-green/15 text-rt-green',
  },
};

export type AgentNavKey =
  | 'pm'
  | 'synergy'
  | 'clinic'
  | 'builder'
  | 'canon'
  | 'forge'
  | 'kitt'
  | 'eddie'
  | 'bubs';

export type AgentEntry = {
  name: string;
  workflow: string;
  starter: string;
  accent: string;
  extras?: boolean;
};

export const agentMeta: Record<AgentNavKey, AgentEntry> = {
  pm: {
    name: 'HAL9000',
    workflow: 'breakdown',
    starter: 'Paste meeting notes, client asks, risks, or messy project context...',
    accent: 'fuchsia',
  },
  synergy: {
    name: 'Synergy',
    workflow: 'breakdown',
    starter:
      'Paste lyrics, collections, personal project notes, or creative material to organize (not clinical or therapy).',
    accent: 'rose',
  },
  clinic: {
    name: 'H.E.L.P.eR',
    workflow: 'breakdown',
    starter:
      'Paste visit summaries, lab or imaging report text, medication lists, or notes to organize. Upload PDFs/DOCX on the Workspaces page with a clinical document kind. Informational only—not a substitute for licensed care.',
    accent: 'teal',
  },
  builder: {
    name: 'Bot the Builder',
    workflow: 'implementation_plan',
    starter:
      'Describe the feature, repo change, stack, or implementation request. Optionally set repo path below.',
    extras: true,
    accent: 'indigo',
  },
  canon: {
    name: 'Twiki',
    workflow: 'recall',
    starter: 'Ask what has been decided, remembered, contradicted, or reused...',
    accent: 'emerald',
  },
  forge: {
    name: 'The Nerdery',
    workflow: 'opportunity_scan',
    starter: 'Describe a pain point, pattern, or capability to turn into scored ideas...',
    accent: 'amber',
  },
  kitt: {
    name: 'KITT',
    workflow: 'breakdown',
    starter:
      'Paste meeting notes, client asks, risks, or messy project context—same breakdown workflow as HAL9000; KITT uses Gemma by default (not HAL’s Llama).',
    accent: 'cyan',
  },
  eddie: {
    name: 'Eddie',
    workflow: 'opportunity_scan',
    starter: 'Describe a pain point or pattern for scored opportunities and next steps...',
    accent: 'violet',
  },
  bubs: {
    name: 'Bubs',
    workflow: 'breakdown',
    starter: 'Paste personal or creative material to organize lightly—personal projects only.',
    accent: 'lime',
  },
};

export function isAgentCatalogDisabled(ui: unknown): boolean {
  return Boolean(ui && typeof ui === 'object' && (ui as Record<string, unknown>).disabled === true);
}

const NAV_FALLBACK_ORDER: AgentNavKey[] = [
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

function orderFromCatalogRow(row: { key: string; ui?: unknown }, key: string): number {
  const u = row.ui;
  if (u && typeof u === 'object' && typeof (u as { order?: number }).order === 'number') {
    return (u as { order: number }).order;
  }
  const i = NAV_FALLBACK_ORDER.indexOf(key as AgentNavKey);
  return i >= 0 ? i : 99;
}

export function enabledAgentNavKeysFromCatalog(rows: { key: string; ui?: unknown | null }[]): AgentNavKey[] {
  const allowed = new Set<string>(Object.keys(agentMeta));
  const filtered = rows.filter((r) => allowed.has(r.key) && !isAgentCatalogDisabled(r.ui));
  filtered.sort((a, b) => orderFromCatalogRow(a, a.key) - orderFromCatalogRow(b, b.key));
  return filtered.map((r) => r.key as AgentNavKey);
}

export const headerBadge: Record<AgentNavKey, { label: string; badgeClassName: string }> = {
  pm: { label: 'HAL9000', badgeClassName: 'bg-rt-cyan' },
  synergy: { label: 'Synergy', badgeClassName: 'bg-rt-orange' },
  clinic: { label: 'H.E.L.P.eR', badgeClassName: 'bg-rt-green' },
  builder: { label: 'Build', badgeClassName: 'bg-rt-purple' },
  canon: { label: 'Twiki', badgeClassName: 'bg-rt-green' },
  forge: { label: 'Forge', badgeClassName: 'bg-rt-yellow' },
  kitt: { label: 'KITT', badgeClassName: 'bg-rt-cyan' },
  eddie: { label: 'Eddie', badgeClassName: 'bg-rt-purple' },
  bubs: { label: 'Bubs', badgeClassName: 'bg-rt-green' },
};

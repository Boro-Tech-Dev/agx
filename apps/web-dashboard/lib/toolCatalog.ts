/**
 * Static copy and routing for Tools hub catalog (ten primary tools).
 */

export type ToolCatalogId =
  | 'ask_clarifier'
  | 'brief_generator'
  | 'launchpad'
  | 'learning'
  | 'omnichannel'
  | 'reply_coach'
  | 'scenario'
  | 'veeva_suite'
  | 'web_capture'
  | 'web_search';

export type ToolPanelTab = 'use' | 'how' | 'team';

export type ToolCatalogMeta = {
  categoryLabel: string;
  scopeLabel: string;
  outputKind: string;
  navLabel: string;
  requiresCadence?: boolean;
};

export type ToolCatalogEntry = ToolCatalogMeta & {
  /** Stable kebab-case id (display via `humanizeToolLabel`). */
  slug: string;
  summary: string;
};

const CATALOG_ORDER: ToolCatalogId[] = [
  'ask_clarifier',
  'brief_generator',
  'launchpad',
  'learning',
  'omnichannel',
  'reply_coach',
  'scenario',
  'veeva_suite',
  'web_capture',
  'web_search',
];

/** e.g. `omnichannel_plan`, `brief-generator` → "Omnichannel Plan", "Brief Generator". */
export function humanizeToolLabel(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return '';
  return trimmed
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
}

const ENTRIES: Record<ToolCatalogId, ToolCatalogEntry> = {
  ask_clarifier: {
    slug: 'ask-clarifier',
    categoryLabel: 'Intake guard',
    scopeLabel: 'Request / feedback',
    outputKind: 'clarification_plan',
    navLabel: 'Ask Clarifier',
    summary:
      'Turn vague client asks, messy feedback, rush requests, and internal handoffs into crisp clarifying questions, hidden assumptions, risk flags, recommended next steps, and a ready-to-send PM or Account response.',
  },
  brief_generator: {
    slug: 'brief-generator',
    categoryLabel: 'Briefing',
    scopeLabel: 'Project',
    outputKind: 'brief',
    navLabel: 'Brief Generator',
    summary:
      'Draft structured creative briefs from a shared section skeleton keyed to tactics library types, optional seeded presets (email, social, decks), Markdown preview, LLM auto-fill from pasted prose via model-router, and save JSON artifacts as project documents (kind brief).',
  },
  launchpad: {
    slug: 'launchpad',
    categoryLabel: 'Launch readiness',
    scopeLabel: 'Project',
    outputKind: 'launch_readiness',
    navLabel: 'Launchpad',
    summary:
      'Launch Control for approvals, asset packages, QA, tracking, vendor handoff, deployment readiness, and post-launch proof. Build a launch asset matrix, score readiness, flag blockers, inspect ZIP/file inventories, and generate internal/client/vendor status copy.',
  },
  learning: {
    slug: 'learning',
    categoryLabel: 'Onboarding',
    scopeLabel: 'Agency role & brand',
    outputKind: 'learning_progress',
    navLabel: 'Learning',
    summary:
      'Guided pharma literacy, role playbooks for Account and Project Management, and optional brand-specific training on personal sandbox projects — with saved progress, mission validation, and manager reporting.',
  },
  omnichannel: {
    slug: 'omnichannel-planner',
    categoryLabel: 'Planning mix',
    scopeLabel: 'Project',
    outputKind: 'omnichannel_plan',
    navLabel: 'Omnichannel',
    requiresCadence: true,
    summary:
      'Compose an ordered cross-channel tactic mix from the shared tactics library, tie rows to scenario timing, and persist the plan as versioned project JSON. Use it when you want a durable omnichannel blueprint before or alongside linear schedule work.',
  },
  reply_coach: {
    slug: 'reply-coach',
    categoryLabel: 'Client comms',
    scopeLabel: 'Message / response',
    outputKind: 'reply_strategy',
    navLabel: 'Reply Coach',
    summary:
      'Draft client, internal, or vendor replies that stay helpful while protecting scope, timing, approvals, and team commitments. Routes through Bubs using tinyllama:1.1b.',
  },
  scenario: {
    slug: 'scenario-planner',
    categoryLabel: 'Scheduling',
    scopeLabel: 'Project',
    outputKind: 'scenario',
    navLabel: 'Scenario',
    requiresCadence: true,
    summary:
      'Compute a delivery scenario schedule from kickoff or needed-by constraints, preview phases and milestones, and optionally save results as project documents. Schedule math runs on the scenario worker (business days, holidays, and tactic-specific PRB rules where configured).',
  },
  veeva_suite: {
    slug: 'veeva-suite',
    categoryLabel: 'Veeva acceleration',
    scopeLabel: 'RTE / CLM ZIP',
    outputKind: 'preview_package',
    navLabel: 'Veeva Suite',
    summary:
      'Veeva acceleration suite for RTE and CLM ZIPs: preview packages, map fragments and CLM navigation, compare screenshots, inspect links/assets/tokens/Veeva API calls, score suite readiness, generate vendor QA checks, and export client-safe status or handoff reports. Does not replace Veeva validation or MLR.',
  },
  web_capture: {
    slug: 'web-capture',
    categoryLabel: 'Capture',
    scopeLabel: 'Browser',
    outputKind: 'general',
    navLabel: 'Web Capture',
    summary:
      'Fidelity-first site capture: full-render screenshots (high-DPI capable), article-quality text extraction after browser render (optional fast HTML-only fetch), and a paced same-site crawl that builds index-style JSON with excerpts, headings, and capped full article text for downstream agents. URLs are validated server-side with private networks blocked; saves to project documents.',
  },
  web_search: {
    slug: 'web-search',
    categoryLabel: 'Research',
    scopeLabel: 'Metasearch',
    outputKind: 'search_results',
    navLabel: 'Web Search',
    summary:
      'Private SearXNG metasearch: query the web from your stack, review ranked snippets with URLs, save hits to project memory, or open Extract/Crawl on a result. Tool-capable agents (Forge, Canon, PM, Builder) can also invoke search autonomously when use_tools is enabled.',
  },
};

const SLUG_TO_ID: Record<string, ToolCatalogId> = Object.fromEntries(
  CATALOG_ORDER.map((id) => [ENTRIES[id].slug, id]),
) as Record<string, ToolCatalogId>;

export function getToolCatalogEntry(id: ToolCatalogId): ToolCatalogEntry {
  return ENTRIES[id];
}

export function toolCatalogList(): { id: ToolCatalogId; entry: ToolCatalogEntry }[] {
  return CATALOG_ORDER.map((id) => ({ id, entry: ENTRIES[id] }));
}

export function toolIdFromSlug(slug: string): ToolCatalogId | null {
  return SLUG_TO_ID[slug] ?? null;
}

export function toolRouteHref(id: ToolCatalogId, tab?: ToolPanelTab): string {
  const base = `/tools/${ENTRIES[id].slug}`;
  if (tab === 'how') return `${base}?tab=how`;
  if (tab === 'team') return `${base}?tab=team`;
  if (tab === 'use') return `${base}?tab=use`;
  return base;
}

export function toolMonogram(id: ToolCatalogId): string {
  const slug = ENTRIES[id].slug;
  const parts = slug.split('-').filter(Boolean);
  if (parts.length >= 2) {
    return (parts[0].charAt(0) + parts[1].charAt(0)).toUpperCase();
  }
  return slug.slice(0, 2).toUpperCase();
}

/** Accent palette per tool (parallel to modelFamilyClasses). */
export function toolAccentClasses(id: ToolCatalogId): { ring: string; chip: string; glow: string } {
  switch (id) {
    case 'ask_clarifier':
      return {
        ring: 'ring-fuchsia-500/25 hover:ring-fuchsia-500/40',
        chip: 'bg-fuchsia-100 text-fuchsia-800 dark:bg-fuchsia-500/15 dark:text-fuchsia-200',
        glow: 'from-fuchsia-500/10',
      };
    case 'reply_coach':
      return {
        ring: 'ring-lime-500/25 hover:ring-lime-500/40',
        chip: 'bg-lime-100 text-lime-800 dark:bg-lime-500/15 dark:text-lime-200',
        glow: 'from-lime-500/10',
      };
    case 'omnichannel':
      return {
        ring: 'ring-sky-500/25 hover:ring-sky-500/40',
        chip: 'bg-sky-100 text-sky-800 dark:bg-sky-500/15 dark:text-sky-200',
        glow: 'from-sky-500/10',
      };
    case 'scenario':
      return {
        ring: 'ring-rose-500/25 hover:ring-rose-500/40',
        chip: 'bg-rose-100 text-rose-800 dark:bg-rose-500/15 dark:text-rose-200',
        glow: 'from-rose-500/10',
      };
    case 'brief_generator':
      return {
        ring: 'ring-amber-500/25 hover:ring-amber-500/40',
        chip: 'bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-200',
        glow: 'from-amber-500/10',
      };
    case 'web_capture':
      return {
        ring: 'ring-violet-500/25 hover:ring-violet-500/40',
        chip: 'bg-violet-100 text-violet-800 dark:bg-violet-500/15 dark:text-violet-200',
        glow: 'from-violet-500/10',
      };
    case 'web_search':
      return {
        ring: 'ring-teal-500/25 hover:ring-teal-500/40',
        chip: 'bg-teal-100 text-teal-800 dark:bg-teal-500/15 dark:text-teal-200',
        glow: 'from-teal-500/10',
      };
    case 'veeva_suite':
      return {
        ring: 'ring-cyan-500/25 hover:ring-cyan-500/40',
        chip: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-500/15 dark:text-cyan-200',
        glow: 'from-cyan-500/10',
      };
    case 'launchpad':
      return {
        ring: 'ring-indigo-500/25 hover:ring-indigo-500/40',
        chip: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-500/15 dark:text-indigo-200',
        glow: 'from-indigo-500/10',
      };
    case 'learning':
      return {
        ring: 'ring-teal-500/25 hover:ring-teal-500/40',
        chip: 'bg-teal-100 text-teal-800 dark:bg-teal-500/15 dark:text-teal-200',
        glow: 'from-teal-500/10',
      };
  }
}

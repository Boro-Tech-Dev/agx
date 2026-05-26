import {
  PRIMARY_TOOL_NAV_SIDEBAR_GROUPS,
  SIDEBAR_OPERATIONS_GROUP_INDEX,
  showBriefOpsNav,
  type DashboardToolKey,
} from '../navConfig';
import { toolCatalogList, toolRouteHref } from '../toolCatalog';

export const EDUCATION_OPENING =
  'RagTag is an operator desk for teams who need capable AI assistance while keeping work inside their own environment. It brings together local models, shared project context, and focused applications so planning, production, and review can happen in one coherent place.';

export const EDUCATION_RAG = {
  title: 'RAG — retrieval before generation',
  body: 'Retrieval-Augmented Generation means the system consults your organization’s own materials—briefs, captures, notes, and other stored context—before it composes a reply. Answers are grounded in what you have already approved and filed, not only in a model’s general training.',
};

export const EDUCATION_TAG = {
  title: 'TAG — a coordinated specialist grid',
  body: 'The “Tag” in RagTag is a multi-agent operation grid: a set of distinct workers, each designed for a particular kind of job—planning, clinical review, content assembly, and more. You select the specialist that fits the moment; they share the same project rails and pass work through the same queues and records.',
};

export type HomeToolEducation = {
  id: string;
  label: string;
  href: string;
  summary: string;
};

/** Plain-language tool blurbs for the home overview (sidebar catalog tools). */
const TOOL_SUMMARIES: Record<string, string> = {
  brief_generator:
    'Shape creative briefs from a consistent section framework, optional starting templates, and assisted drafting from pasted source material. Finished briefs save as project documents your team can revisit.',
  launchpad:
    'Manage launch readiness in one view: approvals, asset packages, quality checks, tracking setup, vendor handoff, and deployment status. See what is complete, what is blocked, and what still needs attention before go-live.',
  learning:
    'Guided pharma literacy, role playbooks for Account and Project Management, and optional brand training on personal sandbox projects — with saved progress and mission validation.',
  omnichannel:
    'Lay out an ordered cross-channel plan drawn from your tactics library, aligned to scenario timing when you use it. The result is a durable blueprint for how channels work together across the program.',
  scenario:
    'Build delivery schedules from kickoff or “needed by” dates, preview phases and milestones, and save the scenario as a project record. Scheduling respects business-day rules and program-specific constraints where configured.',
  veeva_suite:
    'Accelerate review of RTE and CLM packages: previews, fragment mapping, asset and link inspection, readiness scoring, and client-safe status reports. This supports your Veeva workflow; it does not replace platform validation or medical–legal review.',
  web_capture:
    'Capture public web pages with browser-quality rendering and clean article text for later use. Crawl related pages on the same site when you need a structured index, with safeguards on which URLs may be requested.',
};

export function homeToolEducationList(): HomeToolEducation[] {
  return toolCatalogList().map(({ id, entry }) => ({
    id,
    label: entry.navLabel,
    href: toolRouteHref(id),
    summary: TOOL_SUMMARIES[id] ?? entry.summary,
  }));
}

/** Plain-language blurbs for sidebar Operations destinations. */
const OPERATIONS_SUMMARIES: Partial<Record<DashboardToolKey, string>> = {
  workspaces:
    'Your program command center—workspaces, projects, timelines, tasks, and risks. Agents and tools run in the scope of the project you select here.',
  reports:
    'A portfolio view across projects of signals from agent runs: anomalies, risks, and cost patterns. Use it to spot themes before opening a single workspace.',
  monitoring:
    'Live health of background queues and workers—what is waiting, in progress, or failed—plus model usage totals. Open this when work seems stuck or you need to confirm the platform is processing.',
  memory:
    'The searchable knowledge store: notes, ingested documents, and context the system consults before it answers. Browse, search, or add material that should inform future work.',
  artifacts:
    'Files and structured outputs from agents and tools—plans, briefs, exports—with download links and history in one place.',
  approvals:
    'A human review queue for high-impact steps requested during runs. Approve or decline before the platform carries the action forward.',
  governance:
    'How this platform handles access, data retention, local inference, audit trails, and related operational policies—as implemented today, for operators and leadership reviewing rollout.',
  brief_ops:
    'Administrative workspace for the brief template library: edit section skeletons and presets, publish versions, and connect ready documents to brief autofill.',
  contributors: 'Recognition of colleagues who helped build and shape the platform.',
};

export function homeOperationsEducationList(): HomeToolEducation[] {
  const group = PRIMARY_TOOL_NAV_SIDEBAR_GROUPS[SIDEBAR_OPERATIONS_GROUP_INDEX];
  const visible = showBriefOpsNav() ? group : group.filter((x) => x.id !== 'brief_ops');
  return visible.map(({ id, href, label }) => ({
    id,
    label,
    href,
    summary: OPERATIONS_SUMMARIES[id] ?? '',
  }));
}

import {
  CATEGORY_LABELS,
  type LaunchpadAsset,
  type LaunchpadCategory,
  type LaunchpadChecklistItem,
  type LaunchpadFinding,
  type LaunchpadGate,
  type LaunchpadLaunch,
  type LaunchpadSeverity,
  type LaunchpadSummary,
  type LaunchpadStatus,
} from './types';
import { checklistForChannel } from './templates';

const CATEGORIES: LaunchpadCategory[] = [
  'approval',
  'assets',
  'qa',
  'tracking',
  'vendor',
  'deployment',
  'documentation',
  'post_launch',
];

export function newId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function nowIso(): string {
  return new Date().toISOString();
}

export function createLaunch(seed?: Partial<LaunchpadLaunch>): LaunchpadLaunch {
  const stamp = nowIso();
  return {
    id: newId('launch'),
    name: seed?.name || 'New launch',
    brand: seed?.brand || '',
    client: seed?.client || '',
    owner: seed?.owner || '',
    targetLaunchDate: seed?.targetLaunchDate || '',
    statusNote: seed?.statusNote || '',
    assets: seed?.assets || [],
    findings: seed?.findings || [],
    createdAt: stamp,
    updatedAt: stamp,
  };
}

export function createAsset(input: Partial<LaunchpadAsset> & Pick<LaunchpadAsset, 'name' | 'channel'>): LaunchpadAsset {
  const stamp = nowIso();
  return {
    id: newId('asset'),
    name: input.name,
    channel: input.channel,
    audience: input.audience || '',
    version: input.version || '',
    owner: input.owner || '',
    vendor: input.vendor || '',
    launchDate: input.launchDate || '',
    checklist: input.checklist || checklistForChannel(input.channel),
    fileFindings: input.fileFindings || [],
    fileNames: input.fileNames || [],
    createdAt: stamp,
    updatedAt: stamp,
  };
}

function itemFinding(asset: LaunchpadAsset, item: LaunchpadChecklistItem): LaunchpadFinding | null {
  if (!item.required || item.status === 'complete' || item.status === 'not_applicable') return null;
  const severity = item.status === 'blocked' ? 'blocker' : item.severityIfMissing;
  return {
    id: `finding_${asset.id}_${item.id}`,
    assetId: asset.id,
    category: item.category,
    severity,
    title: `${asset.name}: ${item.label}`,
    detail:
      item.status === 'blocked'
        ? `This launch requirement is explicitly blocked. ${item.notes || item.description || ''}`.trim()
        : `This required ${CATEGORY_LABELS[item.category].toLowerCase()} item is not complete yet. ${item.description || ''}`.trim(),
    recommendedAction: item.owner
      ? `Follow up with ${item.owner} and resolve: ${item.label}.`
      : `Assign an owner and resolve: ${item.label}.`,
  };
}

export function findingsForLaunch(launch: LaunchpadLaunch): LaunchpadFinding[] {
  const generated = launch.assets.flatMap((asset) => asset.checklist.map((x) => itemFinding(asset, x)).filter(Boolean) as LaunchpadFinding[]);
  const fileFindings = launch.assets.flatMap((asset) => asset.fileFindings.map((f) => ({ ...f, assetId: f.assetId || asset.id })));
  return [...generated, ...fileFindings, ...(launch.findings || [])];
}

function gateFrom(blockers: number, warnings: number, total: number, completed: number): LaunchpadGate {
  if (blockers > 0) return 'blocked';
  if (total === 0 || completed === 0) return 'not_started';
  if (warnings > 0 || completed < total) return 'yellow';
  return 'ready';
}

function severityRank(sev: LaunchpadSeverity): number {
  if (sev === 'blocker') return 3;
  if (sev === 'warning') return 2;
  return 1;
}

function statusWeight(status: LaunchpadStatus): number {
  switch (status) {
    case 'complete':
    case 'not_applicable':
      return 1;
    case 'in_progress':
      return 0.5;
    default:
      return 0;
  }
}

function assetIsReady(asset: LaunchpadAsset): boolean {
  const assetFindings = asset.checklist.map((x) => itemFinding(asset, x)).filter(Boolean) as LaunchpadFinding[];
  const blockers = [...assetFindings, ...asset.fileFindings].filter((f) => f.severity === 'blocker');
  return blockers.length === 0 && asset.checklist.filter((x) => x.required).every((x) => x.status === 'complete' || x.status === 'not_applicable');
}

export function summarizeLaunch(launch: LaunchpadLaunch): LaunchpadSummary {
  const allItems = launch.assets.flatMap((a) => a.checklist.filter((x) => x.required));
  const allFindings = findingsForLaunch(launch);
  const blockers = allFindings.filter((f) => f.severity === 'blocker').sort((a, b) => severityRank(b.severity) - severityRank(a.severity));
  const warnings = allFindings.filter((f) => f.severity === 'warning');
  const notes = allFindings.filter((f) => f.severity === 'note');
  const weighted = allItems.reduce((sum, item) => sum + statusWeight(item.status), 0);
  const score = allItems.length ? Math.round((weighted / allItems.length) * 100) : 0;

  const categoryScores = CATEGORIES.map((category) => {
    const items = allItems.filter((x) => x.category === category);
    const catFindings = allFindings.filter((f) => f.category === category);
    const completed = items.filter((x) => x.status === 'complete' || x.status === 'not_applicable').length;
    const catBlockers = catFindings.filter((f) => f.severity === 'blocker').length;
    const catWarnings = catFindings.filter((f) => f.severity === 'warning').length;
    return {
      category,
      completed,
      total: items.length,
      score: items.length ? Math.round((items.reduce((s, x) => s + statusWeight(x.status), 0) / items.length) * 100) : null,
      blockers: catBlockers,
      warnings: catWarnings,
      gate: gateFrom(catBlockers, catWarnings, items.length, completed),
    };
  });

  const gate = gateFrom(blockers.length, warnings.length, allItems.length, allItems.filter((x) => x.status === 'complete' || x.status === 'not_applicable').length);
  const readyAssets = launch.assets.filter(assetIsReady).length;
  const nextActions = blockers.concat(warnings).slice(0, 5).map((f) => f.recommendedAction || f.detail);
  const displayName = launch.name || 'This launch';
  const blockerPhrase = blockers.length ? `${blockers.length} blocker${blockers.length === 1 ? '' : 's'}` : 'no blockers';
  const warningPhrase = warnings.length ? `${warnings.length} warning${warnings.length === 1 ? '' : 's'}` : 'no warnings';
  const topIssue = blockers[0] || warnings[0] || null;

  return {
    score,
    gate,
    blockers,
    warnings,
    notes,
    categoryScores,
    readyAssets,
    totalAssets: launch.assets.length,
    nextActions,
    internalSummary: `${displayName} is ${score}% launch-ready with ${blockerPhrase} and ${warningPhrase}. ${topIssue ? `Most urgent item: ${topIssue.title}. ${topIssue.recommendedAction || ''}` : 'No critical launch issues are currently flagged.'}`.trim(),
    clientSummary:
      gate === 'blocked'
        ? `${displayName} is progressing toward launch, with final readiness checks in motion. The team is resolving open launch dependencies before vendor release and will confirm once the package is ready to proceed.`
        : gate === 'ready'
          ? `${displayName} is ready for launch based on current approvals, package readiness, QA, tracking, and deployment checks.`
          : `${displayName} is progressing toward the planned launch date. Core readiness checks are underway, with the team completing final QA, tracking, documentation, and handoff confirmations.`,
    vendorSummary: `${displayName} launch package status: ${readyAssets}/${launch.assets.length} assets currently ready. ${blockers.length ? `Do not release until these blockers are resolved: ${blockers.slice(0, 3).map((b) => b.title).join('; ')}.` : 'No release-blocking issues are currently flagged.'}`,
  };
}

export function exportLaunchCsv(launch: LaunchpadLaunch): string {
  const rows = [['Launch', 'Asset', 'Channel', 'Category', 'Checklist Item', 'Status', 'Required', 'Owner', 'Due Date', 'Evidence', 'Notes']];
  for (const asset of launch.assets) {
    for (const item of asset.checklist) {
      rows.push([
        launch.name,
        asset.name,
        asset.channel,
        CATEGORY_LABELS[item.category],
        item.label,
        item.status,
        item.required ? 'Yes' : 'No',
        item.owner || '',
        item.dueDate || '',
        item.evidence || '',
        item.notes || '',
      ]);
    }
  }
  return rows.map((r) => r.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n');
}

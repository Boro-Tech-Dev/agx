import type { VeevaSuiteInventoryItem, VeevaSuiteResponse, VeevaSuiteUnit, VeevaSuiteWarning } from '../api';

export type Severity = 'ok' | 'note' | 'warning' | 'blocker';

export type SuiteFinding = {
  id: string;
  area: 'preview' | 'fragments' | 'navigation' | 'screenshots' | 'vendor' | 'qa' | 'package';
  severity: Severity;
  title: string;
  detail: string;
  unitName?: string;
  nextAction?: string;
};

export type UnitInventorySummary = {
  unit: VeevaSuiteUnit;
  links: VeevaSuiteInventoryItem[];
  images: VeevaSuiteInventoryItem[];
  tokens: VeevaSuiteInventoryItem[];
  scripts: VeevaSuiteInventoryItem[];
  veevaApi: VeevaSuiteInventoryItem[];
  warnings: VeevaSuiteInventoryItem[];
};

export type NavigationNode = {
  name: string;
  outgoing: string[];
  incoming: string[];
};

export type VendorReadinessItem = {
  id: string;
  label: string;
  status: 'ready' | 'check' | 'missing' | 'not_applicable';
  detail: string;
};

export type VeevaSuiteAnalysis = {
  packageLabel: string;
  totalUnits: number;
  blockerCount: number;
  warningCount: number;
  noteCount: number;
  healthScore: number;
  findings: SuiteFinding[];
  fragmentMap: UnitInventorySummary[];
  slideMap: UnitInventorySummary[];
  navigationNodes: NavigationNode[];
  orphanSlides: string[];
  deadEndSlides: string[];
  vendorReadiness: VendorReadinessItem[];
  vendorPackageScore: number;
  clientSafeSummary: string;
  internalSummary: string;
  vendorHandoffDraft: string;
};

function unique(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean)));
}

function severityFromWorkerWarning(w: VeevaSuiteWarning): Severity {
  if (w.severity === 'error') return 'blocker';
  if (w.severity === 'warning') return 'warning';
  return 'note';
}

function findingWeight(severity: Severity): number {
  if (severity === 'blocker') return 18;
  if (severity === 'warning') return 7;
  if (severity === 'note') return 2;
  return 0;
}

function slug(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 90) || 'finding';
}

function makeFindingPusher(findings: SuiteFinding[]) {
  const counts = new Map<string, number>();
  return (finding: Omit<SuiteFinding, 'id'> & { id?: string }) => {
    const base = slug(finding.id || `${finding.area}-${finding.severity}-${finding.unitName ?? ''}-${finding.title}-${finding.detail}`);
    const seen = counts.get(base) ?? 0;
    counts.set(base, seen + 1);
    findings.push({ ...finding, id: seen ? `${base}-${seen + 1}` : base });
  };
}

function unitInventory(result: VeevaSuiteResponse, unit: VeevaSuiteUnit): UnitInventorySummary {
  const byUnit = result.inventory.filter((item) => item.unitName === unit.name);
  return {
    unit,
    links: byUnit.filter((item) => item.type === 'link'),
    images: byUnit.filter((item) => item.type === 'image'),
    tokens: byUnit.filter((item) => item.type === 'token'),
    scripts: byUnit.filter((item) => item.type === 'script'),
    veevaApi: byUnit.filter((item) => item.type === 'veeva-api'),
    warnings: byUnit.filter((item) => item.status === 'warning' || item.status === 'error'),
  };
}

function buildNavigationNodes(result: VeevaSuiteResponse): NavigationNode[] {
  const slideNames = result.slides.map((slide) => slide.name);
  const names = unique([...slideNames, ...result.navigation.map((edge) => edge.from), ...result.navigation.map((edge) => edge.to)]);
  return names.map((name) => ({
    name,
    outgoing: unique(result.navigation.filter((edge) => edge.from === name).map((edge) => edge.to)),
    incoming: unique(result.navigation.filter((edge) => edge.to === name).map((edge) => edge.from)),
  }));
}

function packageLabel(result: VeevaSuiteResponse): string {
  if (result.packageType === 'rte') return 'RTE Approved Email package';
  if (result.packageType === 'clm') return 'CLM presentation package';
  return 'Veeva package';
}

function vendorStatus(status: VendorReadinessItem['status']): number {
  if (status === 'ready' || status === 'not_applicable') return 1;
  if (status === 'check') return 0.55;
  return 0;
}

function makeVendorReadiness(result: VeevaSuiteResponse, findings: SuiteFinding[]): VendorReadinessItem[] {
  const screenshots = result.screenshots ?? { fragments: [], slides: [] };
  const hasScreenshots = Boolean(screenshots.fullPage || screenshots.viewport600 || screenshots.fragments?.length || screenshots.slides?.length);
  const hasLinks = result.inventory.some((item) => item.type === 'link');
  const hasTokenWarnings = result.inventory.some((item) => item.type === 'token' && item.status !== 'ok');
  const hasErrors = findings.some((finding) => finding.severity === 'blocker');
  const hasVeevaApi = result.inventory.some((item) => item.type === 'veeva-api');

  return [
    {
      id: 'package-output',
      label: 'Generated preview package ZIP',
      status: result.downloadUrl ? 'ready' : 'missing',
      detail: result.downloadUrl ? 'Preview ZIP is available for project attachment or vendor handoff.' : 'No downloadable preview package was returned.',
    },
    {
      id: 'screenshots',
      label: 'Screenshot evidence',
      status: hasScreenshots ? 'ready' : 'check',
      detail: hasScreenshots ? 'Screenshot/PDF evidence is present in the output.' : 'Run with screenshots enabled before final package QA or client proofing.',
    },
    {
      id: 'links',
      label: 'Link inventory',
      status: hasLinks ? 'check' : 'not_applicable',
      detail: hasLinks ? 'Links were detected. Confirm CTAs, Veeva actions, tracked URLs, and environment-specific behavior before vendor release.' : 'No links were detected in the package inventory.',
    },
    {
      id: 'tokens',
      label: 'Merge token handling',
      status: hasTokenWarnings ? 'check' : 'ready',
      detail: hasTokenWarnings ? 'Unmapped or visible merge tokens may need mock values or validation.' : 'No visible token warnings detected from the generated preview.',
    },
    {
      id: 'veeva-api',
      label: 'Veeva API / navigation calls',
      status: hasVeevaApi || result.packageType === 'clm' ? 'check' : 'not_applicable',
      detail: hasVeevaApi ? 'Veeva API calls were detected. Confirm behavior in the target Veeva environment.' : result.packageType === 'clm' ? 'No explicit Veeva API calls detected. Confirm CLM navigation behavior still matches package expectations.' : 'Not applicable for this package.',
    },
    {
      id: 'blockers',
      label: 'Blocking QA findings',
      status: hasErrors ? 'missing' : 'ready',
      detail: hasErrors ? 'One or more blockers should be resolved before release.' : 'No blocking findings were generated by the suite analysis.',
    },
  ];
}

export function analyzeVeevaSuite(result: VeevaSuiteResponse): VeevaSuiteAnalysis {
  const findings: SuiteFinding[] = [];
  const pushFinding = makeFindingPusher(findings);
  const screenshots = result.screenshots ?? { fragments: [], slides: [] };
  const totalUnits = result.fragmentCount + result.slideCount;

  if (result.packageType === 'unknown') {
    pushFinding({
      area: 'preview',
      severity: 'blocker',
      title: 'Package type could not be classified',
      detail: 'The worker could not confidently classify this ZIP as RTE or CLM.',
      nextAction: 'Confirm the ZIP structure and make sure it contains expected HTML files and assets.',
    });
  }

  if (totalUnits === 0) {
    pushFinding({
      area: 'package',
      severity: 'blocker',
      title: 'No reviewable units found',
      detail: 'No fragments or slides were returned from the package.',
      nextAction: 'Check whether the ZIP has the correct root folder and HTML package contents.',
    });
  }

  for (const warning of result.warnings) {
    pushFinding({
      area: warning.code.toLowerCase().includes('nav') ? 'navigation' : 'qa',
      severity: severityFromWorkerWarning(warning),
      title: warning.code.replace(/[_-]+/g, ' '),
      detail: warning.message,
      unitName: warning.source,
      nextAction: warning.severity === 'error' ? 'Resolve before release or document why the issue is accepted.' : 'Review and document disposition.',
    });
  }

  const inventoryWarnings = result.inventory.filter((item) => item.status === 'warning' || item.status === 'error');
  for (const item of inventoryWarnings.slice(0, 30)) {
    pushFinding({
      area: item.type === 'link' ? 'qa' : item.type === 'image' ? 'package' : 'preview',
      severity: item.status === 'error' ? 'blocker' : 'warning',
      title: `${item.type} needs review`,
      detail: item.message || item.value,
      unitName: item.unitName,
      nextAction: item.type === 'link' ? 'Confirm destination, tracking, and Veeva behavior.' : 'Validate package contents and final asset references.',
    });
  }

  const fragmentMap = result.fragments.map((unit) => unitInventory(result, unit));
  const slideMap = result.slides.map((unit) => unitInventory(result, unit));

  if (result.packageType === 'rte' && result.fragmentCount === 0) {
    pushFinding({
      area: 'fragments',
      severity: 'warning',
      title: 'No RTE fragments detected',
      detail: 'The package was classified as RTE but no separate fragment files were returned.',
      nextAction: 'Confirm whether this is a shell-only email or whether fragments are missing from the ZIP.',
    });
  }

  const navigationNodes = buildNavigationNodes(result);
  const firstSlideName = result.slides[0]?.name;
  const orphanSlides = result.packageType === 'clm'
    ? navigationNodes
        .filter((node) => node.name !== firstSlideName && node.incoming.length === 0)
        .map((node) => node.name)
    : [];
  const deadEndSlides = result.packageType === 'clm'
    ? navigationNodes
        .filter((node) => node.outgoing.length === 0 && navigationNodes.length > 1)
        .map((node) => node.name)
    : [];

  for (const slideName of orphanSlides) {
    pushFinding({
      area: 'navigation',
      severity: 'warning',
      title: 'Slide has no detected inbound path',
      detail: `${slideName} has no detected inbound navigation edge. This may be intentional for hidden/support slides, but it should be confirmed.`,
      unitName: slideName,
      nextAction: 'Confirm the slide is reachable or intentionally hidden.',
    });
  }

  for (const slideName of deadEndSlides) {
    pushFinding({
      area: 'navigation',
      severity: 'warning',
      title: 'Slide has no detected outbound path',
      detail: `${slideName} has no detected outbound navigation edge. Confirm the rep has a clear next/return path.`,
      unitName: slideName,
      nextAction: 'Check tap targets, overlays, and return navigation.',
    });
  }

  if (!screenshots.fullPage && !screenshots.viewport600 && screenshots.fragments.length === 0 && screenshots.slides.length === 0) {
    pushFinding({
      area: 'screenshots',
      severity: 'note',
      title: 'Screenshots were not generated',
      detail: 'Screenshot evidence is optional, but recommended before final vendor handoff or client proofing.',
      nextAction: 'Rebuild with screenshots enabled for full Veeva Suite QA evidence.',
    });
  }

  const vendorReadiness = makeVendorReadiness(result, findings);
  const vendorPackageScore = Math.round((vendorReadiness.reduce((sum, item) => sum + vendorStatus(item.status), 0) / vendorReadiness.length) * 100);
  const blockerCount = findings.filter((finding) => finding.severity === 'blocker').length;
  const warningCount = findings.filter((finding) => finding.severity === 'warning').length;
  const noteCount = findings.filter((finding) => finding.severity === 'note').length;
  const healthScore = Math.max(0, Math.min(100, 100 - findings.reduce((sum, finding) => sum + findingWeight(finding.severity), 0)));
  const label = packageLabel(result);

  const clientSafeSummary = blockerCount > 0
    ? `${label} preview has been generated and the team is reviewing ${blockerCount} blocking item${blockerCount === 1 ? '' : 's'} before release readiness can be confirmed.`
    : warningCount > 0
      ? `${label} preview has been generated. No blocking issues were detected, and the team is reviewing ${warningCount} QA/watch item${warningCount === 1 ? '' : 's'} before final handoff.`
      : `${label} preview has been generated with no blocking issues detected. The package is ready for final handoff review.`;

  const internalSummary = [
    `${result.sourceName}: ${label}`,
    `${totalUnits} reviewable unit${totalUnits === 1 ? '' : 's'} (${result.fragmentCount} fragments, ${result.slideCount} slides).`,
    `Suite score: ${healthScore}/100. Vendor readiness: ${vendorPackageScore}/100.`,
    `${blockerCount} blockers, ${warningCount} warnings, ${noteCount} notes.`,
  ].join(' ');

  const openItems = findings.filter((f) => f.severity === 'blocker' || f.severity === 'warning');
  const vendorHandoffDraft = [
    `Hi team,`,
    ``,
    `Attached/linked is the Veeva Suite package for ${result.sourceName}.`,
    ``,
    `Package type: ${label}`,
    `Reviewable units: ${totalUnits} (${result.fragmentCount} fragments, ${result.slideCount} slides)`,
    `Suite status: ${blockerCount > 0 ? 'Blocked pending team review' : warningCount > 0 ? 'Ready with QA watch items' : 'Ready for handoff review'}`,
    ``,
    `Please confirm receipt and flag any missing files, environment-specific behavior, or deployment requirements before release.`,
    ``,
    `Open items:`,
    ...(openItems.length ? openItems.slice(0, 8).map((f) => `- ${f.title}: ${f.detail}`) : ['- None identified by the Veeva Suite analysis.']),
  ].filter((line, index, arr) => !(line === '' && arr[index - 1] === '')).join('\n');

  return {
    packageLabel: label,
    totalUnits,
    blockerCount,
    warningCount,
    noteCount,
    healthScore,
    findings,
    fragmentMap,
    slideMap,
    navigationNodes,
    orphanSlides,
    deadEndSlides,
    vendorReadiness,
    vendorPackageScore,
    clientSafeSummary,
    internalSummary,
    vendorHandoffDraft,
  };
}

function markdownCell(value: string): string {
  return value.replace(/\r?\n/g, '<br>').replace(/\|/g, '\\|');
}

export function exportVeevaSuiteMarkdown(result: VeevaSuiteResponse, analysis: VeevaSuiteAnalysis): string {
  const rows = analysis.findings.length
    ? analysis.findings.map((f) => `| ${f.severity} | ${f.area} | ${markdownCell(f.unitName ?? '')} | ${markdownCell(f.title)} | ${markdownCell(f.detail)} |`).join('\n')
    : '| ok | suite |  | No findings | No blockers or warnings detected. |';
  const vendorRows = analysis.vendorReadiness.map((item) => `| ${item.status} | ${markdownCell(item.label)} | ${markdownCell(item.detail)} |`).join('\n');
  return `# Veeva Suite QA Report\n\n` +
    `**Source:** ${result.sourceName}\n\n` +
    `**Package:** ${analysis.packageLabel}\n\n` +
    `**Suite Score:** ${analysis.healthScore}/100\n\n` +
    `**Vendor Readiness:** ${analysis.vendorPackageScore}/100\n\n` +
    `**Units:** ${analysis.totalUnits} (${result.fragmentCount} fragments, ${result.slideCount} slides)\n\n` +
    `## Internal Summary\n\n${analysis.internalSummary}\n\n` +
    `## Client-Safe Summary\n\n${analysis.clientSafeSummary}\n\n` +
    `## Findings\n\n| Severity | Area | Unit | Title | Detail |\n|---|---|---|---|---|\n${rows}\n\n` +
    `## Vendor Package QA\n\n| Status | Check | Detail |\n|---|---|---|\n${vendorRows}\n\n` +
    `## Navigation\n\n${analysis.navigationNodes.length ? analysis.navigationNodes.map((node) => `- **${node.name}** → ${node.outgoing.length ? node.outgoing.join(', ') : 'No detected outgoing paths'}; incoming: ${node.incoming.length ? node.incoming.join(', ') : 'none'}`).join('\n') : 'No navigation edges detected.'}\n\n` +
    `## Vendor Handoff Draft\n\n\`\`\`text\n${analysis.vendorHandoffDraft}\n\`\`\`\n`;
}

import type { LaunchpadCategory, LaunchpadFinding, LaunchpadSeverity } from './types';
import { newId } from './engine';

export type LaunchpadFileInventory = {
  sourceName: string;
  fileNames: string[];
  findings: LaunchpadFinding[];
};

function readUint16(view: DataView, offset: number): number {
  return view.getUint16(offset, true);
}
function readUint32(view: DataView, offset: number): number {
  return view.getUint32(offset, true);
}

async function extractZipFileNames(file: File): Promise<string[]> {
  const buffer = await file.arrayBuffer();
  const view = new DataView(buffer);
  const names: string[] = [];
  for (let offset = 0; offset < view.byteLength - 46; offset += 1) {
    if (readUint32(view, offset) !== 0x02014b50) continue;
    const nameLen = readUint16(view, offset + 28);
    const extraLen = readUint16(view, offset + 30);
    const commentLen = readUint16(view, offset + 32);
    const nameStart = offset + 46;
    const nameEnd = nameStart + nameLen;
    if (nameEnd > view.byteLength) continue;
    const bytes = new Uint8Array(buffer.slice(nameStart, nameEnd));
    names.push(new TextDecoder().decode(bytes));
    offset = nameEnd + extraLen + commentLen - 1;
  }
  return Array.from(new Set(names)).filter(Boolean);
}

function finding(category: LaunchpadCategory, severity: LaunchpadSeverity, title: string, detail: string, recommendedAction?: string, source?: string): LaunchpadFinding {
  return { id: newId('filefinding'), category, severity, title, detail, recommendedAction, source };
}

function analyzeNames(sourceName: string, names: string[]): LaunchpadFinding[] {
  const lower = names.map((x) => x.toLowerCase());
  const hasHtml = lower.some((x) => x.endsWith('.html') || x.endsWith('.htm'));
  const hasImage = lower.some((x) => /\.(png|jpg|jpeg|gif|webp|svg)$/.test(x));
  const hasPdf = lower.some((x) => x.endsWith('.pdf'));
  const hasFinal = lower.some((x) => /(^|[\W_])final([\W_]|$)/i.test(x));
  const hasOld = lower.some((x) => /old|archive|deprecated|do[-_ ]?not[-_ ]?use|superseded/.test(x));
  const hasTk = lower.some((x) => /tk|fpo|placeholder/.test(x));
  const hasFragment = lower.some((x) => /fragment|frag|fr_/.test(x));
  const hasClm = lower.some((x) => /clm|slide|index\.html|veeva/.test(x));
  const hasScreenshot = lower.some((x) => /screenshot|proof|preview/.test(x));
  const findings: LaunchpadFinding[] = [];

  if (!names.length) {
    findings.push(finding('assets', 'warning', 'No ZIP inventory detected', 'The uploaded ZIP did not expose a readable central directory. The package may still be valid, but Launchpad could not inspect the contents.', 'Manually confirm final files, screenshots, and package completeness.', sourceName));
    return findings;
  }
  if (!hasHtml && !hasPdf && !hasImage) {
    findings.push(finding('assets', 'warning', 'No recognizable launch asset files found', 'Package did not contain HTML, PDF, or common image assets.', 'Confirm this is the correct vendor/deployment package.', sourceName));
  }
  if (hasHtml && !hasImage) {
    findings.push(finding('assets', 'warning', 'HTML found without image assets', 'The package contains HTML but no common image asset files.', 'Confirm remote images are intended or add the required local image assets.', sourceName));
  }
  if (hasHtml && !hasScreenshot) {
    findings.push(finding('qa', 'warning', 'No screenshot/proof files detected', 'HTML package appears to lack screenshots or preview proofs.', 'Generate and attach final screenshots before release.', sourceName));
  }
  if (hasOld) {
    findings.push(finding('assets', 'warning', 'Package may include obsolete files', 'Filenames suggest old, archived, deprecated, or do-not-use assets are present.', 'Remove obsolete assets from the release package or document why they are included.', sourceName));
  }
  if (hasTk) {
    findings.push(finding('assets', 'blocker', 'Placeholder/FPO/TK indicator detected', 'One or more filenames suggest placeholder material may still be present.', 'Inspect package contents and replace placeholder material before launch.', sourceName));
  }
  if (!hasFinal) {
    findings.push(finding('documentation', 'note', 'No FINAL naming indicator found', 'No filenames clearly include a final marker.', 'Optional: confirm naming conventions and final package version.', sourceName));
  }
  if (hasFragment) {
    findings.push(finding('assets', 'note', 'Fragment-style files detected', 'Package includes files that look like RTE fragments.', 'Use the Veeva Suite tool to generate fragment previews and validate assembly.', sourceName));
  }
  if (hasClm) {
    findings.push(finding('qa', 'note', 'CLM/slide-style files detected', 'Package includes files that look like CLM or slide assets.', 'Run CLM navigation QA and attach the navigation map to this launch.', sourceName));
  }
  return findings;
}

export async function inspectLaunchpadFiles(files: FileList | File[]): Promise<LaunchpadFileInventory> {
  const arr = Array.from(files as ArrayLike<File>);
  const allNames: string[] = [];
  const sourceNames: string[] = [];
  for (const file of arr) {
    sourceNames.push(file.name);
    if (file.name.toLowerCase().endsWith('.zip')) {
      try {
        const zipNames = await extractZipFileNames(file);
        allNames.push(...zipNames);
      } catch {
        allNames.push(file.name);
      }
    } else {
      allNames.push(file.name);
    }
  }
  const unique = Array.from(new Set(allNames)).sort((a, b) => a.localeCompare(b));
  const sourceName = sourceNames.join(', ') || 'Uploaded files';
  return { sourceName, fileNames: unique, findings: analyzeNames(sourceName, unique) };
}

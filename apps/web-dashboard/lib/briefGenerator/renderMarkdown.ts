import type { BriefSectionDef } from './types';

export function renderBriefMarkdown(
  sections: BriefSectionDef[],
  values: Record<string, string>,
  title = 'Creative brief',
): string {
  const lines: string[] = [`# ${title}`, ''];
  for (const sec of sections) {
    lines.push(`## ${sec.title}`, '');
    for (const f of sec.fields) {
      const body = (values[f.id] ?? '').trim();
      lines.push(`### ${f.label}`, '', body || '_—_', '');
    }
  }
  return lines.join('\n').trimEnd();
}

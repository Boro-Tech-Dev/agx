export function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = '';
  let q = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      q = !q;
      continue;
    }
    if (!q && c === ',') {
      out.push(cur.trim());
      cur = '';
      continue;
    }
    cur += c;
  }
  out.push(cur.trim());
  return out;
}

export function parseManifestRows(text: string): { project_key: string; relative_path: string; document_kind: string }[] {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#'));
  if (!lines.length) return [];
  const header = splitCsvLine(lines[0]).map((h) => h.toLowerCase());
  const iPk = header.indexOf('project_key');
  const iPath = header.indexOf('relative_path');
  const iKind = header.indexOf('document_kind');
  if (iPk < 0 || iPath < 0 || iKind < 0) {
    throw new Error('Manifest CSV must include headers: project_key, relative_path, document_kind');
  }
  const rows: { project_key: string; relative_path: string; document_kind: string }[] = [];
  for (let li = 1; li < lines.length; li++) {
    const cols = splitCsvLine(lines[li]);
    const project_key = (cols[iPk] || '').trim();
    const relative_path = (cols[iPath] || '').trim();
    const document_kind = (cols[iKind] || '').trim().toLowerCase();
    if (!project_key && !relative_path && !document_kind) continue;
    rows.push({ project_key, relative_path, document_kind });
  }
  return rows;
}

export function findManifestFile(files: File[], relativePath: string): File | undefined {
  const rp = relativePath.replace(/^\/+/, '').trim();
  if (!rp) return undefined;
  const base = rp.split(/[/\\]/).pop() || rp;
  for (const f of files) {
    const wrp = (f as File & { webkitRelativePath?: string }).webkitRelativePath || '';
    if (wrp === rp || wrp.endsWith('/' + rp) || wrp.endsWith('\\' + rp)) return f;
    if (f.name === base && !wrp.includes('/')) return f;
  }
  for (const f of files) {
    const wrp = (f as File & { webkitRelativePath?: string }).webkitRelativePath || '';
    if (wrp.endsWith('/' + base) || wrp.endsWith('\\' + base) || wrp === base) return f;
  }
  return undefined;
}

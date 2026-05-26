const GENERIC_ITEM_TITLES = new Set([
  'tasks',
  'task',
  'risks',
  'risk',
  'decisions',
  'decision',
  'ideas',
  'idea',
  'open_questions',
  'open_question',
  'opportunities',
  'opportunity',
  'dependencies',
  'dependency',
  'milestones',
  'milestone',
  'anomaly',
  'anomalies',
  'cost',
  'costs',
]);

export function parseItemBody(raw: unknown): Record<string, unknown> | null {
  if (raw == null) return null;
  if (typeof raw === 'object' && !Array.isArray(raw)) return raw as Record<string, unknown>;
  if (typeof raw !== 'string') return null;
  try {
    const v = JSON.parse(raw);
    return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

/** Headline: real title when present; else first meaningful field from stored JSON body. */
export function projectItemPrimary(it: { title?: string; body?: unknown; item_type?: string }): string {
  const t = String(it.title || '').trim();
  const p = parseItemBody(it.body);
  if (t && !GENERIC_ITEM_TITLES.has(t.toLowerCase())) return t;
  if (p) {
    for (const k of ['title', 'risk', 'cost', 'decision', 'opportunity_name', 'question', 'name', 'note', 'anomaly'] as const) {
      const v = p[k];
      if (typeof v === 'string' && v.trim()) return v.trim().split('\n')[0].slice(0, 240);
    }
    for (const k of ['description', 'mitigation', 'problem', 'proposed_solution'] as const) {
      const v = p[k];
      if (typeof v === 'string' && v.trim()) return v.trim().split('\n')[0].slice(0, 240);
    }
  }
  if (t) return t;
  return it.item_type ? `${String(it.item_type).replace(/_/g, ' ')} (from run)` : 'Project item';
}

/** Second line: description, mitigation, scoring, owner/due — skips text already shown in primary. */
export function projectItemSecondary(
  it: { body?: unknown; item_type?: string; owner?: string | null; due_date?: string | null },
  primary: string,
): string | null {
  const p = parseItemBody(it.body);
  const parts: string[] = [];
  const prim = primary.toLowerCase();

  const pushDistinct = (s: string) => {
    const x = s.trim();
    if (!x) return;
    if (prim.includes(x.slice(0, Math.min(28, x.length)))) return;
    parts.push(x);
  };

  if (p) {
    if (typeof p.description === 'string') pushDistinct(p.description);
    if (typeof p.mitigation === 'string') pushDistinct(`Mitigation: ${p.mitigation}`);
    if (typeof p.problem === 'string' && String(it.item_type) === 'idea') pushDistinct(`Problem: ${p.problem}`);
    if (String(it.item_type) === 'risk' && (p.impact || p.likelihood)) {
      pushDistinct(`Impact ${String(p.impact ?? '—')} · Likelihood ${String(p.likelihood ?? '—')}`);
    }
    if (String(it.item_type) === 'cost') {
      if (typeof p.amount === 'string' || typeof p.amount === 'number') pushDistinct(`Amount: ${String(p.amount)}`);
      if (typeof p.currency === 'string') pushDistinct(`Currency: ${p.currency}`);
      if (typeof p.driver === 'string') pushDistinct(`Driver: ${p.driver}`);
    }
    if (String(it.item_type) === 'anomaly') {
      if (typeof p.context === 'string') pushDistinct(`Context: ${p.context}`);
      if (typeof p.note === 'string') pushDistinct(String(p.note));
    }
    if (Array.isArray(p.acceptance_criteria) && p.acceptance_criteria.length) {
      pushDistinct(`Acceptance: ${p.acceptance_criteria.map(String).join('; ')}`.slice(0, 260));
    }
  }
  if (it.owner) pushDistinct(`Owner: ${it.owner}`);
  if (it.due_date) pushDistinct(`Due: ${String(it.due_date).slice(0, 10)}`);

  if (String(it.item_type) === 'timeline_event' && p) {
    const raw = typeof p.raw_label === 'string' ? p.raw_label.trim() : '';
    if (raw && raw.toLowerCase() !== prim.slice(0, Math.min(raw.length, prim.length)).toLowerCase()) {
      pushDistinct(`From file: ${raw}`);
    }
  }

  if (!parts.length) return null;
  return parts.join(' · ').slice(0, 520);
}

export function normalizeProjectItemDedupeLabel(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, ' ');
}

function itemMetadata(it: any): Record<string, unknown> {
  const m = it?.metadata;
  if (m && typeof m === 'object' && !Array.isArray(m)) return m as Record<string, unknown>;
  return {};
}

/** Collapse repeats from multiple runs: same type + same summary headline → keep newest `created_at`. */
export function dedupeProjectItemsKeepNewest(rows: any[]): any[] {
  const sorted = [...(rows || [])].sort((a, b) => {
    const ta = Date.parse(a?.created_at || '') || 0;
    const tb = Date.parse(b?.created_at || '') || 0;
    return tb - ta;
  });
  const seen = new Set<string>();
  const out: any[] = [];
  for (const it of sorted) {
    const typ = String(it?.item_type || '').toLowerCase();
    const headline = normalizeProjectItemDedupeLabel(projectItemPrimary(it));
    let key: string;
    if (typ === 'timeline_event') {
      const md = itemMetadata(it);
      const due = String(it?.due_date || '').slice(0, 10);
      const pid = String(md.phase_id ?? '');
      const sid = String(md.source_document_id ?? '');
      const raw = normalizeProjectItemDedupeLabel(String(md.raw_label ?? headline));
      key = `${typ}\0${due}\0${pid}\0${sid}\0${raw}`;
    } else {
      key = `${typ}\0${headline}`;
    }
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(it);
  }
  return out;
}

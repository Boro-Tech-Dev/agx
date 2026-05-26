/**
 * Delivery scenario timeline — CSV-native (Task, Start Date, End Date, Note).
 * Keep parsing rules aligned with apps/agent-worker/worker/scenario_planning.py.
 */

export type HalTimelineStep = {
  task: string;
  start_date: string;
  end_date: string;
  note?: string;
  /** When true, this step was scheduled using calendar days (may include weekends/holidays). */
  allow_non_working_days?: boolean;
};

/** Sent as `input.scenario` on pm runs: either raw CSV or explicit steps (steps win on server if both). */
export type HalTimelineScenarioPayload = { csv_text: string } | { steps: HalTimelineStep[] };

const _ISO = /^\d{4}-\d{2}-\d{2}$/;

function normalizeHeaderKey(h: string): string {
  return h
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

/** Split CSV into rows; handles double-quoted fields with commas and escaped quotes. */
export function parseCsvRows(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i]!;
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          cur += '"';
          i += 1;
          continue;
        }
        inQuotes = false;
        continue;
      }
      cur += c;
      continue;
    }
    if (c === '"') {
      inQuotes = true;
      continue;
    }
    if (c === ',') {
      row.push(cur);
      cur = '';
      continue;
    }
    if (c === '\r') continue;
    if (c === '\n') {
      row.push(cur);
      rows.push(row);
      row = [];
      cur = '';
      continue;
    }
    cur += c;
  }
  row.push(cur);
  if (row.length > 1 || row[0] !== '') rows.push(row);
  return rows;
}

function parseIsoDate(s: string, ctx: string): { ok: true; value: string } | { ok: false; error: string } {
  const t = s.trim();
  if (!_ISO.test(t)) return { ok: false, error: `${ctx} must be YYYY-MM-DD` };
  const [y, m, d] = t.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (
    Number.isNaN(dt.getTime()) ||
    dt.getUTCFullYear() !== y ||
    dt.getUTCMonth() + 1 !== m ||
    dt.getUTCDate() !== d
  ) {
    return { ok: false, error: `${ctx} is not a valid calendar date` };
  }
  return { ok: true, value: t };
}

export function parseHalTimelineCsv(text: string): { ok: true; steps: HalTimelineStep[] } | { ok: false; error: string } {
  const raw = text.replace(/^\ufeff/, '').trim();
  if (!raw) return { ok: false, error: 'csv_text is empty' };
  const rows = parseCsvRows(raw);
  if (rows.length < 2) return { ok: false, error: 'CSV has no header row or no data rows' };
  const headerCells = rows[0]!.map((h) => normalizeHeaderKey(h));
  const idxTask = headerCells.findIndex((h) => h === 'task');
  const idxStart = headerCells.findIndex((h) => h === 'start date');
  const idxEnd = headerCells.findIndex((h) => h === 'end date');
  const idxNote = headerCells.findIndex((h) => h === 'note');
  const idxAllowNw = headerCells.findIndex(
    (h) => h === 'allow non working days' || h === 'allow_non_working_days',
  );
  if (idxTask < 0 || idxStart < 0 || idxEnd < 0) {
    return { ok: false, error: 'CSV must include columns: Task, Start Date, End Date (optional: Note)' };
  }
  const steps: HalTimelineStep[] = [];
  let rowNum = 2;
  for (let r = 1; r < rows.length; r++) {
    const cells = rows[r]!;
    const pad = (j: number) => (j < cells.length ? (cells[j] ?? '').trim() : '');
    const task = pad(idxTask);
    const sdRaw = pad(idxStart);
    const edRaw = pad(idxEnd);
    const noteRaw = idxNote >= 0 ? pad(idxNote) : '';
    const allowRaw = idxAllowNw >= 0 ? pad(idxAllowNw) : '';
    if (!task && !sdRaw && !edRaw && !noteRaw && !allowRaw) {
      rowNum += 1;
      continue;
    }
    if (!task) return { ok: false, error: `CSV row ${rowNum}: Task is required` };
    const sd = parseIsoDate(sdRaw, `CSV row ${rowNum} Start Date`);
    if (sd.ok === false) return { ok: false, error: sd.error };
    const ed = parseIsoDate(edRaw, `CSV row ${rowNum} End Date`);
    if (ed.ok === false) return { ok: false, error: ed.error };
    if (ed.value < sd.value) {
      return { ok: false, error: `CSV row ${rowNum}: End Date must be on or after Start Date` };
    }
    const step: HalTimelineStep = { task, start_date: sd.value, end_date: ed.value, note: noteRaw };
    const al = allowRaw.trim().toLowerCase();
    if (al === 'true' || al === '1' || al === 'yes') step.allow_non_working_days = true;
    steps.push(step);
    rowNum += 1;
  }
  if (steps.length === 0) return { ok: false, error: 'CSV has no data rows' };
  return { ok: true, steps };
}

export function computeTimelinePreview(steps: HalTimelineStep[]): {
  overall_start_date: string;
  overall_end_date: string;
  step_count: number;
} {
  const starts = steps.map((s) => s.start_date);
  const ends = steps.map((s) => s.end_date);
  return {
    overall_start_date: starts.reduce((a, b) => (a < b ? a : b)),
    overall_end_date: ends.reduce((a, b) => (a > b ? a : b)),
    step_count: steps.length,
  };
}

/** Build API payload from validated CSV text (server re-parses the same body). */
export function buildScenarioPayloadFromCsv(csvText: string): HalTimelineScenarioPayload | null {
  const p = parseHalTimelineCsv(csvText);
  if (!p.ok) return null;
  return { csv_text: csvText.replace(/^\ufeff/, '').trim() };
}

/** Structural equality for dirty detection (order-sensitive). */
export function halTimelineStepsEqual(a: HalTimelineStep[] | null, b: HalTimelineStep[] | null): boolean {
  if (a === b) return true;
  if (!a || !b || a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    const x = a[i]!;
    const y = b[i]!;
    if (x.task !== y.task || x.start_date !== y.start_date || x.end_date !== y.end_date) return false;
    if ((x.note ?? '') !== (y.note ?? '')) return false;
    if (!!x.allow_non_working_days !== !!y.allow_non_working_days) return false;
  }
  return true;
}

/** Returns first validation error, or null if all steps are valid for API. */
export function validateHalTimelineSteps(steps: HalTimelineStep[]): string | null {
  if (steps.length === 0) return 'At least one step is required';
  for (let i = 0; i < steps.length; i++) {
    const s = steps[i]!;
    if (!s.task?.trim()) return `Step ${i + 1}: task is required`;
    const sd = parseIsoDate(s.start_date, `Step ${i + 1} start_date`);
    if (sd.ok === false) return sd.error;
    const ed = parseIsoDate(s.end_date, `Step ${i + 1} end_date`);
    if (ed.ok === false) return ed.error;
    if (ed.value < sd.value) return `Step ${i + 1}: end_date must be on or after start_date`;
    const anw = s.allow_non_working_days;
    if (anw !== undefined && typeof anw !== 'boolean') {
      return `Step ${i + 1}: allow_non_working_days must be a boolean if present`;
    }
  }
  return null;
}

/** Build API payload from steps; returns null if validation fails. */
export function buildScenarioPayloadFromSteps(steps: HalTimelineStep[]): HalTimelineScenarioPayload | null {
  if (validateHalTimelineSteps(steps) !== null) return null;
  return { steps };
}

function csvEscapeCell(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

/**
 * Serialize steps to CSV matching `parseHalTimelineCsv` / worker `parse_steps_from_csv_text`.
 * Omits `Allow non working days` when no step uses calendar-day scheduling.
 */
export function halTimelineStepsToCsv(steps: HalTimelineStep[]): string {
  const err = validateHalTimelineSteps(steps);
  if (err !== null) throw new Error(err);
  const includeAllow = steps.some((s) => s.allow_non_working_days === true);
  const headers = includeAllow
    ? (['Task', 'Start Date', 'End Date', 'Note', 'Allow non working days'] as const)
    : (['Task', 'Start Date', 'End Date', 'Note'] as const);
  const lines: string[] = [headers.join(',')];
  for (const s of steps) {
    const note = s.note ?? '';
    const row = [
      csvEscapeCell(s.task),
      csvEscapeCell(s.start_date),
      csvEscapeCell(s.end_date),
      csvEscapeCell(note),
    ];
    if (includeAllow) {
      row.push(csvEscapeCell(s.allow_non_working_days === true ? 'true' : ''));
    }
    lines.push(row.join(','));
  }
  return `${lines.join('\n')}\n`;
}

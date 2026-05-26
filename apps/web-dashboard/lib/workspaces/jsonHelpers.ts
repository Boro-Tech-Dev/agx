export type JsonParseOk<T> = { ok: true; value: T };
export type JsonParseErr = { ok: false; error: string };

export function parseJsonField<T>(label: string, raw: string, fallback: T): JsonParseOk<T> | JsonParseErr {
  const s = (raw || '').trim();
  if (!s) return { ok: true, value: fallback } as const;
  try {
    return { ok: true, value: JSON.parse(s) as T } as const;
  } catch {
    return { ok: false, error: `${label}: invalid JSON` } as const;
  }
}

export function toTags(raw: string): string[] {
  const s = (raw || '').trim();
  if (!s) return [];
  return s
    .split(',')
    .map((x) => x.trim())
    .filter(Boolean);
}

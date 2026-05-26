'use client';

import { useEffect, useMemo, useState } from 'react';

export type HolidayRow = { date: string; name: string };

type CacheEntry = { holidays: HolidayRow[]; fetchedAt: number };

const cache = new Map<string, CacheEntry>();
const TTL_MS = 60 * 60 * 1000;

function cacheKey(from: string, to: string, country: string) {
  return `${country}|${from}|${to}`;
}

function browserApiBase(): string {
  return (process.env.NEXT_PUBLIC_AGENT_API_URL || '').trim() || '';
}

async function fetchHolidays(from: string, to: string, country: string): Promise<HolidayRow[]> {
  const base = browserApiBase();
  const q = new URLSearchParams({ from, to, country });
  const url = `${base}/api/calendar/holidays?${q.toString()}`;
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(t || `HTTP ${res.status}`);
  }
  const data = (await res.json()) as { holidays?: HolidayRow[] };
  return Array.isArray(data.holidays) ? data.holidays : [];
}

function parseIsoDate(iso: string): Date | null {
  // Expect YYYY-MM-DD (API contract). We keep this light: invalids will simply yield null.
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso.trim());
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  const dt = new Date(Date.UTC(y, mo - 1, d));
  if (Number.isNaN(dt.getTime())) return null;
  // Guard against Date auto-rollover (e.g. 2026-02-31).
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() + 1 !== mo || dt.getUTCDate() !== d) return null;
  return dt;
}

function isoFromUtcDate(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function yearSlices(fromIso: string, toIso: string): Array<{ from: string; to: string }> {
  const from = parseIsoDate(fromIso);
  const to = parseIsoDate(toIso);
  if (!from || !to) return [{ from: fromIso, to: toIso }];
  if (to < from) return [{ from: fromIso, to: toIso }];

  const slices: Array<{ from: string; to: string }> = [];
  let y = from.getUTCFullYear();
  const yEnd = to.getUTCFullYear();
  while (y <= yEnd) {
    const sliceFrom = y === from.getUTCFullYear() ? from : new Date(Date.UTC(y, 0, 1));
    const sliceTo = y === to.getUTCFullYear() ? to : new Date(Date.UTC(y, 11, 31));
    slices.push({ from: isoFromUtcDate(sliceFrom), to: isoFromUtcDate(sliceTo) });
    y++;
  }
  return slices;
}

async function fetchHolidaysInSlices(fromIso: string, toIso: string, country: string): Promise<HolidayRow[]> {
  const slices = yearSlices(fromIso, toIso);
  const parts = await Promise.all(
    slices.map(async ({ from, to }) => {
      const key = cacheKey(from, to, country);
      const hit = cache.get(key);
      const now = Date.now();
      if (hit && now - hit.fetchedAt < TTL_MS) return hit.holidays;
      const h = await fetchHolidays(from, to, country);
      cache.set(key, { holidays: h, fetchedAt: Date.now() });
      return h;
    }),
  );

  const byDate = new Map<string, HolidayRow>();
  for (const arr of parts) for (const r of arr) if (!byDate.has(r.date)) byDate.set(r.date, r);
  return Array.from(byDate.values()).sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * US federal holidays in [from, to] for dimming calendar cells and scenario math.
 * Uses same-origin `/api/...` when NEXT_PUBLIC_AGENT_API_URL is unset (Next rewrite).
 */
export function useHolidays(fromIso: string, toIso: string, country = 'US') {
  const [rows, setRows] = useState<HolidayRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetchHolidaysInSlices(fromIso, toIso, country)
      .then((h) => {
        if (cancelled) return;
        setRows(h);
        setLoading(false);
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : String(e));
        setRows([]);
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [fromIso, toIso, country]);

  const holidaySet = useMemo(() => new Set(rows.map((r) => r.date)), [rows]);
  const holidayNames = useMemo(() => {
    const m = new Map<string, string>();
    for (const r of rows) m.set(r.date, r.name);
    return m;
  }, [rows]);

  return { loading, error, rows, holidaySet, holidayNames };
}

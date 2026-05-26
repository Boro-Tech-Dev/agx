'use client';

import { useCallback, useMemo, useState } from 'react';

type CompareResult = {
  width: number;
  height: number;
  comparedPixels: number;
  changedPixels: number;
  mismatchPercent: number;
  avgDelta: number;
  sizeWarning?: string;
};

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error(`Could not read ${file.name}`));
    };
    img.src = url;
  });
}

async function compareImages(reference: File, current: File): Promise<CompareResult> {
  const [a, b] = await Promise.all([loadImage(reference), loadImage(current)]);
  const width = Math.min(a.naturalWidth, b.naturalWidth, 1200);
  const height = Math.min(a.naturalHeight, b.naturalHeight, 2000);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('Canvas is not available in this browser.');

  ctx.clearRect(0, 0, width, height);
  ctx.drawImage(a, 0, 0, width, height);
  const ref = ctx.getImageData(0, 0, width, height).data;
  ctx.clearRect(0, 0, width, height);
  ctx.drawImage(b, 0, 0, width, height);
  const cur = ctx.getImageData(0, 0, width, height).data;

  let changedPixels = 0;
  let deltaTotal = 0;
  const comparedPixels = width * height;
  for (let i = 0; i < ref.length; i += 4) {
    const dr = Math.abs(ref[i] - cur[i]);
    const dg = Math.abs(ref[i + 1] - cur[i + 1]);
    const db = Math.abs(ref[i + 2] - cur[i + 2]);
    const da = Math.abs(ref[i + 3] - cur[i + 3]);
    const delta = (dr + dg + db + da) / 4;
    deltaTotal += delta;
    if (delta > 18) changedPixels += 1;
  }

  const sizeWarning = a.naturalWidth !== b.naturalWidth || a.naturalHeight !== b.naturalHeight
    ? `Image dimensions differ. Reference is ${a.naturalWidth}×${a.naturalHeight}; current is ${b.naturalWidth}×${b.naturalHeight}. Comparison used ${width}×${height}.`
    : undefined;

  return {
    width,
    height,
    comparedPixels,
    changedPixels,
    mismatchPercent: comparedPixels ? (changedPixels / comparedPixels) * 100 : 0,
    avgDelta: comparedPixels ? deltaTotal / comparedPixels : 0,
    sizeWarning,
  };
}

export function ScreenshotComparator() {
  const [reference, setReference] = useState<File | null>(null);
  const [current, setCurrent] = useState<File | null>(null);
  const [result, setResult] = useState<CompareResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const verdict = useMemo(() => {
    if (!result) return null;
    if (result.mismatchPercent > 12 || result.avgDelta > 20) return { label: 'Major visual drift', tone: 'text-rose-700 dark:text-rose-300' };
    if (result.mismatchPercent > 3 || result.avgDelta > 8) return { label: 'Review recommended', tone: 'text-amber-700 dark:text-amber-300' };
    return { label: 'Minor/no visual drift', tone: 'text-emerald-700 dark:text-emerald-300' };
  }, [result]);

  const run = useCallback(async () => {
    if (!reference || !current) return;
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      setResult(await compareImages(reference, current));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }, [reference, current]);

  return (
    <div className="rounded-lg border border-app-border bg-app-fill/60 p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-app-text">Screenshot QA Comparator</h3>
          <p className="mt-1 max-w-3xl text-[11px] text-app-muted">
            Compare an approved/reference screenshot against a current preview screenshot. This is a lightweight browser-side pixel check for layout drift, missing content, or unexpected rendering changes.
          </p>
        </div>
        {verdict ? <span className={`rounded-full border border-app-border bg-app-surface px-2 py-1 text-[10px] font-semibold ${verdict.tone}`}>{verdict.label}</span> : null}
      </div>

      <div className="mt-3 grid gap-2 desktop:grid-cols-[1fr_1fr_auto]">
        <label className="text-[11px] text-app-muted">
          <span className="font-medium text-app-text">Reference screenshot</span>
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="mt-1 w-full rounded-md border border-app-border bg-app-fill p-1.5 text-xs text-app-text outline-none file:mr-2 file:rounded file:border-0 file:bg-app-surface file:px-2 file:py-1 file:text-[11px]"
            onChange={(e) => {
              setReference(e.target.files?.[0] ?? null);
              setResult(null);
            }}
          />
        </label>
        <label className="text-[11px] text-app-muted">
          <span className="font-medium text-app-text">Current screenshot</span>
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="mt-1 w-full rounded-md border border-app-border bg-app-fill p-1.5 text-xs text-app-text outline-none file:mr-2 file:rounded file:border-0 file:bg-app-surface file:px-2 file:py-1 file:text-[11px]"
            onChange={(e) => {
              setCurrent(e.target.files?.[0] ?? null);
              setResult(null);
            }}
          />
        </label>
        <button
          type="button"
          disabled={!reference || !current || busy}
          onClick={() => void run()}
          className="self-end rounded-md border border-indigo-500/40 bg-indigo-600/90 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-600 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {busy ? 'Comparing…' : 'Compare'}
        </button>
      </div>

      {error ? <p className="mt-2 text-[11px] text-rose-600 dark:text-rose-300">{error}</p> : null}
      {result ? (
        <div className="mt-3 grid gap-2 text-[11px] tablet:grid-cols-4">
          <div className="rounded border border-app-border bg-app-surface p-2">
            <div className="text-[10px] uppercase tracking-wide text-app-muted">Mismatch</div>
            <div className="mt-1 text-lg font-semibold text-app-text">{result.mismatchPercent.toFixed(2)}%</div>
          </div>
          <div className="rounded border border-app-border bg-app-surface p-2">
            <div className="text-[10px] uppercase tracking-wide text-app-muted">Changed pixels</div>
            <div className="mt-1 text-lg font-semibold text-app-text">{result.changedPixels.toLocaleString()}</div>
          </div>
          <div className="rounded border border-app-border bg-app-surface p-2">
            <div className="text-[10px] uppercase tracking-wide text-app-muted">Average delta</div>
            <div className="mt-1 text-lg font-semibold text-app-text">{result.avgDelta.toFixed(1)}</div>
          </div>
          <div className="rounded border border-app-border bg-app-surface p-2">
            <div className="text-[10px] uppercase tracking-wide text-app-muted">Compared area</div>
            <div className="mt-1 text-lg font-semibold text-app-text">{result.width}×{result.height}</div>
          </div>
          {result.sizeWarning ? <p className="tablet:col-span-4 rounded border border-amber-200 bg-amber-50 p-2 text-[10px] text-amber-900 dark:border-amber-500/35 dark:bg-amber-500/10 dark:text-amber-100">{result.sizeWarning}</p> : null}
        </div>
      ) : null}
    </div>
  );
}

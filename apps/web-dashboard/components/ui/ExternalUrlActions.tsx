'use client';

import { useCallback, useMemo, useState } from 'react';

function parseHttpUrl(url: string): URL | null {
  const trimmed = url.trim();
  if (!trimmed) return null;
  try {
    const u = new URL(trimmed);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
    return u;
  } catch {
    return null;
  }
}

export function ExternalUrlActions({ url, className = '' }: { url: string; className?: string }) {
  const [copyHint, setCopyHint] = useState<string | null>(null);
  const validUrl = useMemo(() => parseHttpUrl(url), [url]);

  const onCopy = useCallback(async () => {
    const text = validUrl?.href ?? url.trim();
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopyHint('Copied');
    } catch {
      setCopyHint('Copy failed');
    }
    window.setTimeout(() => setCopyHint(null), 1600);
  }, [url, validUrl]);

  const onOpen = useCallback(() => {
    if (!validUrl) return;
    window.open(validUrl.href, '_blank', 'noopener,noreferrer');
  }, [validUrl]);

  return (
    <div className={className}>
      <p className="break-all font-mono text-[11px] text-app-accent">{url}</p>
      <div className="mt-1 flex flex-wrap items-center gap-2">
        <button
          type="button"
          className="rounded border border-app-border px-2 py-0.5 text-[10px] font-medium text-app-text hover:bg-app-fill"
          onClick={() => void onCopy()}
        >
          Copy URL
        </button>
        <button
          type="button"
          className="rounded border border-app-border px-2 py-0.5 text-[10px] font-medium text-app-text hover:bg-app-fill disabled:cursor-not-allowed disabled:opacity-50"
          disabled={!validUrl}
          onClick={onOpen}
        >
          Open
        </button>
        {copyHint ? <span className="text-[10px] text-app-muted">{copyHint}</span> : null}
      </div>
    </div>
  );
}

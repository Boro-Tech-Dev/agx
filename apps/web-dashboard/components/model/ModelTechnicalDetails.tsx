'use client';

export function ModelTechnicalDetails({ raw }: { raw: unknown }) {
  const text = JSON.stringify(raw, null, 2);
  return (
    <details className="group rounded-lg border border-app-border bg-app-surface/50">
      <summary className="cursor-pointer select-none px-3 py-2 text-[12px] font-medium text-app-muted hover:text-app-text">
        Technical details <span className="text-app-muted">(raw JSON)</span>
      </summary>
      <pre className="max-h-[min(60vh,520px)] overflow-auto border-t border-app-border p-3 text-[11px] leading-relaxed text-app-text">
        {text}
      </pre>
    </details>
  );
}

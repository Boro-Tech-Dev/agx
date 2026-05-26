import type { RetrievalCatalogEntry } from '../../lib/retrievalCatalog';
import type { ModelCatalogEntry } from '../../lib/modelCatalog';

type CatalogEntry = ModelCatalogEntry | RetrievalCatalogEntry;

export function CatalogDetailSection({ catalog }: { catalog: CatalogEntry }) {
  return (
    <div className="mt-3 space-y-2 border-t border-app-border/60 pt-3">
      <p className="text-[11px] leading-relaxed text-app-muted">{catalog.summary}</p>
      <div className="grid gap-2 tablet:grid-cols-2">
        <div>
          <div className="mb-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-800 dark:text-emerald-200/90">
            Strengths
          </div>
          <ul className="list-disc space-y-0.5 pl-4 text-[11px] leading-snug text-app-muted marker:text-emerald-600 dark:marker:text-emerald-400/80">
            {catalog.strengths.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ul>
        </div>
        <div>
          <div className="mb-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-800 dark:text-amber-200/90">
            Weaknesses
          </div>
          <ul className="list-disc space-y-0.5 pl-4 text-[11px] leading-snug text-app-muted marker:text-amber-600 dark:marker:text-amber-400/80">
            {catalog.weaknesses.map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

import type { ModelOverviewPayload, RerankerCatalogRow, RerankerHealthRow } from '../../lib/modelOverviewTypes';
import { rerankerHealthById } from '../../lib/modelOverviewTypes';
import { getRerankerCatalogEntry } from '../../lib/retrievalCatalog';
import {
  agentsByReranker,
  deriveRerankerTileState,
  rerankerBadgeClass,
  rerankerStateDotClass,
  rerankerStateLabel,
  retrievalFamilyClasses,
} from '../../lib/retrievalTileState';
import { CatalogDetailSection } from './CatalogDetailSection';

type Props = {
  reranker: RerankerCatalogRow;
  health: RerankerHealthRow | undefined;
  agents: string[];
};

export function RerankerTile({ reranker, health, agents }: Props) {
  const state = deriveRerankerTileState(reranker, health);
  const fam = retrievalFamilyClasses(reranker.reranker_id, 'reranker');
  const catalog = getRerankerCatalogEntry(reranker.reranker_id);
  const isOff = reranker.reranker_id === 'off' || reranker.backend === 'none';

  const endpointOrTag =
    reranker.backend === 'ollama'
      ? `${reranker.model_tag ?? '—'} (Ollama — not probed)`
      : reranker.endpoint ?? '—';
  const activeModel =
    health?.health && typeof health.health.model === 'string' ? health.health.model : null;

  return (
    <div
      className={`group relative overflow-hidden rounded-xl border border-app-border bg-gradient-to-br ${fam.glow} to-app-surface p-4 shadow-xs ring-1 ring-inset ring-transparent transition-[box-shadow,ring-color] ${fam.ring}`}
    >
      <div className={`pointer-events-none absolute right-3 top-3 h-2 w-2 rounded-full ${rerankerStateDotClass(state)}`} />
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 pr-6">
        <div className="min-w-0 shrink font-mono text-[13px] font-semibold tracking-tight text-app-text">
          {reranker.reranker_id}
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${fam.chip}`}>
            {isOff ? 'Off' : 'Reranker'}
          </span>
          <span className="rounded bg-app-fill px-1.5 py-0.5 text-[10px] font-medium text-app-muted">
            {reranker.backend}
          </span>
          <span
            className={`rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${rerankerBadgeClass(state)}`}
          >
            {rerankerStateLabel(state, health)}
          </span>
        </div>
        {agents.length > 0 ? (
          <span className="min-w-0 text-[11px] text-app-muted">
            <span className="font-medium text-app-text">Agents</span>
            <span className="ml-1 font-mono text-app-muted">{agents.join(', ')}</span>
          </span>
        ) : null}
      </div>

      <div className="mt-2 space-y-0.5 text-[11px] text-app-muted">
        <p className="font-mono text-[10px] break-all">{endpointOrTag}</p>
        {activeModel ? <p className="text-[10px]">active: {activeModel}</p> : null}
        {reranker.display_name && reranker.display_name !== reranker.reranker_id ? (
          <p className="text-[10px]">{reranker.display_name}</p>
        ) : null}
      </div>

      {catalog ? <CatalogDetailSection catalog={catalog} /> : null}

      {state === 'failed' && health?.error ? (
        <p className="mt-2 line-clamp-3 rounded-md bg-rose-50 p-2 text-[11px] leading-snug text-rose-800 dark:bg-rose-500/10 dark:text-rose-200">
          {health.error}
        </p>
      ) : null}
    </div>
  );
}

export function RerankerTilesGrid({ overview }: { overview: ModelOverviewPayload }) {
  const healthMap = rerankerHealthById(overview.reranker_health);
  const agentMap = agentsByReranker(overview.retrieval.agents);

  return (
    <div className="grid grid-cols-1 gap-3 tablet:grid-cols-2 xl:grid-cols-3">
      {overview.catalog.rerankers.map((reranker) => (
        <RerankerTile
          key={reranker.reranker_id}
          reranker={reranker}
          health={healthMap.get(reranker.reranker_id)}
          agents={agentMap.get(reranker.reranker_id) ?? []}
        />
      ))}
    </div>
  );
}

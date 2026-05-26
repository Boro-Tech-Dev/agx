'use client';

import { ModelTile } from './ModelTile';
import type { ModelStatusPayload } from '../../lib/modelStatusTypes';

export function ModelTilesGrid({
  data,
  onRefresh,
}: {
  data: ModelStatusPayload;
  onRefresh: () => Promise<void>;
}) {
  const ollama = data.backends.ollama;
  const ollamaReachable = ollama?.reachable === true;
  const pullEnabled = data.features.ollama_pull_enabled !== false;

  return (
    <div className="grid grid-cols-1 gap-3 tablet:grid-cols-2 xl:grid-cols-3">
      {data.required.map((row) => (
        <ModelTile
          key={row.id}
          row={row}
          routes={data.routes}
          embedModel={data.embed_model}
          ollamaReachable={ollamaReachable}
          pullEnabled={pullEnabled}
          onRefresh={onRefresh}
        />
      ))}
    </div>
  );
}

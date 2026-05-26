'use client';

import { useBriefTemplateConfig } from '../../lib/briefGenerator/useBriefTemplateConfig';
import { BriefFactoryInner } from './brief/BriefFactoryInner';

export function BriefGeneratorPanel({ projectKey }: { projectKey: string }) {
  const { bundle, loading, fromApi, publishedVersion } = useBriefTemplateConfig();

  if (loading) {
    return <div className="text-xs text-app-muted">Loading brief template…</div>;
  }

  return (
    <div className="space-y-2">
      {fromApi && publishedVersion != null ? (
        <p className="text-[10px] text-app-muted">
          Using published brief template <span className="font-mono">v{publishedVersion}</span> from server.
        </p>
      ) : (
        <p className="text-[10px] text-app-muted">Using bundled default template (no published row in database).</p>
      )}
      <BriefFactoryInner projectKey={projectKey} bundle={bundle} />
    </div>
  );
}

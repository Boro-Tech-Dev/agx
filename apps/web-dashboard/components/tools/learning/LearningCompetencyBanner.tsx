'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

import { listLearningCompetencies } from '../../../lib/api';
import { competencyRequiredForTool } from '../../../lib/learning/competencyGates';
import { toolRouteHref, type ToolCatalogId } from '../../../lib/toolCatalog';

export function LearningCompetencyBanner({ toolId }: { toolId: ToolCatalogId }) {
  const required = competencyRequiredForTool(toolId);
  const [held, setHeld] = useState<Set<string> | null>(null);

  useEffect(() => {
    if (!required) return;
    void listLearningCompetencies()
      .then((d) => setHeld(new Set(d.competencies ?? [])))
      .catch(() => setHeld(new Set()));
  }, [required]);

  if (!required || held == null || held.has(required)) return null;

  return (
    <div className="mb-3 rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-[11px] text-app-text">
      Complete the Learning path that grants <span className="font-mono">{required}</span> before using this
      tool.{' '}
      <Link href={toolRouteHref('learning')} className="font-medium underline">
        Open Learning
      </Link>
    </div>
  );
}

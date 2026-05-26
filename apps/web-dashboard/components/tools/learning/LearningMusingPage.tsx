import Link from 'next/link';

import type { LearningMusing } from '../../../lib/learning/musings/registry';
import { toolRouteHref } from '../../../lib/toolCatalog';

export function LearningMusingPage({ musing }: { musing: LearningMusing }) {
  return (
    <div className="space-y-4">
      <Link href={toolRouteHref('learning')} className="text-[11px] text-app-muted hover:text-app-text">
        ← Learning hub
      </Link>
      <article className="max-w-3xl">
        <h1 className="text-lg font-semibold text-app-text">{musing.title}</h1>
        <div className="mt-4 whitespace-pre-wrap text-[13px] leading-relaxed text-app-text">
          {musing.body}
        </div>
      </article>
    </div>
  );
}

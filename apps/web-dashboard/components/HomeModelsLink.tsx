'use client';

import Link from 'next/link';

import { useModelNavOverview, useModelNavTone } from '../hooks/useModelNavTone';
import { modelNavToneTitle } from '../lib/modelNavStatus';
import { ModelStatusNavDot } from './ModelStatusNavDot';

/** Home top nav "Models" pill with live status dot (same API as sidebar). */
export function HomeModelsLink() {
  const tone = useModelNavTone();
  const overview = useModelNavOverview();
  return (
    <Link
      className="inline-flex items-center gap-1.5 rounded-md bg-cyan-100 px-2 py-1 font-medium text-cyan-800 hover:bg-cyan-200 dark:bg-cyan-500/15 dark:text-cyan-200 dark:hover:bg-cyan-500/25"
      href="/model"
      title={modelNavToneTitle(tone, overview)}
    >
      <ModelStatusNavDot tone={tone} overview={overview} />
      Models
    </Link>
  );
}

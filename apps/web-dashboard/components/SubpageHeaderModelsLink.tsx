'use client';

import Link from 'next/link';

import { useModelNavOverview, useModelNavTone } from '../hooks/useModelNavTone';
import { modelNavToneTitle } from '../lib/modelNavStatus';
import { primaryToolNavClasses } from '../lib/navConfig';
import { ModelStatusNavDot } from './ModelStatusNavDot';
import { useDashboardShellActiveTool } from './DashboardShellNavContext';

/** Models chip for shell headers — next to theme toggle (home and subpages). */
export function SubpageHeaderModelsLink() {
  const activeTool = useDashboardShellActiveTool();
  const active = activeTool === 'model';
  const tone = useModelNavTone();
  const overview = useModelNavOverview();

  return (
    <Link
      href="/model"
      className={primaryToolNavClasses(active)}
      title={modelNavToneTitle(tone, overview)}
    >
      <ModelStatusNavDot tone={tone} overview={overview} />
      Models
    </Link>
  );
}

'use client';

import type { ModelOverviewPayload } from '../lib/modelOverviewTypes';
import type { ModelNavTone } from '../lib/modelNavStatus';
import { modelNavToneTitle } from '../lib/modelNavStatus';

const toneClass: Record<ModelNavTone, string> = {
  green: 'bg-emerald-500 shadow-[0_0_0_1px_rgba(16,185,129,0.35)]',
  yellow: 'bg-amber-500 shadow-[0_0_0_1px_rgba(245,158,11,0.4)]',
  red: 'bg-rose-500 shadow-[0_0_0_1px_rgba(244,63,94,0.35)]',
};

/**
 * R/Y/G dot for Models links — use with {@link useModelNavTone}.
 */
export function ModelStatusNavDot({
  tone,
  overview,
  className = '',
}: {
  tone: ModelNavTone;
  overview?: ModelOverviewPayload | null;
  className?: string;
}) {
  return (
    <span
      className={`inline-block h-2 w-2 shrink-0 rounded-full ${toneClass[tone]} ${className}`}
      title={modelNavToneTitle(tone, overview)}
      aria-hidden
    />
  );
}

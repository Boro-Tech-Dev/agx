'use client';

import { LearnResumeChip } from '../tools/learning/LearnResumeChip';
import { SubpageHeaderModelsLink } from '../SubpageHeaderModelsLink';
import { HomeCommandPalette, type HomeCommandPaletteAgent } from './HomeCommandPalette';

export function HomeHeaderClient({
  agents,
  title,
  subtitle,
}: {
  agents: HomeCommandPaletteAgent[];
  title: string;
  subtitle: string;
}) {
  return (
    <header className="mb-0 flex min-w-0 flex-col gap-1.5 tablet:flex-row tablet:items-center tablet:justify-between">
      <div className="min-w-0">
        <h1 className="font-display text-lg font-bold uppercase tracking-widest text-rt-white">
          {title}{' '}
          <span className="font-mono text-[11px] font-normal normal-case tracking-normal text-rt-ice/60">
            {subtitle}
          </span>
        </h1>
      </div>
      <div className="flex flex-wrap items-center gap-1">
        <HomeCommandPalette agents={agents} />
        <LearnResumeChip />
        <SubpageHeaderModelsLink />
      </div>
    </header>
  );
}

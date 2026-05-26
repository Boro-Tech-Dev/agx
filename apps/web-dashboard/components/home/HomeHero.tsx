'use client';

import { HOME_HERO_SLIDES } from '../../lib/home/homeHeroCopy';
import { SHELL_HERO_BAND } from '../../lib/shellClasses';
import { HomeHeroCarousel } from './HomeHeroCarousel';

export function HomeHero() {
  return (
    <div
      className={`relative flex h-auto shrink-0 flex-col justify-center overflow-x-hidden border-b border-rt-panel bg-rt-charcoal py-6 md:min-h-[140px] md:py-4 ${SHELL_HERO_BAND}`}
    >
      <div
        className="pointer-events-none absolute right-0 top-0 h-full w-64 opacity-5"
        style={{
          backgroundImage:
            'repeating-linear-gradient(45deg, transparent, transparent 10px, #FFD23E 10px, #FFD23E 20px)',
        }}
      />
      <HomeHeroCarousel slides={HOME_HERO_SLIDES} />
    </div>
  );
}

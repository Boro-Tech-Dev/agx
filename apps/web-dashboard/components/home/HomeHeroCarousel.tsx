'use client';

import Autoplay from 'embla-carousel-autoplay';
import useEmblaCarousel from 'embla-carousel-react';
import { ArrowRight, ChevronLeft, ChevronRight, LayoutGrid, Settings, Sparkles } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { useCallback, useEffect, useRef, useState, type FocusEvent } from 'react';
import { useReducedMotion } from 'framer-motion';

import type { HomeHeroCta, HomeHeroCtaIcon, HomeHeroSlide } from '../../lib/home/homeHeroCopy';

const HERO_LOGO_SRC = '/brand/ragtag-stack.png';
const HERO_LOGO_WIDTH = 1236;
const HERO_LOGO_HEIGHT = 824;

function HeroSlideLogo() {
  return (
    <Image
      src={HERO_LOGO_SRC}
      width={HERO_LOGO_WIDTH}
      height={HERO_LOGO_HEIGHT}
      alt=""
      aria-hidden
      className="h-full max-h-28 w-full object-contain object-center md:max-h-none"
    />
  );
}

function CtaIcon({ icon }: { icon?: HomeHeroCtaIcon }) {
  const cls = 'h-4 w-4';
  switch (icon) {
    case 'settings':
      return <Settings className={cls} aria-hidden />;
    case 'grid':
      return <LayoutGrid className={cls} aria-hidden />;
    case 'spark':
      return <Sparkles className={cls} aria-hidden />;
    case 'arrow':
    default:
      return <ArrowRight className={cls} aria-hidden />;
  }
}

function HeroCta({ cta }: { cta: HomeHeroCta }) {
  const className =
    cta.variant === 'primary'
      ? 'flex w-full items-center justify-center gap-2 bg-rt-cyan px-5 py-2.5 text-xs font-semibold uppercase tracking-wider text-rt-black transition-colors hover:bg-[#00A0B5]'
      : 'flex w-full items-center justify-center gap-2 border border-rt-panel bg-transparent px-5 py-2.5 text-xs font-semibold uppercase tracking-wider text-rt-ice transition-colors hover:bg-rt-panel';

  const children = (
    <>
      {cta.label}
      <CtaIcon icon={cta.icon} />
    </>
  );

  if (cta.href.startsWith('#')) {
    return (
      <a href={cta.href} className={className}>
        {children}
      </a>
    );
  }

  return (
    <Link href={cta.href} className={className}>
      {children}
    </Link>
  );
}

function HeroSlideContent({
  slide,
  slideIndex,
  slideCount,
}: {
  slide: HomeHeroSlide;
  slideIndex: number;
  slideCount: number;
}) {
  return (
    <div className="grid w-full min-w-0 flex-[0_0_100%] grid-cols-1 items-center gap-4 py-1 md:min-h-[124px] md:grid-cols-[auto_minmax(0,1fr)_auto] md:items-stretch md:gap-5 lg:gap-8">
      <div className="flex h-28 w-full items-center justify-center md:h-auto md:w-[8.5rem] md:min-h-[7.75rem] md:shrink-0 lg:w-[9.5rem]">
        <HeroSlideLogo />
      </div>

      <div
        className="flex min-w-0 flex-col justify-center"
        role="group"
        aria-roledescription="slide"
        aria-label={`Slide ${slideIndex + 1} of ${slideCount}`}
      >
        {slide.eyebrow ? (
          <p className="mb-1 font-mono text-[10px] font-semibold uppercase tracking-widest text-rt-cyan">
            {slide.eyebrow}
          </p>
        ) : null}
        <h1 className="break-words font-display text-xl font-bold uppercase leading-tight tracking-tight text-rt-white sm:text-2xl md:text-3xl lg:text-4xl">
          {slide.headline}
        </h1>
        <p className="mt-2 min-w-0 font-mono text-sm leading-snug tracking-tight text-rt-ice/80 md:text-base">
          {slide.subline}
        </p>
      </div>

      <div className="flex w-full shrink-0 flex-col justify-center gap-2 md:w-auto md:min-w-[11rem]">
        {slide.ctas.map((cta) => (
          <HeroCta key={`${slide.id}-${cta.label}`} cta={cta} />
        ))}
      </div>
    </div>
  );
}

export function HomeHeroCarousel({ slides }: { slides: HomeHeroSlide[] }) {
  const reduceMotion = useReducedMotion();
  const userInteractedRef = useRef(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [liveAnnouncement, setLiveAnnouncement] = useState('');

  const autoplayPlugin = useRef(
    Autoplay({
      delay: 9000,
      stopOnInteraction: false,
      stopOnMouseEnter: true,
    }),
  );

  const plugins = reduceMotion ? [] : [autoplayPlugin.current];

  const [emblaRef, emblaApi] = useEmblaCarousel(
    { loop: true, align: 'start', skipSnaps: false, duration: reduceMotion ? 0 : 25 },
    plugins,
  );

  const onSelect = useCallback(() => {
    if (!emblaApi) return;
    setSelectedIndex(emblaApi.selectedScrollSnap());
  }, [emblaApi]);

  useEffect(() => {
    if (!emblaApi) return;
    onSelect();
    emblaApi.on('reInit', onSelect);
    emblaApi.on('select', onSelect);
    return () => {
      emblaApi.off('reInit', onSelect);
      emblaApi.off('select', onSelect);
    };
  }, [emblaApi, onSelect]);

  const markUserInteracted = useCallback(() => {
    userInteractedRef.current = true;
  }, []);

  const announceSlide = useCallback(
    (index: number) => {
      if (!userInteractedRef.current) return;
      const slide = slides[index];
      if (!slide) return;
      setLiveAnnouncement(`${slide.headline}. ${slide.subline}`);
    },
    [slides],
  );

  useEffect(() => {
    announceSlide(selectedIndex);
  }, [selectedIndex, announceSlide]);

  const scrollPrev = useCallback(() => {
    markUserInteracted();
    emblaApi?.scrollPrev();
  }, [emblaApi, markUserInteracted]);

  const scrollNext = useCallback(() => {
    markUserInteracted();
    emblaApi?.scrollNext();
  }, [emblaApi, markUserInteracted]);

  const scrollTo = useCallback(
    (index: number) => {
      markUserInteracted();
      emblaApi?.scrollTo(index);
    },
    [emblaApi, markUserInteracted],
  );

  const onFocusIn = useCallback(() => {
    autoplayPlugin.current.stop();
  }, []);

  const onFocusOut = useCallback(
    (e: FocusEvent<HTMLDivElement>) => {
      if (reduceMotion) return;
      const root = e.currentTarget;
      if (root.contains(e.relatedTarget as Node | null)) return;
      autoplayPlugin.current.play();
    },
    [reduceMotion],
  );

  if (slides.length === 0) return null;

  if (slides.length === 1) {
    return (
      <div className="relative z-10 px-4 lg:px-0">
        <HeroSlideContent slide={slides[0]} slideIndex={0} slideCount={1} />
      </div>
    );
  }

  const showControls = slides.length > 1;

  return (
    <div
      className="relative z-10 px-4 lg:px-0"
      role="region"
      aria-roledescription="carousel"
      aria-label="Home hero"
      onFocusCapture={onFocusIn}
      onBlurCapture={onFocusOut}
      onPointerDown={markUserInteracted}
      onKeyDown={markUserInteracted}
    >
      <span className="sr-only" aria-live="polite">
        {liveAnnouncement}
      </span>

      <div className="flex min-w-0 items-center gap-1 lg:gap-2">
        {showControls ? (
          <button
            type="button"
            className="hidden shrink-0 border border-rt-panel bg-rt-charcoal/80 p-2 text-rt-ice transition-colors hover:bg-rt-panel lg:flex"
            aria-label="Previous slide"
            onClick={scrollPrev}
          >
            <ChevronLeft className="h-4 w-4" aria-hidden />
          </button>
        ) : null}

        <div className="min-w-0 flex-1 overflow-hidden" ref={emblaRef}>
          <div className="flex touch-pan-y">
            {slides.map((slide, i) => (
              <HeroSlideContent key={slide.id} slide={slide} slideIndex={i} slideCount={slides.length} />
            ))}
          </div>
        </div>

        {showControls ? (
          <button
            type="button"
            className="hidden shrink-0 border border-rt-panel bg-rt-charcoal/80 p-2 text-rt-ice transition-colors hover:bg-rt-panel lg:flex"
            aria-label="Next slide"
            onClick={scrollNext}
          >
            <ChevronRight className="h-4 w-4" aria-hidden />
          </button>
        ) : null}
      </div>

      {showControls ? (
        <div
          className="mt-3 flex justify-end gap-1.5 md:absolute md:bottom-3 md:right-4 md:mt-0 lg:right-0"
          role="tablist"
          aria-label="Hero slides"
        >
          {slides.map((slide, i) => (
            <button
              key={slide.id}
              type="button"
              role="tab"
              aria-label={`Go to slide ${i + 1}`}
              aria-selected={selectedIndex === i}
              aria-current={selectedIndex === i ? 'true' : undefined}
              data-active={selectedIndex === i ? 'true' : 'false'}
              className="h-1.5 w-6 rounded-sm bg-rt-panel transition-colors data-[active=true]:bg-rt-cyan"
              onClick={() => scrollTo(i)}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

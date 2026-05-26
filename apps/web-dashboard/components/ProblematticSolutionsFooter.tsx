const HAZARD_STRIPE =
  'repeating-linear-gradient(-45deg, #0a0a0f 0, #0a0a0f 14px, #facc15 14px, #facc15 28px)';

export function ProblematticSolutionsFooter() {
  return (
    <footer className="relative border-t border-white/10 bg-[#0a0a0f]">
      <div className="mx-auto flex max-w-7xl flex-col items-center px-4 py-8">
        <a
          href="https://problematticsolutions.com"
          target="_blank"
          rel="noopener noreferrer"
          className="group inline-flex flex-col items-center text-center no-underline"
        >
          <div className="inline-flex w-fit flex-col items-stretch gap-2">
            <div
              className="h-1.5 w-full opacity-90 transition-opacity group-hover:opacity-100"
              style={{ background: HAZARD_STRIPE }}
              aria-hidden
            />

            <div
              className="flex items-baseline justify-center gap-x-2 whitespace-nowrap"
              style={{ fontWeight: 800, letterSpacing: '-0.02em' }}
            >
              <span className="text-2xl tracking-tight sm:text-3xl">
                <span className="text-white">Proble</span>
                <span className="text-[#facc15]">Mattic</span>
              </span>
              <span className="text-2xl tracking-tight text-[#d4d4d8] sm:text-3xl">Solutions</span>
            </div>
          </div>
        </a>
      </div>
    </footer>
  );
}

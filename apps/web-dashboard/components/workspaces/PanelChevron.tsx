'use client';

/** Chevron used on workspace panel headers (expand / collapse). */
export function PanelChevron({ expanded }: { expanded: boolean }) {
  return (
    <svg
      className={`h-3.5 w-3.5 shrink-0 text-app-muted transition-transform duration-200 ${
        expanded ? 'rotate-0' : '-rotate-90'
      }`}
      viewBox="0 0 20 20"
      fill="currentColor"
      aria-hidden
    >
      <path
        fillRule="evenodd"
        d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.94a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z"
        clipRule="evenodd"
      />
    </svg>
  );
}

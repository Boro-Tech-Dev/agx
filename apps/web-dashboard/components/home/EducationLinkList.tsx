import Link from 'next/link';

export type EducationLinkItem = {
  id: string;
  label: string;
  href: string;
  summary: string;
};

export function EducationLinkList({ items }: { items: EducationLinkItem[] }) {
  return (
    <ul className="space-y-2">
      {items.map((t) => (
        <li key={t.id} className="text-[11px] leading-relaxed">
          <Link
            href={t.href}
            className="font-semibold text-app-text underline decoration-app-border underline-offset-2 transition-colors hover:text-nav-active-fg hover:decoration-nav-active-border"
          >
            {t.label}
          </Link>
          <span className="text-app-muted"> — {t.summary}</span>
        </li>
      ))}
    </ul>
  );
}

'use client';

import Link from 'next/link';

import { learningMusingHref, learningMusingsList } from '../../../lib/learning/musings/registry';

export function LearningMusingsSection() {
  const musings = learningMusingsList();
  if (musings.length === 0) return null;

  return (
    <section>
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-app-muted">Musings</h3>
      <div className="space-y-2">
        {musings.map((m) => (
          <Link
            key={m.slug}
            href={learningMusingHref(m.slug)}
            className="block rounded-lg border border-app-border bg-app-surface p-3 transition-colors hover:bg-app-fill/40"
          >
            <p className="text-sm font-semibold text-app-text">{m.title}</p>
            <p className="mt-1 text-[11px] leading-relaxed text-app-muted">{m.excerpt}</p>
            <span className="mt-2 inline-block text-[11px] font-medium text-teal-700 dark:text-teal-300">
              Read →
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}

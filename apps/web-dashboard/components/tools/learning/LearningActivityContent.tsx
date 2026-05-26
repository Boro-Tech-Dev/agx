import Link from 'next/link';

import type { LearningPlaybookStep } from '../../../lib/learning/activityTypes';

export function LearningActivityContent({ step }: { step: LearningPlaybookStep }) {
  const activity = step.activity;
  const body = activity?.body ?? step.body;

  if (!activity?.sections?.length && body) {
    return (
      <div className="max-w-3xl whitespace-pre-wrap text-[13px] leading-relaxed text-app-text">
        {body}
      </div>
    );
  }

  if (!activity?.sections?.length) {
    return null;
  }

  return (
    <div className="max-w-3xl space-y-5">
      {activity.summary ? (
        <p className="text-[13px] font-medium text-app-text">{activity.summary}</p>
      ) : null}
      {activity.sections.map((section, i) => (
        <section key={i} className="space-y-2">
          {section.heading ? (
            <h3 className="text-sm font-semibold text-app-text">{section.heading}</h3>
          ) : null}
          {(section.paragraphs ?? []).map((p, j) => (
            <p key={j} className="text-[13px] leading-relaxed text-app-text">
              {p}
            </p>
          ))}
          {section.bullets?.length ? (
            <ul className="list-disc space-y-1 pl-5 text-[13px] leading-relaxed text-app-text">
              {section.bullets.map((b, k) => (
                <li key={k}>{b}</li>
              ))}
            </ul>
          ) : null}
        </section>
      ))}
      {(activity.governance_anchor ?? step.governance_anchor) ? (
        <p className="text-[11px] text-app-muted">
          Platform policy:{' '}
          <Link
            href={`/governance#${activity.governance_anchor ?? step.governance_anchor}`}
            className="font-medium text-teal-700 underline dark:text-teal-300"
          >
            Governance section
          </Link>
        </p>
      ) : null}
    </div>
  );
}

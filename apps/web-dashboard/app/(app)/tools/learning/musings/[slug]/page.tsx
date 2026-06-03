import Link from 'next/link';
import { notFound } from 'next/navigation';

import { DashboardShell } from '../../../../../../components/DashboardShell';
import { SubpageHeader } from '../../../../../../components/SubpageHeader';
import { LearningMusingPage } from '../../../../../../components/tools/learning/LearningMusingPage';
import { learningMusingBySlug, learningMusingSlugs } from '../../../../../../lib/learning/musings/registry';
import { toolRouteHref } from '../../../../../../lib/toolCatalog';

export const dynamicParams = false;

export function generateStaticParams() {
  return learningMusingSlugs().map((slug) => ({ slug }));
}

type Props = {
  params: { slug: string };
};

export default function LearningMusingRoutePage({ params }: Props) {
  const musing = learningMusingBySlug(params.slug);
  if (!musing) notFound();

  return (
    <DashboardShell
      activeTool="tool_learning"
      header={
        <SubpageHeader
          badge="Tools"
          badgeTone="muted"
          title={musing.title}
          trailing={
            <Link
              href={toolRouteHref('learning')}
              className="text-[11px] font-medium text-app-muted hover:text-app-text"
            >
              ← Learning hub
            </Link>
          }
        />
      }
    >
      <LearningMusingPage musing={musing} />
    </DashboardShell>
  );
}

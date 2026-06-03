import { notFound } from 'next/navigation';
import { Suspense } from 'react';

import { ToolDetailView } from '../../../../../components/tools/ToolDetailView';
import { toolIdFromSlug } from '../../../../../lib/toolCatalog';

type Props = {
  params: { slug: string };
};

export default function ToolSlugPage({ params }: Props) {
  const toolId = toolIdFromSlug(params.slug);
  if (!toolId) notFound();

  return (
    <Suspense fallback={<div className="p-4 text-[11px] text-app-muted">Loading tool…</div>}>
      <ToolDetailView toolId={toolId} />
    </Suspense>
  );
}

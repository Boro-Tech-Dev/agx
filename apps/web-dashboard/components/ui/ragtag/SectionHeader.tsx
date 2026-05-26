import { cn } from '../../../lib/cn';

export function SectionHeader({
  title,
  count,
  accent = 'cyan',
  id,
}: {
  title: string;
  count?: number;
  accent?: 'cyan' | 'yellow';
  id?: string;
}) {
  const underline = accent === 'cyan' ? 'border-rt-cyan' : 'border-rt-yellow';

  return (
    <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
      <h2
        id={id}
        className={cn(
          'inline-block border-b-2 pb-1 font-display text-sm font-bold uppercase tracking-widest text-rt-white',
          underline,
        )}
      >
        {title}
      </h2>
      {count != null ? (
        <span className="rounded-sm bg-rt-panel px-2 py-0.5 font-mono text-[10px] uppercase tracking-widest text-rt-ice/80">
          {count}
        </span>
      ) : null}
    </div>
  );
}

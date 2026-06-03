import Link from 'next/link';

export function RtBadge({ href = '/', linked = true }: { href?: string; linked?: boolean }) {
  const inner = (
    <>
      <div className="flex h-6 w-6 shrink-0 items-center justify-center bg-rt-cyan text-[10px] font-bold tracking-tighter text-rt-black">
        RT
      </div>
      <div className="flex flex-col">
        <span className="font-display text-lg font-bold uppercase leading-none tracking-wide text-rt-white">
          RagTag
        </span>
        <span className="mt-1 text-[10px] uppercase leading-none tracking-wider text-rt-cyan opacity-80">
          PM Operator Grid
        </span>
      </div>
    </>
  );

  if (linked) {
    return (
      <Link href={href} className="flex items-center gap-3">
        {inner}
      </Link>
    );
  }

  return <div className="flex items-center gap-3">{inner}</div>;
}

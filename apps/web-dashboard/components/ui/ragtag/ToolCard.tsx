'use client';

import Link from 'next/link';
import type { ElementType, ReactNode } from 'react';
import { ArrowUpRight } from 'lucide-react';

import { cn } from '../../../lib/cn';
import { StatusPill } from './StatusPill';
import type { StatusVariant } from '../../../lib/ragtag/statusVariants';

export type ToolCardProps = {
  name: string;
  purpose: string;
  status: string;
  cta?: string;
  metadata?: string;
  icon?: ElementType;
  variant?: StatusVariant;
  href?: string;
  onClick?: () => void;
  footer?: ReactNode;
};

export function ToolCard({
  name,
  purpose,
  status,
  cta = 'Open',
  metadata,
  icon: Icon,
  variant = 'info',
  href,
  onClick,
  footer,
}: ToolCardProps) {
  const body = (
    <div
      className={cn(
        'group relative flex cursor-pointer flex-col border border-rt-panel bg-rt-charcoal p-4 transition-all duration-200',
        'hover:-translate-y-0.5 hover:border-rt-cyan',
        href || onClick ? '' : 'cursor-default',
      )}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
    >
      <div className="mb-3 flex items-start justify-between">
        <div className="border border-rt-panel bg-rt-black p-2 text-rt-white transition-colors group-hover:text-rt-cyan">
          {Icon ? <Icon className="h-4 w-4" /> : null}
        </div>
        <StatusPill status={status} variant={variant} />
      </div>

      <div className="mb-4 flex-1">
        <h3 className="mb-1 font-display text-base font-bold uppercase tracking-wide text-rt-white">
          {name}
        </h3>
        <p className="max-w-[90%] text-[11px] leading-relaxed text-rt-ice/70">{purpose}</p>
      </div>

      <div className="mt-auto flex items-center justify-between border-t border-rt-panel/50 pt-3">
        {metadata ? (
          <span className="font-mono text-[9px] uppercase tracking-widest text-rt-cyan/80">
            [{metadata}]
          </span>
        ) : (
          <span />
        )}
        <span className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-rt-white transition-colors group-hover:text-rt-cyan">
          {cta} <ArrowUpRight className="h-3 w-3" />
        </span>
      </div>

      {footer}

      <div className="absolute -right-px -top-px h-2 w-2 border-r-2 border-t-2 border-rt-panel transition-colors group-hover:border-rt-cyan" />
    </div>
  );

  if (href) {
    return (
      <Link href={href} className="block h-full">
        {body}
      </Link>
    );
  }

  return body;
}

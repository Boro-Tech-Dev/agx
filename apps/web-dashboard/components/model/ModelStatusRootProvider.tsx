'use client';

import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';

import { ModelStatusProvider } from './ModelStatusProvider';

/** Enables model status polling on authenticated app routes only (not /login). */
export function ModelStatusRootProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const enabled = pathname !== '/login';

  return <ModelStatusProvider enabled={enabled}>{children}</ModelStatusProvider>;
}

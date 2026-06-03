import type { NextRequest } from 'next/server';

export type PublicOriginRequest = {
  headers: { get(name: string): string | null };
  nextUrl: URL;
};

/**
 * Public site origin for redirects behind Traefik/Docker.
 * `req.url` / `req.nextUrl.origin` are often http://localhost:3000 inside the container.
 */
export function requestPublicOrigin(req: PublicOriginRequest): string {
  const fromEnv = (process.env.APP_PUBLIC_ORIGIN || process.env.VPS_PUBLIC_URL || '')
    .trim()
    .replace(/\/$/, '');
  if (fromEnv) return fromEnv;

  const xfp = req.headers.get('x-forwarded-proto')?.split(',')[0]?.trim().toLowerCase();
  const xfh = req.headers.get('x-forwarded-host')?.split(',')[0]?.trim();
  if (xfp && xfh) {
    return `${xfp}://${xfh}`;
  }

  const host = req.headers.get('host')?.trim();
  if (host) {
    const proto = xfp || (req.nextUrl.protocol === 'https:' ? 'https' : 'http');
    return `${proto}://${host}`;
  }

  return req.nextUrl.origin;
}

/** Build an absolute URL on the public origin (path may include query). */
export function absolutePublicUrl(req: PublicOriginRequest, path: string): URL {
  const base = requestPublicOrigin(req);
  return new URL(path.startsWith('/') ? path : `/${path}`, base);
}
